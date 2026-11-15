"""Who to ask to cover each gap. Pure: no database, no clock.

The rule, plain enough to check by hand:

- A person can cover a gap when they are active, have the role (an
  interpreter must speak the gap's language), work at that airport, are not
  already asked for or working an overlapping time, and the gap's hours keep
  them within their weekly limit.
- Among those, the fewest hours this week go first (then by name), so work is
  shared fairly. Exactly as many as are short are asked; someone who declines
  or does not answer is replaced by the next person, on the next round.
- Gaps are filled soonest first, and each pick counts against later gaps.
- What nobody can cover is reported as `missing`, for a supervisor.

The web app's sample mode uses the same rule (frontend/src/domain/dispatch.ts);
both sides run the cases in sample/dispatch_cases.json.
"""
from __future__ import annotations

from datetime import datetime

MODES = ("off", "approve", "auto")
ROLES = ("interpreter", "wheelchair", "bus")
STATUSES = ("asked", "accepted", "declined", "expired", "cancelled", "arrived")
# asked or working: they hold the time, and count toward the shift on the board
HOLDING = ("asked", "accepted", "arrived")
# said yes: they count as confirmed
CONFIRMED = ("accepted", "arrived")


def _t(v) -> datetime:
    return v if isinstance(v, datetime) else datetime.fromisoformat(str(v).replace("Z", "+00:00"))


def _hours(start, end) -> float:
    return (_t(end) - _t(start)).total_seconds() / 3600


def can_cover(w: dict, gap: dict, busy: dict, hours: dict) -> bool:
    if not w.get("active", True) or gap["kind"] not in w["roles"]:
        return False
    if gap["kind"] == "interpreter" and gap.get("language") not in w.get("languages", []):
        return False
    if gap["airport"] not in w["airports"]:
        return False
    s, e = _t(gap["start"]), _t(gap["end"])
    if any(_t(a) < e and s < _t(b) for a, b in busy.get(w["id"], [])):
        return False
    return hours.get(w["id"], 0) + _hours(s, e) <= w["max_hours_week"]


def plan(gaps: list[dict], workers: list[dict], busy: dict | None = None, hours: dict | None = None) -> list[dict]:
    """One item per gap: who to ask (`ask`, worker ids) and how many nobody can cover (`missing`).
    A gap may name people not to ask again (`exclude`: already on that shift, or said no)."""
    busy = {k: list(v) for k, v in (busy or {}).items()}
    hours = dict(hours or {})
    out = []
    for g in sorted(gaps, key=lambda g: (str(_t(g["start"])), g["airport"], g["kind"], g.get("language") or "")):
        skip = set(g.get("exclude") or [])
        fit = [w for w in workers if w["id"] not in skip and can_cover(w, g, busy, hours)]
        fit.sort(key=lambda w: (hours.get(w["id"], 0), w["name"]))
        picks = fit[: g["short"]]
        for w in picks:
            busy.setdefault(w["id"], []).append((g["start"], g["end"]))
            hours[w["id"]] = hours.get(w["id"], 0) + _hours(g["start"], g["end"])
        out.append({**{k: g.get(k) for k in ("airport", "kind", "language", "start", "end", "short", "shift_id")},
                    "ask": [w["id"] for w in picks], "missing": g["short"] - len(picks)})
    return out
