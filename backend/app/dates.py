"""Dates, coach-mode nudges, matches, chat persistence."""

from __future__ import annotations

import time
from typing import Any, Dict, List, Optional

from . import store

DateRecord = Dict[str, Any]
Match = Dict[str, Any]


def now_ms() -> int:
    return int(time.time() * 1000)


async def create_date(a_id: str, b_id: str, venue: str = "cafe") -> DateRecord:
    d = {
        "id": store.new_id("date"),
        "aId": a_id,
        "bId": b_id,
        "venue": venue,
        "status": "pending",
        "transcript": [],
        "createdAt": now_ms(),
    }
    await save_date(d)
    await store.sadd(f"user:{a_id}:dates", d["id"])
    await store.sadd(f"user:{b_id}:dates", d["id"])
    return d


async def get_date(id: str) -> Optional[DateRecord]:
    return await store.get_json(f"date:{id}")


async def save_date(d: DateRecord) -> None:
    await store.set_json(f"date:{d['id']}", d)


async def list_dates_for(profile_id: str) -> List[DateRecord]:
    dates = [d for d in [await get_date(i) for i in await store.smembers(f"user:{profile_id}:dates")] if d]
    return sorted(dates, key=lambda d: d["createdAt"], reverse=True)


# Coach mode whispers
async def add_nudge(date_id: str, side: str, text: str) -> None:
    await store.rpush(f"nudges:{date_id}:{side}", text)


async def read_nudges(date_id: str, side: str) -> List[str]:
    return await store.lrange(f"nudges:{date_id}:{side}")


# Matches
async def create_match(d: DateRecord) -> Match:
    m = {"id": store.new_id("match"), "aId": d["aId"], "bId": d["bId"], "dateId": d["id"], "createdAt": now_ms()}
    await store.set_json(f"match:{m['id']}", m)
    await store.sadd(f"user:{d['aId']}:matches", m["id"])
    await store.sadd(f"user:{d['bId']}:matches", m["id"])
    return m


async def save_match(m: Match) -> None:
    await store.set_json(f"match:{m['id']}", m)


async def get_match(id: str) -> Optional[Match]:
    return await store.get_json(f"match:{id}")


async def list_matches_for(profile_id: str) -> List[Match]:
    return [m for m in [await get_match(i) for i in await store.smembers(f"user:{profile_id}:matches")] if m]


# Human chat after a match
async def get_messages(match_id: str) -> List[Dict[str, Any]]:
    return await store.lrange(f"chat:{match_id}")


async def add_message(match_id: str, sender: str, text: str) -> Dict[str, Any]:
    msg = {"id": store.new_id("msg"), "from": sender, "text": text[:1000], "at": now_ms()}
    await store.rpush(f"chat:{match_id}", msg)
    return msg
