"""Onboarding answers -> agent persona (structured output)."""

from __future__ import annotations

import math
import re
from typing import Any, Dict, List

from . import llm, store
from .dates import now_ms

SCHEMA = {
    "type": "object",
    "properties": {
        "bio": {"type": "string", "description": "Witty one-line public dating bio in their voice, max 25 words"},
        "voice": {"type": "string", "description": "How their agent should talk: humor, energy, quirks. 1-2 sentences."},
        "values": {"type": "array", "items": {"type": "string"}, "description": "3 core values, 1-3 words each"},
        "interests": {"type": "array", "items": {"type": "string"}, "description": "3-6 concrete interests"},
        "dealbreakers": {"type": "array", "items": {"type": "string"}},
        "money": {
            "type": "object",
            "properties": {
                "style": {"type": "string", "enum": ["saver", "balanced", "spender"]},
                "splitBill": {"type": "string"},
                "debtAttitude": {"type": "string"},
                "goals": {"type": "string"},
            },
            "required": ["style", "splitBill", "debtAttitude", "goals"],
        },
        "privateNotes": {"type": "string", "description": "Things they asked to keep private. Empty string if none."},
    },
    "required": ["bio", "voice", "values", "interests", "dealbreakers", "money", "privateNotes"],
}

MONEY_STYLES = ("saver", "balanced", "spender")


async def build_profile(inp: Dict[str, Any]) -> Dict[str, Any]:
    """Turns onboarding answers into the persona their agent will use. Only uses what the user said."""
    system = """You turn a dating-app user's onboarding answers into a profile for their personal AI agent.
Only use information the user actually gave. Do not invent facts, jobs, hobbies or history. Keep their wording and personality.
For money.style choose saver / balanced / spender from their money answer."""
    prompt = "\n".join(f"{k}: {v}" for k, v in inp.items())

    g = await llm.json(system, prompt, SCHEMA, lambda: _mock_generate(inp), 0.5)
    money = g.get("money") or {}

    return {
        "id": store.new_id("usr"),
        "name": inp["name"].strip()[:40] or "Anonymous",
        "age": clamp_age(inp["age"]),
        "gender": inp["gender"],
        "lookingFor": inp["lookingFor"],
        "ageMin": clamp_age(inp["ageMin"]),
        "ageMax": clamp_age(inp["ageMax"]),
        "city": inp["city"].strip()[:60],
        "intent": inp["intent"],
        "occupation": inp["occupation"].strip()[:80],
        "bio": g.get("bio", ""),
        "voice": g.get("voice", ""),
        "values": (g.get("values") or [])[:4],
        "interests": (g.get("interests") or [])[:6],
        "dealbreakers": (g.get("dealbreakers") or [])[:4],
        "money": {
            "style": money.get("style") if money.get("style") in MONEY_STYLES else "balanced",
            "splitBill": money.get("splitBill") or "",
            "debtAttitude": money.get("debtAttitude") or "",
            "goals": money.get("goals") or "",
        },
        "privateNotes": g.get("privateNotes") or "",
        "isSeed": False,
        "createdAt": now_ms(),
    }


def clamp_age(n: Any) -> int:
    try:
        x = float(n)
    except (TypeError, ValueError):
        return 30
    if not math.isfinite(x):
        return 30
    return max(18, min(99, math.floor(x + 0.5)))


def _split_list(s: str) -> List[str]:
    return [x.strip() for x in re.split(r"[,;\n]", s) if x.strip()]


def _mock_generate(i: Dict[str, Any]) -> Dict[str, Any]:
    m = i["moneyHabits"].lower()
    style = (
        "saver"
        if re.search(r"save|budget|frugal|invest", m)
        else "spender"
        if re.search(r"spend|treat|splurge|yolo", m)
        else "balanced"
    )
    weekend = _split_list(i["idealWeekend"])[:4]
    return {
        "bio": i["aboutMe"][:120] or "[MOCK] Bio",
        "voice": i["humor"] or "Friendly and curious.",
        "values": ["honesty", "kindness", "humor"],
        "interests": weekend or ["coffee", "travel"],
        "dealbreakers": _split_list(i["dealbreakers"]),
        "money": {
            "style": style,
            "splitBill": i["moneyHabits"] or "Splits",
            "debtAttitude": i["moneyHabits"],
            "goals": i["moneyHabits"],
        },
        "privateNotes": i["keepPrivate"],
    }
