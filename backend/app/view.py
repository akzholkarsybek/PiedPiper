"""Privacy: what each viewer may see (never the other human's private verdict or notes)."""

from __future__ import annotations

from typing import Any, Dict, Optional

from .profiles import public_profile


def view_date(d: Dict[str, Any], a: Dict[str, Any], b: Dict[str, Any], viewer_id: Optional[str]) -> Dict[str, Any]:
    """
    - Your own agent's verdict: always.
    - The other agent's verdict: only if the other side is a demo profile (no human behind it).
      For real people you only learn "it's a match", exactly like a normal dating app.
    """
    viewer_side = "a" if viewer_id == d["aId"] else "b" if viewer_id == d["bId"] else None

    def show(side: str, v: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        if not v:
            return None
        if viewer_side == side:
            return v
        owner = a if side == "a" else b
        return v if owner["isSeed"] else None

    return {
        "id": d["id"],
        "status": d["status"],
        "transcript": d["transcript"],
        "a": public_profile(a),
        "b": public_profile(b),
        "viewerSide": viewer_side,
        "verdictA": show("a", d.get("verdictA")),
        "verdictB": show("b", d.get("verdictB")),
        "matchId": d.get("matchId"),
        "createdAt": d["createdAt"],
    }
