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

# ---------------------------------------------------------------------------
# 1. The agent persona prompt
# ---------------------------------------------------------------------------


def describe(p: Profile, include_private: bool) -> str:
    m = p["money"]
    lines = [
        f"Name: {p['name']}, {p['age']}, {p['gender']}, lives in {p['city']}",
        f"Job: {p['occupation']}",
        f"Bio: {p['bio']}",
        f"Looking for: {p['intent']} relationship",
        f"Values: {', '.join(p['values'])}",
        f"Interests: {', '.join(p['interests'])}",
        f"Dealbreakers: {', '.join(p['dealbreakers']) or 'none stated'}",
        f"Money style: {m['style']}. Bill: {m['splitBill']}. Debt: {m['debtAttitude']}. Goals: {m['goals']}",
        f"KEEP PRIVATE (never reveal on this date): {p['privateNotes']}" if include_private and p.get("privateNotes") else "",
    ]
    return "\n".join(x for x in lines if x)


def agent_system(me: Profile, other: Profile, turn_no: int, nudges: List[str]) -> str:
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


async def agent_turn(me: Profile, other: Profile, my_side: str, transcript: List[Turn], nudges: List[str]) -> str:
    # My messages = "model", their messages = "user". Gemini history must start with "user".
    history = [{"role": "model" if t["speaker"] == my_side else "user", "text": t["text"]} for t in transcript]
    if not history or history[0]["role"] == "model":
        history.insert(
            0,
            {
                "role": "user",
                "text": f"[The date begins at a cozy cafe. You arrived first. Say a simple, friendly hi to {other['name']} and mention one thing about them you're curious about.]",
            },
        )
    if history[-1]["role"] == "model":
        # Should not happen with strict alternation, but keep the API happy.
        history.append({"role": "user", "text": "[continue]"})
    text = await llm.chat(agent_system(me, other, len(transcript), nudges), history, 1.0)
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


async def run_date(
    a: Profile,
    b: Profile,
    take_nudges: Callable[[str], Awaitable[List[str]]],
    on_turn: Callable[[List[Turn]], Awaitable[None]],
) -> AsyncIterator[Dict[str, Any]]:
    """take_nudges(side): new coach whispers for that side. on_turn(transcript): persist progress."""
    transcript: List[Turn] = []
    for i in range(DATE_TURNS):
        side = "a" if i % 2 == 0 else "b"
        me, other = (a, b) if side == "a" else (b, a)
        yield {"type": "typing", "speaker": side}
        nudges = await take_nudges(side)
        text = await agent_turn(me, other, side, transcript, nudges)
        turn: Turn = {"speaker": side, "text": text}
        if nudges:
            turn["nudged"] = True
        transcript.append(turn)
        await on_turn(transcript)
        yield {"type": "turn", "turn": turn, "index": i}


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
