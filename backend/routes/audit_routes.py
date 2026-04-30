"""Audit log read-only API."""
from typing import Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Query
from auth import get_current_user

router = APIRouter(prefix="/audit", tags=["audit"], dependencies=[Depends(get_current_user)])


def _parse_iso(s: Optional[str]):
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


def _range_bounds(range_key: Optional[str], from_str: Optional[str], to_str: Optional[str]):
    """Mirror dashboard_routes' range semantics so the RangePicker works the same way here."""
    now = datetime.now(timezone.utc)
    r = (range_key or "").lower()
    if r == "custom":
        return _parse_iso(from_str), _parse_iso(to_str) or now
    if r in ("today", "day"):
        return now.replace(hour=0, minute=0, second=0, microsecond=0), now
    if r == "week":
        return (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0), now
    if r == "month":
        return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0), now
    if r == "year":
        return now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0), now
    if r == "6m":
        return (now - timedelta(days=182)).replace(hour=0, minute=0, second=0, microsecond=0), now
    if r in ("all", "alltime", "all_time"):
        return None, None
    return None, None  # default: no time filter


@router.get("")
async def list_audit(
    event: Optional[str] = None,
    user_id: Optional[str] = None,
    username: Optional[str] = None,
    q: Optional[str] = None,
    range: Optional[str] = Query(None, alias="range"),
    from_: Optional[str] = Query(None, alias="from"),
    to: Optional[str] = Query(None),
    limit: int = 200,
):
    from server import db
    query: dict = {}
    if event:
        query["event"] = event
    if user_id:
        query["user_id"] = user_id
    if username:
        query["username"] = username

    start, end = _range_bounds(range, from_, to)
    if start or end:
        time_q = {}
        if start:
            time_q["$gte"] = start.isoformat()
        if end:
            time_q["$lte"] = end.isoformat()
        if time_q:
            query["created_at"] = time_q

    if q:
        # case-insensitive substring across the human-readable fields
        rx = {"$regex": q, "$options": "i"}
        query["$or"] = [
            {"username": rx}, {"entity_label": rx}, {"entity_id": rx},
            {"event": rx}, {"ip": rx},
        ]

    cur = db.audit_log.find(query, {"_id": 0}).sort("created_at", -1).limit(min(max(limit, 1), 1000))
    return await cur.to_list(1000)


@router.get("/meta")
async def audit_meta():
    """Distinct events + users for filter dropdowns."""
    from server import db
    events = await db.audit_log.distinct("event")
    usernames = await db.audit_log.distinct("username")
    users = [{"username": u} for u in sorted(u for u in usernames if u)]
    return {"events": sorted(e for e in events if e), "users": users}
