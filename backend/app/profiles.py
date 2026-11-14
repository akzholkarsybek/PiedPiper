"""Profile storage + step-1 pre-filter / ranking (no AI)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

from . import store

Profile = Dict[str, Any]

# Demo profiles so a judge can try the product alone. Clearly labeled in the UI.
# Dates with them are NOT scripted: every conversation and verdict is generated live.
SEED_PROFILES: List[Profile] = [
    {**s, "isSeed": True, "createdAt": 0}
    for s in json.loads((Path(__file__).parent / "seeds.json").read_text(encoding="utf-8"))
]
_seed_map = {p["id"]: p for p in SEED_PROFILES}


async def get_profile(id: str) -> Optional[Profile]:
    return _seed_map.get(id) or await store.get_json(f"profile:{id}")


async def save_profile(p: Profile) -> None:
    await store.set_json(f"profile:{p['id']}", p)
    await store.sadd("profiles", p["id"])


async def list_profiles() -> List[Profile]:
    real = []
    for id in await store.smembers("profiles"):
        p = await store.get_json(f"profile:{id}")
        if p:
            real.append(p)
    return real + SEED_PROFILES


def public_profile(p: Profile) -> Profile:
    """Public view: never send privateNotes to the browser for other people's profiles."""
    return {k: v for k, v in p.items() if k != "privateNotes"}


# ------------------------- Step 1: cheap pre-filter (no AI) -------------------------


def _wants(a: Profile, b: Profile) -> bool:
    lf = a["lookingFor"]
    if lf == "everyone":
        return True
    if lf == "men":
        return b["gender"] == "man"
    if lf == "women":
        return b["gender"] == "woman"
    return False


def _age_ok(a: Profile, b: Profile) -> bool:
    return a["ageMin"] <= b["age"] <= a["ageMax"]


_MONEY_RANK = {"saver": 0, "balanced": 1, "spender": 2}


def _city(p: Profile) -> str:
    return p["city"].split(",")[0].strip().lower()


def rank_candidates(me: Profile, pool: List[Profile], exclude: Set[str]) -> List[Dict[str, Any]]:
    """Hard filters (mutual preference + mutual age range), then a soft score.
    Only the top few go on (expensive) AI dates."""
    out = []
    for other in pool:
        if other["id"] == me["id"] or other["id"] in exclude:
            continue
        if not _wants(me, other) or not _wants(other, me):
            continue
        if not _age_ok(me, other) or not _age_ok(other, me):
            continue

        score = 50
        reasons: List[str] = []

        if me["intent"] == other["intent"]:
            score += 15
            reasons.append(f"Both looking for something {me['intent']}")
        elif "open" in (me["intent"], other["intent"]):
            score += 5
        else:
            score -= 15

        shared = [
            i
            for i in me["interests"]
            if any(j.lower() in i.lower() or i.lower() in j.lower() for j in other["interests"])
        ]
        if shared:
            score += min(15, len(shared) * 6)
            reasons.append(f"Shared interests: {', '.join(shared[:3])}")

        other_values = [x.lower() for x in other["values"]]
        shared_values = [v for v in me["values"] if v.lower() in other_values]
        if shared_values:
            score += min(12, len(shared_values) * 6)
            reasons.append(f"Shared values: {', '.join(shared_values)}")

        gap = abs(_MONEY_RANK[me["money"]["style"]] - _MONEY_RANK[other["money"]["style"]])
        score += 8 if gap == 0 else 0 if gap == 1 else -10
        if gap == 2:
            reasons.append("Different money styles — worth testing")

        if _city(me) == _city(other):
            score += 10
            reasons.append(f"Both in {other['city']}")

        out.append({"profile": public_profile(other), "score": max(0, min(100, score)), "reasons": reasons})

    # Real people first when scores tie, so human-to-human matches are surfaced.
    out.sort(key=lambda c: (-c["score"], bool(c["profile"]["isSeed"])))
    return out
