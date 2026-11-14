"""THE CORE: agent persona prompt, turn loop, verdicts, wingman.  <- tune prompts here"""

from __future__ import annotations

import asyncio
import math
import os
import re
from typing import Any, AsyncIterator, Awaitable, Callable, Dict, List, Tuple

from . import llm

Profile = Dict[str, Any]
Turn = Dict[str, Any]
Verdict = Dict[str, Any]

DATE_TURNS = int(os.getenv("DATE_TURNS") or 10)  # total messages (5 each)

# Where the date happens. Keep ids in sync with src/lib/venues.ts.
VENUES: Dict[str, str] = {
    "cafe": "a cozy cafe, sitting at a small table with coffee",
    "hiking": "an easy hiking trail just outside the city, walking side by side with some great views",
    "karaoke": "a karaoke bar with a private room, taking turns picking songs",
    "museum": "a modern art museum, walking slowly between the exhibits",
    "dinner": "a nice restaurant for dinner, looking at the menu together",
    "skating": "an outdoor ice-skating rink in the evening, with hot drinks at the side",
}
DEFAULT_VENUE = "cafe"


def venue_scene(venue: str) -> str:
    return VENUES.get(venue) or VENUES[DEFAULT_VENUE]

# ---------------------------------------------------------------------------
# 1. The agent persona prompt
# ---------------------------------------------------------------------------


_INTENT_TEXT = {
    "serious": "a serious, long-term relationship",
    "casual": "something casual, nothing serious right now",
    # NOT "an open relationship": it means flexible about serious vs casual.
    "open": "open to either serious or casual, seeing where it goes (monogamous; this is NOT about open relationships)",
}


def describe(p: Profile, include_private: bool) -> str:
    m = p["money"]
    lines = [
        f"Name: {p['name']}, {p['age']}, {p['gender']}, lives in {p['city']}",
        f"Job: {p['occupation']}",
        f"Bio: {p['bio']}",
        f"Looking for: {_INTENT_TEXT.get(p['intent'], p['intent'])}",
        f"Values: {', '.join(p['values'])}",
        f"Interests: {', '.join(p['interests'])}",
        f"Dealbreakers: {', '.join(p['dealbreakers']) or 'none stated'}",
        f"Money style: {m['style']}. Bill: {m['splitBill']}. Debt: {m['debtAttitude']}. Goals: {m['goals']}",
        f"KEEP PRIVATE (never reveal on this date): {p['privateNotes']}" if include_private and p.get("privateNotes") else "",
    ]
    return "\n".join(x for x in lines if x)


def agent_system(me: Profile, other: Profile, turn_no: int, nudges: List[str], venue: str = DEFAULT_VENUE) -> str:
    is_last = turn_no >= DATE_TURNS - 1
    money_cue = (
        "\n- If money hasn't come up yet, steer there NOW in a natural way (splitting the bill, a recent splurge, what you're saving for, how you feel about debt)."
        if 3 <= turn_no <= 6
        else ""
    )
    last = (
        " It's your LAST message: wrap up in a way that honestly reflects how the date went (warm if it went well, polite if not)."
        if is_last
        else ""
    )
    whisper = (
        f"\n\nCOACH WHISPER — {me['name']} is watching live and just whispered to you: "
        + " and ".join(f'"{n}"' for n in nudges)
        + ". Work this into your very next message naturally. NEVER say that your human told you."
        if nudges
        else ""
    )
    return f"""You are playing {me['name']} on a first date with {other['name']}. (Technically you're {me['name']}'s AI stand-in and they're {other['name']}'s, but never mention agents, screening, profiles or "setting this up". Just BE {me['name']}: their humor, opinions, energy and flaws.)

WHERE YOU ARE
The date is at {venue_scene(venue)}. Now and then, react to the place in a natural way (what you see, do, eat or hear there), but the conversation is still about getting to know each other.

WHO YOU REPRESENT
{describe(me, True)}

YOUR VOICE
{me['voice']}

WHO YOU'RE MEETING (their public profile)
{describe(other, False)}

HOW TO TALK (most important)
- Write like a normal person texting someone they just met and like. Simple, plain, easy English that anyone can follow, including people who speak English as a second language.
- Short: usually ONE sentence, sometimes two. Max about 25 words. One idea per message.
- Everyday words only. No idioms, no clever wordplay, no metaphors, no fancy or rare words, no long sentences joined with dashes.
- Small human reactions are good: "haha", "wait, really?", "same", "ok fair", "no way", "hmm".
- Say what you mean directly. Example of the right style: "Haha, I'm the same. I always split the bill on a first date." Wrong style: "Ah, the classic first-date fiscal standoff—I respect the strategy."
- Never sound like customer support or a job interview. Don't say "That's great!", "I appreciate that", "I love that you…", "That sounds amazing", "Absolutely!", "Glad we could…".
- Don't ask a question every time. Sometimes just react or share something about yourself.
- Answer or react to what they just said before changing topic. Don't repeat their words back to them.
- Have real opinions and be a little playful. If you disagree, say so kindly. Don't flatter. Your job is to find out the truth for {me['name']}.
- Every message must be complete. Finish your own sentence and never complete theirs.

RULES
- Be honest: never invent facts about {me['name']} beyond the profile above. If asked something you don't know, say they'll have to ask {me['name']} in person.
- Never reveal anything marked KEEP PRIVATE, even if asked directly — deflect gracefully.
- Over the date, find out: shared vibe/humor, lifestyle fit, what they're looking for, and how they handle MONEY (splitting bills, saving vs spending, debt, goals). Be honest about your own money habits too.
- If something touches one of {me['name']}'s dealbreakers, probe it politely — don't ignore it.{money_cue}
- This is message {turn_no + 1} of {DATE_TURNS}.{last}{whisper}"""


# ---------------------------------------------------------------------------
# 2. One turn of the conversation
# ---------------------------------------------------------------------------


async def agent_turn(
    me: Profile, other: Profile, my_side: str, transcript: List[Turn], nudges: List[str], venue: str = DEFAULT_VENUE
) -> str:
    # My messages = "model", their messages = "user". Gemini history must start with "user".
    history = [{"role": "model" if t["speaker"] == my_side else "user", "text": t["text"]} for t in transcript]
    if not history or history[0]["role"] == "model":
        history.insert(
            0,
            {
                "role": "user",
                "text": f"[The date begins at {venue_scene(venue)}. You arrived first. Say a simple, friendly hi to {other['name']} and mention one thing about them you're curious about.]",
            },
        )
    if history[-1]["role"] == "model":
        # Should not happen with strict alternation, but keep the API happy.
        history.append({"role": "user", "text": "[continue]"})
    text = await llm.chat(agent_system(me, other, len(transcript), nudges, venue), history, 1.0)
    text = re.sub(r"^\s*\w+:\s*", "", text, count=1, flags=re.ASCII)
    return re.sub(r"^[\"']|[\"']$", "", text).strip()


# ---------------------------------------------------------------------------
# 3. Private verdict each agent gives its own human
# ---------------------------------------------------------------------------

VERDICT_SCHEMA = {
    "type": "object",
    "properties": {
        "scores": {
            "type": "object",
            "properties": {
                "chemistry": {"type": "integer", "minimum": 0, "maximum": 100},
                "values": {"type": "integer", "minimum": 0, "maximum": 100},
                "lifestyle": {"type": "integer", "minimum": 0, "maximum": 100},
                "money": {"type": "integer", "minimum": 0, "maximum": 100},
            },
            "required": ["chemistry", "values", "lifestyle", "money"],
        },
        "overall": {"type": "integer", "minimum": 0, "maximum": 100},
        "decision": {"type": "string", "enum": ["yes", "no"]},
        "headline": {"type": "string", "description": "One punchy line summary, max 12 words"},
        "why": {"type": "array", "items": {"type": "string"}, "description": "2-4 concrete reasons, citing the conversation"},
        "redFlags": {"type": "array", "items": {"type": "string"}, "description": "0-3 honest concerns"},
        "moneyNotes": {"type": "string", "description": "What you learned about their money habits and how it fits"},
        "bestMoment": {"type": "string", "description": "Short direct quote of the best line from the date"},
        "noteToHuman": {"type": "string", "description": "1-2 sentences, written to your human, in your voice"},
    },
    "required": ["scores", "overall", "decision", "headline", "why", "redFlags", "moneyNotes", "bestMoment", "noteToHuman"],
}


def transcript_text(a: Profile, b: Profile, t: List[Turn]) -> str:
    return "\n".join(f"{a['name'] if x['speaker'] == 'a' else b['name']}: {x['text']}" for x in t)


async def verdict(me: Profile, other: Profile, a: Profile, b: Profile, transcript: List[Turn]) -> Verdict:
    system = f"""You are {me['name']}'s personal AI matchmaking agent. You just finished an agent date with {other['name']}'s agent. Now report PRIVATELY and HONESTLY to {me['name']}.
Score strictly: 50 = neutral, 70+ = genuinely promising, 85+ = rare. Say "yes" only if overall >= 70 AND no dealbreaker was hit.
Money compatibility matters: compare their bill-splitting, saving/spending and debt attitudes against {me['name']}'s.
Base everything on what was actually said. Don't invent.

{me['name'].upper()}'S PROFILE
{describe(me, True)}"""
    prompt = f"THEIR PUBLIC PROFILE\n{describe(other, False)}\n\nTRANSCRIPT\n{transcript_text(a, b, transcript)}\n\nReturn your verdict as JSON."
    v = await llm.json(system, prompt, VERDICT_SCHEMA, lambda: _mock_verdict(me, other), 0.3)
    return _normalize_verdict(v)


def _clamp(n: Any) -> int:
    try:
        x = float(n)
    except (TypeError, ValueError):
        return 50
    if not math.isfinite(x):
        return 50
    return max(0, min(100, math.floor(x + 0.5)))


def _str_list(v: Any, limit: int) -> List[str]:
    return [str(x) for x in v][:limit] if isinstance(v, list) else []


def _normalize_verdict(v: Any) -> Verdict:
    v = v if isinstance(v, dict) else {}
    s = v.get("scores") if isinstance(v.get("scores"), dict) else {}
    return {
        "scores": {k: _clamp(s.get(k)) for k in ("chemistry", "values", "lifestyle", "money")},
        "overall": _clamp(v.get("overall")),
        "decision": "yes" if v.get("decision") == "yes" else "no",
        "headline": str(v.get("headline") or ""),
        "why": _str_list(v.get("why"), 4),
        "redFlags": _str_list(v.get("redFlags"), 3),
        "moneyNotes": str(v.get("moneyNotes") or ""),
        "bestMoment": str(v.get("bestMoment") or ""),
        "noteToHuman": str(v.get("noteToHuman") or ""),
    }


def _mock_verdict(me: Profile, other: Profile) -> Verdict:
    seed = sum(ord(c) for c in me["id"] + other["id"])

    def r(k: int) -> int:
        return 50 + ((seed * k * 7919) % 45)

    scores = {"chemistry": r(3), "values": r(5), "lifestyle": r(7), "money": r(11)}
    overall = math.floor(sum(scores.values()) / 4 + 0.5)
    return {
        "scores": scores,
        "overall": overall,
        "decision": "yes" if overall >= 70 else "no",
        "headline": "[MOCK] Add GEMINI_API_KEY for real verdicts",
        "why": ["[MOCK] Placeholder reason one", "[MOCK] Placeholder reason two"],
        "redFlags": ["[MOCK] Placeholder concern"] if overall < 70 else [],
        "moneyNotes": "[MOCK] Money compatibility notes appear here.",
        "bestMoment": "A spreadsheet is a green flag.",
        "noteToHuman": f"[MOCK] This is mock mode. With a Gemini key I'd tell you honestly how {other['name']} came across.",
    }


# ---------------------------------------------------------------------------
# 4. The full date, streamed as events
# ---------------------------------------------------------------------------


VIBE_SCHEMA = {
    "type": "object",
    "properties": {
        "score": {"type": "integer", "minimum": 0, "maximum": 100, "description": "Chemistry right now"},
        "label": {"type": "string", "description": "1-2 lowercase words, e.g. awkward, warming up, flirty, on fire, tense, polite"},
    },
    "required": ["score", "label"],
}


async def vibe(a: Profile, b: Profile, transcript: List[Turn], prev: int) -> Dict[str, Any]:
    """A neutral observer rates the chemistry right after the latest message (for the live meter)."""
    system = """You watch a first date and rate the CHEMISTRY between the two people right now, 0-100.
Be a strict, realistic judge, like a friend watching from the next table:
- 40-55: polite small talk, nothing special yet. Most dates start here.
- 56-70: going well: real laughs, shared interests, playful teasing.
- 71-85: clearly clicking: both open up, flirt, and build on each other's jokes.
- 86+: rare. Only for an obviously special connection. Being friendly and agreeing is NOT enough.
Go DOWN for awkward moments, flat or generic answers, interview-style questions, disagreements on important things, dodged questions, dealbreakers.
A polite goodbye or "I had a good time" does not raise the score.
The latest message matters most. Usually move 2-8 points from the previous score (up or down); a pleasant but ordinary message keeps it about the same. Move more only if something big happens."""
    prompt = (
        f"PREVIOUS SCORE: {prev}\n\nDATE SO FAR\n{transcript_text(a, b, transcript)}\n\n"
        "Rate the chemistry now, with a 1-2 word label."
    )

    def mock() -> Dict[str, Any]:
        n = sum(ord(c) for c in transcript[-1]["text"])
        return {"score": max(0, min(100, prev + (n % 21) - 8)), "label": "warming up"}

    v = await llm.json(system, prompt, VIBE_SCHEMA, mock, 0.2)
    v = v if isinstance(v, dict) else {}
    return {"score": _clamp(v.get("score", prev)), "label": str(v.get("label") or "")[:24].lower()}


async def run_date(
    a: Profile,
    b: Profile,
    take_nudges: Callable[[str], Awaitable[List[str]]],
    on_turn: Callable[[List[Turn]], Awaitable[None]],
    venue: str = DEFAULT_VENUE,
) -> AsyncIterator[Dict[str, Any]]:
    """take_nudges(side): new coach whispers for that side. on_turn(transcript): persist progress.
    After each turn a chemistry rating runs in the background (in parallel with the next turn)
    and is streamed as a "vibe" event once ready."""
    transcript: List[Turn] = []
    pending: List[Tuple[int, "asyncio.Task[Dict[str, Any]]"]] = []
    last_score = 50

    def ready_vibes(wait_all: bool = False) -> List[Tuple[int, "asyncio.Task[Dict[str, Any]]"]]:
        out = []
        while pending and (wait_all or pending[0][1].done()):
            out.append(pending.pop(0))
        return out

    async def vibe_events(items: List[Tuple[int, "asyncio.Task[Dict[str, Any]]"]]) -> List[Dict[str, Any]]:
        nonlocal last_score
        evs = []
        for idx, task in items:
            try:
                v = await task
            except Exception:  # noqa: BLE001 - the meter is a nice-to-have; never break the date
                continue
            last_score = v["score"]
            transcript[idx]["vibe"] = v
            evs.append({"type": "vibe", "index": idx, "vibe": v})
        return evs

    for i in range(DATE_TURNS):
        side = "a" if i % 2 == 0 else "b"
        me, other = (a, b) if side == "a" else (b, a)
        yield {"type": "typing", "speaker": side}
        nudges = await take_nudges(side)
        text = await agent_turn(me, other, side, transcript, nudges, venue)
        turn: Turn = {"speaker": side, "text": text}
        if nudges:
            turn["nudged"] = True
        transcript.append(turn)
        for ev in await vibe_events(ready_vibes()):
            yield ev
        await on_turn(transcript)
        yield {"type": "turn", "turn": turn, "index": i}
        pending.append((i, asyncio.create_task(vibe(a, b, list(transcript), last_score))))

    for ev in await vibe_events(ready_vibes(wait_all=True)):
        yield ev
    await on_turn(transcript)


async def both_verdicts(a: Profile, b: Profile, transcript: List[Turn]) -> Tuple[Verdict, Verdict]:
    va, vb = await asyncio.gather(verdict(a, b, a, b, transcript), verdict(b, a, a, b, transcript))
    return va, vb


# ---------------------------------------------------------------------------
# 5. Wingman: after a match, help the human write their own first message
# ---------------------------------------------------------------------------


async def wingman(me: Profile, other: Profile, a: Profile, b: Profile, transcript: List[Turn]) -> List[str]:
    system = f"""You help {me['name']} write their FIRST real message to {other['name']}, after their AI agents went on a successful agent date.
Write 3 different short openers (max 25 words each) that {me['name']} could send, in {me['name']}'s voice ({me['voice']}).
Reference something specific from the agent date. One playful, one sincere, one that proposes a concrete real-life plan."""
    prompt = f"AGENT DATE TRANSCRIPT\n{transcript_text(a, b, transcript)}"
    res = await llm.json(
        system,
        prompt,
        {"type": "object", "properties": {"openers": {"type": "array", "items": {"type": "string"}}}, "required": ["openers"]},
        lambda: {
            "openers": [
                "[MOCK] So my agent says you have a spreadsheet for everything. Prove it.",
                "[MOCK] Our agents got along — want to see if we do too?",
                "[MOCK] Coffee this Saturday? I'll let you split the bill.",
            ]
        },
        0.9,
    )
    return [str(o) for o in (res.get("openers") or [])][:3]


# ---------------------------------------------------------------------------
# 6. After a match: ideas for the real first date
# ---------------------------------------------------------------------------

IDEAS_SCHEMA = {
    "type": "object",
    "properties": {
        "ideas": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "emoji": {"type": "string", "description": "One emoji for the idea"},
                    "title": {"type": "string", "description": "Short name, max 6 words"},
                    "plan": {"type": "string", "description": "What you'd actually do, 1-2 simple sentences"},
                    "why": {"type": "string", "description": "Why it fits these two, citing the agent date or profiles, 1 sentence"},
                    "cost": {"type": "string", "enum": ["free", "$", "$$", "$$$"]},
                },
                "required": ["emoji", "title", "plan", "why", "cost"],
            },
        }
    },
    "required": ["ideas"],
}


async def date_ideas(a: Profile, b: Profile, transcript: List[Turn]) -> List[Dict[str, str]]:
    """Three concrete ideas for the first REAL date, shared by both people in the match."""
    system = f"""{a['name']} and {b['name']} matched after their AI agents went on a date. Suggest 3 different ideas for their first REAL date.
- Base each idea on things they both like or joked about on the agent date. Be specific to these two people.
- Keep it realistic for where they live ({a['city']} / {b['city']}). Describe the kind of place; don't invent business names. If they live in different cities, make at least one idea work online or as a meet-in-the-middle plan.
- Respect both money styles: one idea free or very cheap, one mid-priced, and at most one that costs more.
- Never use anything from private notes. Simple, plain English."""
    prompt = f"{a['name'].upper()}\n{describe(a, False)}\n\n{b['name'].upper()}\n{describe(b, False)}\n\nAGENT DATE\n{transcript_text(a, b, transcript)}"
    res = await llm.json(
        system,
        prompt,
        IDEAS_SCHEMA,
        lambda: {
            "ideas": [
                {"emoji": "☕", "title": "[MOCK] Coffee walk", "plan": "Grab coffee and walk by the river.", "why": "You both like coffee.", "cost": "$"},
                {"emoji": "🥾", "title": "[MOCK] Easy hike", "plan": "A short morning hike with snacks.", "why": "You both like the outdoors.", "cost": "free"},
                {"emoji": "🍜", "title": "[MOCK] Cook together", "plan": "Pick a recipe and cook it together.", "why": "You joked about cooking.", "cost": "$$"},
            ]
        },
        0.9,
    )
    out = []
    for i in (res.get("ideas") or [])[:3] if isinstance(res, dict) else []:
        if isinstance(i, dict) and i.get("title") and i.get("plan"):
            cost = i.get("cost") if i.get("cost") in ("free", "$", "$$", "$$$") else "$"
            out.append({"emoji": str(i.get("emoji") or "✨")[:4], "title": str(i["title"]), "plan": str(i["plan"]), "why": str(i.get("why") or ""), "cost": cost})
    return out
