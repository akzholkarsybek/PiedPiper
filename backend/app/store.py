"""
Tiny key-value store.

- Production: set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (free Upstash Redis)
  (or the KV_REST_API_* equivalents). Required if you run more than one server process/instance.
- Local dev / single process: falls back to in-memory (lost on restart).
"""

from __future__ import annotations

import json
import os
import uuid
from typing import Any, Dict, List, Optional, Set

import httpx

_URL = os.getenv("UPSTASH_REDIS_REST_URL") or os.getenv("KV_REST_API_URL")
_TOKEN = os.getenv("UPSTASH_REDIS_REST_TOKEN") or os.getenv("KV_REST_API_TOKEN")
using_redis = bool(_URL and _TOKEN)

_client: Optional[httpx.AsyncClient] = None


async def _redis(*cmd: Any) -> Any:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=15)
    res = await _client.post(
        _URL,  # type: ignore[arg-type]
        headers={"Authorization": f"Bearer {_TOKEN}"},
        json=[str(c) for c in cmd],
    )
    data = res.json()
    if res.status_code >= 400 or data.get("error"):
        raise RuntimeError(f"Redis error: {data.get('error') or res.status_code}")
    return data.get("result")


# ---------- in-memory fallback ----------
_kv: Dict[str, str] = {}
_sets: Dict[str, Set[str]] = {}
_lists: Dict[str, List[str]] = {}


async def get_json(key: str) -> Optional[Any]:
    raw = await _redis("GET", key) if using_redis else _kv.get(key)
    return json.loads(raw) if raw else None


async def set_json(key: str, value: Any) -> None:
    raw = json.dumps(value)
    if using_redis:
        await _redis("SET", key, raw)
    else:
        _kv[key] = raw


async def sadd(key: str, member: str) -> None:
    if using_redis:
        await _redis("SADD", key, member)
    else:
        _sets.setdefault(key, set()).add(member)


async def smembers(key: str) -> List[str]:
    if using_redis:
        return (await _redis("SMEMBERS", key)) or []
    return list(_sets.get(key, set()))


async def rpush(key: str, value: Any) -> None:
    raw = json.dumps(value)
    if using_redis:
        await _redis("RPUSH", key, raw)
    else:
        _lists.setdefault(key, []).append(raw)


async def lrange(key: str, start: int = 0, stop: int = -1) -> List[Any]:
    if using_redis:
        raw = (await _redis("LRANGE", key, start, stop)) or []
    else:
        items = _lists.get(key, [])
        raw = items[start:] if stop == -1 else items[start : stop + 1]
    return [json.loads(r) for r in raw]


async def delete(key: str) -> None:
    if using_redis:
        await _redis("DEL", key)
    else:
        _kv.pop(key, None)
        _lists.pop(key, None)
        _sets.pop(key, None)


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"
