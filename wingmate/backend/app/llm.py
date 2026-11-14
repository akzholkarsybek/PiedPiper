"""
Gemini wrapper (google-genai).

- GEMINI_API_KEY: required for real AI. Without it the app runs in MOCK mode (for UI work only).
- GEMINI_MODEL: defaults to "gemini-flash-latest" (alias that tracks the newest Flash model).
- GEMINI_THINKING: "minimal" (default, fastest) | "low" | "off". Lower = faster dates.
"""

from __future__ import annotations

import asyncio
import json as _json
import os
import re
from typing import Any, Callable, Dict, List, Optional, TypeVar

from google import genai
from google.genai import types

T = TypeVar("T")

API_KEY = os.getenv("GEMINI_API_KEY")
MODEL = os.getenv("GEMINI_MODEL") or "gemini-flash-latest"


def _load_service_account() -> Optional[Dict[str, Any]]:
    """GOOGLE_SERVICE_ACCOUNT_JSON may be raw JSON, base64-encoded JSON, or a path to a key file."""
    import base64

    raw = (os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON") or "").strip().strip("'\"")
    if raw.startswith("GOOGLE_SERVICE_ACCOUNT_JSON="):  # tolerate a doubled "NAME=NAME=..." line
        raw = raw.split("=", 1)[1]
    if not raw:
        return None
    if raw.startswith("{"):
        return _json.loads(raw)
    if os.path.isfile(raw):
        with open(raw) as f:
            return _json.load(f)
    return _json.loads(base64.b64decode(raw + "=" * (-len(raw) % 4)).decode("utf-8"))


def _make_client() -> Optional["genai.Client"]:
    # 1. Gemini Developer API key
    if API_KEY:
        return genai.Client(api_key=API_KEY)
    # 2. Vertex AI (service account from env, or Application Default Credentials)
    project = os.getenv("GOOGLE_CLOUD_PROJECT")
    if not project:
        return None
    location = os.getenv("GOOGLE_CLOUD_LOCATION") or "global"
    info = _load_service_account()
    creds = None
    if info:
        from google.oauth2 import service_account

        creds = service_account.Credentials.from_service_account_info(
            info, scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
    return genai.Client(vertexai=True, project=project, location=location, credentials=creds)


_ai = _make_client()
MOCK = _ai is None
_thinking_supported = True


def _thinking_config() -> Optional[types.ThinkingConfig]:
    t = (os.getenv("GEMINI_THINKING") or "minimal").lower()
    if t == "off":
        return None
    try:
        # thinking_level needs a recent google-genai (Python 3.10+).
        return types.ThinkingConfig(thinking_level="LOW" if t == "low" else "MINIMAL")  # type: ignore[call-arg]
    except Exception:
        # Older SDKs: cap thinking with a token budget instead. Without a cap the model can spend
        # the whole max_output_tokens on hidden thinking and cut the visible reply off mid-sentence.
        return types.ThinkingConfig(thinking_budget=1024 if t == "low" else 256)


async def _generate(contents: List[Dict[str, Any]], config: Dict[str, Any]) -> str:
    global _thinking_supported
    if _ai is None:
        raise RuntimeError("No Gemini credentials (set GEMINI_API_KEY or GOOGLE_CLOUD_PROJECT)")
    last_err: Optional[BaseException] = None
    for attempt in range(4):
        try:
            cfg = dict(config)
            tc = _thinking_config() if _thinking_supported else None
            if tc is not None:
                cfg["thinking_config"] = tc
            res = await _ai.aio.models.generate_content(
                model=MODEL, contents=contents, config=types.GenerateContentConfig(**cfg)
            )
            text = (res.text or "").strip()
            if not text:
                raise RuntimeError("Empty response from Gemini")
            return text
        except Exception as err:  # noqa: BLE001
            last_err = err
            msg = str(err)
            # Some models don't accept thinkingLevel: drop it once and retry.
            if _thinking_supported and re.search(r"thinking", msg, re.I) and re.search(
                r"invalid|not supported|unknown", msg, re.I
            ):
                _thinking_supported = False
                continue
            # Rate limit / overload: back off and retry.
            if re.search(r"429|503|RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded", msg, re.I):
                await asyncio.sleep(1.2 * (attempt + 1))
                continue
            raise
    assert last_err is not None
    raise last_err


async def chat(system: str, history: List[Dict[str, str]], temperature: float = 1.0) -> str:
    """Multi-turn chat completion. history items are {"role": "user"|"model", "text": ...}, starting with "user"."""
    if MOCK:
        return _mock_chat(history)
    return await _generate(
        [{"role": h["role"], "parts": [{"text": h["text"]}]} for h in history],
        # Thinking tokens count against max_output_tokens, so leave plenty of headroom.
        # Reply length is controlled by the prompt, not by this cap.
        {"system_instruction": system, "temperature": temperature, "max_output_tokens": 2048},
    )


async def json(system: str, prompt: str, schema: Dict[str, Any], mock: Callable[[], T], temperature: float = 0.3) -> T:
    """Structured JSON output that follows a JSON schema."""
    if MOCK:
        return mock()
    text = await _generate(
        [{"role": "user", "parts": [{"text": prompt}]}],
        {
            "system_instruction": system,
            "temperature": temperature,
            "response_mime_type": "application/json",
            "response_json_schema": schema,
        },
    )
    return parse_json(text)


def parse_json(text: str) -> Any:
    cleaned = re.sub(r"```\s*$", "", re.sub(r"^```(?:json)?\s*", "", text, flags=re.I), flags=re.I).strip()
    try:
        return _json.loads(cleaned)
    except ValueError:
        start, end = cleaned.find("{"), cleaned.rfind("}")
        if start >= 0 and end > start:
            return _json.loads(cleaned[start : end + 1])
        raise ValueError("Model did not return valid JSON")


# ---------------- MOCK MODE (no API key): only so the UI can be built offline ----------------
_MOCK_LINES = [
    "[MOCK] So what does a perfect Sunday look like for you?",
    "[MOCK] Honestly? Farmers market, then absolutely nothing. You?",
    "[MOCK] A long run and an even longer brunch. Be honest — do you split the bill or fight for it?",
    "[MOCK] Split on date one, but I'm sneaky about grabbing dessert.",
    "[MOCK] Bold strategy. What's something you're saving up for right now?",
    "[MOCK] A trip to Japan. I have a spreadsheet. Is that a red flag?",
    "[MOCK] A spreadsheet is a green flag. Mine's for a down payment.",
    "[MOCK] Okay, we might actually get along.",
]


def _mock_chat(history: List[Dict[str, str]]) -> str:
    spoken = len([h for h in history if not h["text"].startswith("[The date")])
    return _MOCK_LINES[spoken % len(_MOCK_LINES)]
