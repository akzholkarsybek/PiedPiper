"""
Wingmate API (FastAPI). Same routes and JSON shapes as the old Next.js /api routes,
so the frontend talks to it unchanged (Next.js proxies /api/* here, see next.config.ts).
"""

from __future__ import annotations

import os
import re
from pathlib import Path

from dotenv import load_dotenv

# Load env before importing modules that read it at import time.
_root = Path(__file__).resolve().parent.parent
load_dotenv(_root / ".env")
load_dotenv(_root.parent / ".env.local")  # reuse the frontend's env file if that's where the key lives

import asyncio  # noqa: E402
import json  # noqa: E402
import logging  # noqa: E402
from typing import Any, Dict, List, Optional  # noqa: E402

from fastapi import FastAPI, Request  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.responses import JSONResponse, StreamingResponse  # noqa: E402

from . import agents, dates, llm, profiles, store  # noqa: E402
from .onboard import build_profile  # noqa: E402
from .view import view_date  # noqa: E402

log = logging.getLogger("wingmate")
app = FastAPI(title="Wingmate API")

_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
if _origins:
    app.add_middleware(
        CORSMiddleware, allow_origins=_origins, allow_methods=["*"], allow_headers=["*"]
    )


def err(message: str, status: int) -> JSONResponse:
    return JSONResponse({"error": message}, status_code=status)


async def body(req: Request) -> Dict[str, Any]:
    try:
        data = await req.json()
        return data if isinstance(data, dict) else {}
    except Exception:  # noqa: BLE001
        return {}


def viewer(req: Request) -> Optional[str]:
    return req.headers.get("x-profile-id")


# ---------------------------------------------------------------- status


@app.get("/api/status")
async def status():
    return {"mock": llm.MOCK, "model": None if llm.MOCK else llm.MODEL, "store": "redis" if store.using_redis else "memory"}


# ---------------------------------------------------------------- profiles

GENDERS = ("man", "woman", "nonbinary")
LOOKING = ("men", "women", "everyone")
INTENTS = ("serious", "casual", "open")


def _num(v: Any, default: float) -> float:
    if v is None:
        v = default
    try:
        return float(v)
    except (TypeError, ValueError):
        return float("nan")


@app.post("/api/profiles")
async def create_profile(req: Request):
    b = await body(req)
    if not str(b.get("name") or "").strip():
        return err("Name is required", 400)
    if b.get("gender") not in GENDERS or b.get("lookingFor") not in LOOKING or b.get("intent") not in INTENTS:
        return err("Invalid gender, preference or intent", 400)
    if _num(b.get("age"), float("nan")) < 18:
        return err("You must be 18+", 400)

    def s(k: str, limit: Optional[int] = None) -> str:
        v = str(b.get(k) or "")
        return v[:limit] if limit else v

    inp = {
        "name": s("name"),
        "age": _num(b.get("age"), float("nan")),
        "gender": b["gender"],
        "lookingFor": b["lookingFor"],
        "ageMin": _num(b.get("ageMin"), 18),
        "ageMax": _num(b.get("ageMax"), 99),
        "city": s("city"),
        "intent": b["intent"],
        "occupation": s("occupation"),
        "aboutMe": s("aboutMe", 600),
        "idealWeekend": s("idealWeekend", 600),
        "moneyHabits": s("moneyHabits", 600),
        "dealbreakers": s("dealbreakers", 400),
        "keepPrivate": s("keepPrivate", 400),
        "humor": s("humor", 300),
    }
    try:
        profile = await build_profile(inp)
        photo = b.get("photo")
        # Only a small, browser-resized image (data URL). Anything else is ignored, never stored.
        if isinstance(photo, str) and re.fullmatch(r"data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+", photo) and len(photo) <= 120_000:
            profile["photo"] = photo
        await profiles.save_profile(profile)
        return {"profile": profile}
    except Exception:  # noqa: BLE001
        log.exception("build_profile failed")
        return err("Couldn't build your agent. Try again.", 500)


@app.get("/api/profiles/{id}")
async def get_profile(id: str, req: Request):
    """The owner (identified by the x-profile-id header) also sees their private notes."""
    p = await profiles.get_profile(id)
    if not p:
        return err("Not found", 404)
    return {"profile": p if viewer(req) == id else profiles.public_profile(p)}


@app.get("/api/profiles/{id}/candidates")
async def candidates(id: str):
    me = await profiles.get_profile(id)
    if not me:
        return err("Not found", 404)
    dated = {d["bId"] if d["aId"] == id else d["aId"] for d in await dates.list_dates_for(id)}
    ranked = profiles.rank_candidates(me, await profiles.list_profiles(), dated)
    return {"candidates": ranked[:6], "totalEligible": len(ranked)}


@app.get("/api/profiles/{id}/dates")
async def profile_dates(id: str):
    """Date history + matches for one profile. Only returns that profile's own verdicts."""
    items: List[Dict[str, Any]] = []
    for d in await dates.list_dates_for(id):
        side = "a" if d["aId"] == id else "b"
        other = await profiles.get_profile(d["bId"] if side == "a" else d["aId"])
        mine = d.get("verdictA") if side == "a" else d.get("verdictB")
        theirs = d.get("verdictB") if side == "a" else d.get("verdictA")
        items.append(
            {
                "id": d["id"],
                "status": d["status"],
                "venue": d.get("venue") or "cafe",
                "chemistry": next((t["vibe"]["score"] for t in reversed(d.get("transcript") or []) if t.get("vibe")), None),
                "createdAt": d["createdAt"],
                "other": profiles.public_profile(other) if other else None,
                "myVerdict": mine,
                # You only learn their decision if it's a mutual match (like a real dating app).
                "mutual": bool(d.get("matchId")),
                "theyDecided": bool(theirs),
                "matchId": d.get("matchId"),
            }
        )
    return {"dates": items, "matchCount": len(await dates.list_matches_for(id))}


# ---------------------------------------------------------------- dates


@app.post("/api/dates")
async def create_date(req: Request):
    """Create a date between the viewer (a) and someone else (b). Running it is a separate call."""
    b = await body(req)
    a_id, b_id = b.get("aId"), b.get("bId")
    if not a_id or not b_id or a_id == b_id:
        return err("aId and bId required", 400)
    a, bp = await profiles.get_profile(a_id), await profiles.get_profile(b_id)
    if not a or not bp:
        return err("Profile not found", 404)
    if a["isSeed"]:
        return err("Demo profiles can't start dates", 400)

    venue = b.get("venue") if b.get("venue") in agents.VENUES else agents.DEFAULT_VENUE

    # Don't send the same pair on two dates.
    for d in await dates.list_dates_for(a_id):
        if {d["aId"], d["bId"]} == {a_id, b_id}:
            if d["status"] in ("pending", "error") and d.get("venue") != venue:
                d["venue"] = venue  # not started yet: use the newly picked place
                await dates.save_date(d)
            return {"date": d, "existing": True}
    return {"date": await dates.create_date(a_id, b_id, venue)}


@app.get("/api/dates/{id}")
async def get_date(id: str, req: Request):
    d = await dates.get_date(id)
    if not d:
        return err("Not found", 404)
    a, b = await profiles.get_profile(d["aId"]), await profiles.get_profile(d["bId"])
    if not a or not b:
        return err("Profile missing", 404)
    return {"date": view_date(d, a, b, viewer(req))}


@app.post("/api/dates/{id}/nudge")
async def nudge(id: str, req: Request):
    """Coach mode: the human whispers to their own agent while the date is live."""
    b = await body(req)
    d = await dates.get_date(id)
    if not d:
        return err("Not found", 404)
    pid = b.get("profileId")
    side = "a" if pid == d["aId"] else "b" if pid == d["bId"] else None
    if not side:
        return err("You can only coach your own agent", 403)
    clean = str(b.get("text") or "").strip()[:200]
    if not clean:
        return err("Empty whisper", 400)
    if d["status"] == "done":
        return err("The date is already over", 409)
    await dates.add_nudge(id, side, clean)
    return {"ok": True}


@app.post("/api/dates/{id}/redo")
async def redo_date(id: str, req: Request):
    """Second chance: wipe a finished (no match) or failed date so the agents can go out again."""
    d = await dates.get_date(id)
    if not d:
        return err("Not found", 404)
    if viewer(req) not in (d["aId"], d["bId"]):
        return err("Only the people on this date can redo it", 403)
    if d.get("matchId"):
        return err("You already matched, no need to redo it", 409)
    if d["status"] == "running" and id in _running:
        return err("This date is still running", 409)
    d.update({"status": "pending", "transcript": [], "verdictA": None, "verdictB": None})
    new_venue = (await body(req)).get("venue")
    if new_venue in agents.VENUES:
        d["venue"] = new_venue
    await dates.save_date(d)
    for side in ("a", "b"):
        await store.delete(f"nudges:{id}:{side}")
    return {"date": d}


_running: Dict[str, "asyncio.Task[None]"] = {}


@app.post("/api/dates/{id}/run")
async def run_date(id: str, req: Request):
    """
    Runs the agent date and streams it to the browser as NDJSON (one JSON event per line).
    Every message is generated live by Gemini; nothing is scripted.
    The date runs as a background task, so it finishes even if the browser disconnects.
    """
    viewer_id = (await body(req)).get("viewerId")
    d = await dates.get_date(id)
    if not d:
        return err("Not found", 404)
    a, b = await profiles.get_profile(d["aId"]), await profiles.get_profile(d["bId"])
    if not a or not b:
        return err("Profile missing", 404)

    queue: "asyncio.Queue[Optional[Dict[str, Any]]]" = asyncio.Queue()
    send = queue.put_nowait

    async def worker() -> None:
        try:
            if d["status"] == "done":
                send({"type": "done", "date": view_date(d, a, b, viewer_id)})
                return
            if d["status"] == "running" and dates.now_ms() - (d.get("startedAt") or 0) < 150_000:
                send({"type": "error", "message": "This date is already in progress in another tab."})
                return

            d["status"] = "running"
            d["startedAt"] = dates.now_ms()
            d["transcript"] = []
            await dates.save_date(d)
            send({"type": "start", "date": view_date(d, a, b, viewer_id)})

            consumed = {"a": 0, "b": 0}

            async def take_nudges(side: str) -> List[str]:
                all_ = await dates.read_nudges(d["id"], side)
                fresh = all_[consumed[side] :]
                consumed[side] = len(all_)
                return fresh

            async def on_turn(transcript: List[Dict[str, Any]]) -> None:
                d["transcript"] = list(transcript)
                await dates.save_date(d)

            async for ev in agents.run_date(a, b, take_nudges, on_turn, d.get("venue") or agents.DEFAULT_VENUE):
                send(ev)

            send({"type": "deliberating"})
            va, vb = await agents.both_verdicts(a, b, d["transcript"])
            d["verdictA"], d["verdictB"] = va, vb
            if va["decision"] == "yes" and vb["decision"] == "yes":
                d["matchId"] = (await dates.create_match(d))["id"]
            d["status"] = "done"
            await dates.save_date(d)

            view = view_date(d, a, b, viewer_id)
            if view["verdictA"]:
                send({"type": "verdict", "side": "a", "verdict": view["verdictA"]})
            if view["verdictB"]:
                send({"type": "verdict", "side": "b", "verdict": view["verdictB"]})
            send({"type": "done", "date": view})
        except Exception:  # noqa: BLE001
            log.exception("date run failed")
            d["status"] = "error"
            try:
                await dates.save_date(d)
            except Exception:  # noqa: BLE001
                pass
            send({"type": "error", "message": "The agents lost connection (AI error). Try again."})
        finally:
            send(None)
            _running.pop(id, None)

    _running[id] = asyncio.create_task(worker())  # keep a reference so the task isn't garbage-collected

    async def stream():
        while True:
            ev = await queue.get()
            if ev is None:
                break
            yield json.dumps(ev, ensure_ascii=False) + "\n"

    return StreamingResponse(
        stream(),
        media_type="application/x-ndjson; charset=utf-8",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
    )


# ---------------------------------------------------------------- matches


async def _authorize_match(req: Request, id: str):
    m = await dates.get_match(id)
    if not m:
        return None, err("Not found", 404)
    if viewer(req) not in (m["aId"], m["bId"]):
        return None, err("Not your match", 403)
    return m, None


@app.get("/api/matches/{id}")
async def get_match(id: str, req: Request):
    m, e = await _authorize_match(req, id)
    if e:
        return e
    d = await dates.get_date(m["dateId"])
    a, b = await profiles.get_profile(m["aId"]), await profiles.get_profile(m["bId"])
    if not d or not a or not b:
        return err("Missing data", 404)
    return {"match": m, "date": view_date(d, a, b, viewer(req))}


@app.get("/api/matches/{id}/messages")
async def get_messages(id: str, req: Request):
    """Human-to-human chat. Unlocked only after BOTH agents said yes."""
    _, e = await _authorize_match(req, id)
    if e:
        return e
    return {"messages": await dates.get_messages(id)}


@app.post("/api/matches/{id}/messages")
async def post_message(id: str, req: Request):
    m, e = await _authorize_match(req, id)
    if e:
        return e
    me = viewer(req)
    # Demo profiles can be messaged too (they just never reply), so the chat works after any match.
    text = str((await body(req)).get("text") or "").strip()[:1000]
    if not text:
        return err("Empty message", 400)
    return {"message": await dates.add_message(id, me, text)}  # type: ignore[arg-type]


@app.post("/api/matches/{id}/wingman")
async def wingman(id: str, req: Request):
    """Suggests 3 first messages. The human picks, edits and sends — the AI never sends for them."""
    m, e = await _authorize_match(req, id)
    if e:
        return e
    d = await dates.get_date(m["dateId"])
    a, b = await profiles.get_profile(m["aId"]), await profiles.get_profile(m["bId"])
    if not d or not a or not b:
        return err("Missing data", 404)
    me, other = (a, b) if viewer(req) == a["id"] else (b, a)
    try:
        return {"openers": await agents.wingman(me, other, a, b, d["transcript"])}
    except Exception:  # noqa: BLE001
        log.exception("wingman failed")
        return err("Wingman is unavailable right now.", 500)


@app.post("/api/matches/{id}/ideas")
async def match_ideas(id: str, req: Request):
    """Ideas for the first real date. Generated once and saved, so both people see the same list.
    Send {"refresh": true} to get new ones."""
    m, e = await _authorize_match(req, id)
    if e:
        return e
    if m.get("ideas") and not (await body(req)).get("refresh"):
        return {"ideas": m["ideas"]}
    d = await dates.get_date(m["dateId"])
    a, b = await profiles.get_profile(m["aId"]), await profiles.get_profile(m["bId"])
    if not d or not a or not b:
        return err("Missing data", 404)
    try:
        ideas = await agents.date_ideas(a, b, d["transcript"])
    except Exception:  # noqa: BLE001
        log.exception("date ideas failed")
        return err("Couldn't come up with ideas right now. Try again.", 500)
    if not ideas:
        return err("Couldn't come up with ideas right now. Try again.", 500)
    m["ideas"] = ideas
    await dates.save_match(m)
    return {"ideas": ideas}
