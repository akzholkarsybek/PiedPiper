"""
Tiny key-value store.

- Production: set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (free Upstash Redis)
  (or the KV_REST_API_* equivalents). Required if you run more than one server process/instance.
- Local dev / single process: falls back to in-memory, saved to a small JSON file
  (backend/.data/store.json) so accounts and dates survive a restart.
  Set WINGMATE_DATA_FILE to another path, or to "off" for pure in-memory.
"""

from __future__ import annotations

import json
import os
import uuid
from pathlib import Path
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

_file_env = os.getenv("WINGMATE_DATA_FILE") or ""
_FILE: Optional[Path] = (
    None
    if using_redis or _file_env.lower() == "off"
    else Path(_file_env) if _file_env else Path(__file__).resolve().parent.parent / ".data" / "store.json"
)


def _load() -> None:
    if not _FILE or not _FILE.exists():
        return
    try:
        data = json.loads(_FILE.read_text(encoding="utf-8"))
        _kv.update(data.get("kv", {}))
        _sets.update({k: set(v) for k, v in data.get("sets", {}).items()})
        _lists.update(data.get("lists", {}))
    except (OSError, ValueError):
        pass  # unreadable file: start empty rather than crash


def _save() -> None:
    if not _FILE:
        return
    try:
        _FILE.parent.mkdir(parents=True, exist_ok=True)
        tmp = _FILE.with_suffix(".tmp")
        tmp.write_text(
            json.dumps({"kv": _kv, "sets": {k: sorted(v) for k, v in _sets.items()}, "lists": _lists}),
            encoding="utf-8",
        )
        tmp.replace(_FILE)  # atomic: never leaves a half-written file
    except OSError:
        pass


_load()


async def get_json(key: str) -> Optional[Any]:
    raw = await _redis("GET", key) if using_redis else _kv.get(key)
    return json.loads(raw) if raw else None


async def set_json(key: str, value: Any) -> None:
    raw = json.dumps(value)
    if using_redis:
        await _redis("SET", key, raw)
    else:
        _kv[key] = raw
        _save()


async def sadd(key: str, member: str) -> None:
    if using_redis:
        await _redis("SADD", key, member)
    else:
        _sets.setdefault(key, set()).add(member)
        _save()


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
        _save()


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
        _save()


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"
