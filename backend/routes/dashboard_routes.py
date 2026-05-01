"""Dashboard stats + finance summary with flexible date ranges."""
from datetime import datetime, timezone, timedelta
from collections import defaultdict
from fastapi import APIRouter, Depends, Query, HTTPException
from auth import get_current_user

router = APIRouter(prefix="/dashboard", tags=["dashboard"], dependencies=[Depends(get_current_user)])


def _strip_finance_for_role(role: str, payload: dict) -> dict:
    """Spectators do not see money. Strip finance keys from dashboard responses."""
    if role != "spectator":
        return payload
    out = dict(payload)
    out["revenue"] = {"range": 0, "total": 0, "currency": payload.get("revenue", {}).get("currency", "CZK")}
    out["profit"] = {"range": 0, "total": 0, "currency": "CZK"}
    return out


def _job_total(j):
    f = j.get("finance", {}) or {}
    return (f.get("labor_price", 0) or 0) + (f.get("parts_price", 0) or 0) - (f.get("discount", 0) or 0)


def _job_internal_cost(j):
    f = j.get("finance", {}) or {}
    return (f.get("parts_cost", 0) or 0) + (f.get("other_costs", 0) or 0)


def _job_profit(j):
    f = j.get("finance", {}) or {}
    paid = f.get("paid_amount", 0) or 0
    return paid - _job_internal_cost(j)


def _parse_iso(s):
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


def _range_bounds(range_key: str, from_str: str | None, to_str: str | None):
    """Resolve a named range (or custom from/to) to UTC [start, end] datetimes. None=open."""
    now = datetime.now(timezone.utc)
    r = (range_key or "6m").lower()
    if r == "custom":
        return _parse_iso(from_str), _parse_iso(to_str) or now
    if r in ("today", "day"):
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        return start, now
    if r == "week":
        start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        return start, now
    if r == "month":
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        return start, now
    if r == "year":
        start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        return start, now
    if r in ("all", "alltime", "all_time"):
        return None, now
    # default: last 6 months (rolling)
    start = (now - timedelta(days=182)).replace(hour=0, minute=0, second=0, microsecond=0)
    return start, now


def _in_range(dt, start, end):
    if not dt:
        return False
    if start and dt < start:
        return False
    if end and dt > end:
        return False
    return True


def _bucket_key(dt, granularity):
    if granularity == "day":
        return dt.strftime("%Y-%m-%d")
    if granularity == "week":
        iso = dt.isocalendar()
        return f"{iso.year}-W{iso.week:02d}"
    return f"{dt.year:04d}-{dt.month:02d}"


def _pick_granularity(start, end):
    if not start:
        return "month"
    days = (end - start).days if end else 30
    if days <= 31:
        return "day"
    if days <= 120:
        return "week"
    return "month"


@router.get("/stats")
async def get_stats(
    range: str = Query("6m", alias="range"),
    from_: str | None = Query(None, alias="from"),
    to: str | None = Query(None),
    user: dict = Depends(get_current_user),
):
    from server import db
    jobs = await db.jobs.find({}, {"_id": 0}).to_list(5000)
    active_statuses = {"New", "Diagnosing", "Waiting for Parts", "In Progress", "Testing", "Ready for Pickup"}
    active = sum(1 for j in jobs if j["status"] in active_statuses)
    completed = sum(1 for j in jobs if j["status"] == "Completed")
    cancelled = sum(1 for j in jobs if j["status"] == "Cancelled")
    unpaid = sum(1 for j in jobs if j.get("finance", {}).get("payment_status") in ("Unpaid", "Partial"))

    start, end = _range_bounds(range, from_, to)
    granularity = _pick_granularity(start, end)

    total_revenue = 0
    range_revenue = 0
    range_profit = 0
    total_profit = 0
    for j in jobs:
        paid = j.get("finance", {}).get("paid_amount", 0) or 0
        pd = _parse_iso(j.get("finance", {}).get("payment_date"))
        total_revenue += paid
        total_profit += _job_profit(j)
        if _in_range(pd, start, end):
            range_revenue += paid
            range_profit += _job_profit(j)

    by_status = defaultdict(int)
    by_category = defaultdict(int)
    for j in jobs:
        by_status[j["status"]] += 1
        by_category[j["category"]] += 1

    # Recent activity: last 12 timeline entries across all jobs
    activity = []
    for j in jobs:
        for entry in j.get("timeline", []):
            activity.append({**entry, "job_id": j["id"], "job_code": j.get("code"), "job_title": j["title"]})
    activity.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    activity = activity[:12]

    clients = await db.clients.find({}, {"_id": 0}).sort("created_at", -1).to_list(6)
    devices = await db.devices.find({}, {"_id": 0}).sort("created_at", -1).to_list(6)

    upcoming = []
    for j in jobs:
        if j["status"] in active_statuses and j.get("deadline"):
            upcoming.append({
                "id": j["id"], "code": j.get("code"), "title": j["title"],
                "deadline": j["deadline"], "status": j["status"], "priority": j["priority"],
            })
    upcoming.sort(key=lambda x: x["deadline"] or "")
    upcoming = upcoming[:8]

    # Revenue series for the chart, bucketed by granularity
    buckets = defaultdict(float)
    for j in jobs:
        paid = j.get("finance", {}).get("paid_amount", 0) or 0
        pd = _parse_iso(j.get("finance", {}).get("payment_date"))
        if pd and _in_range(pd, start, end) and paid:
            buckets[_bucket_key(pd, granularity)] += paid
    series = [{"bucket": k, "revenue": v} for k, v in sorted(buckets.items())]

    return _strip_finance_for_role(user.get("role", "admin"), {
        "counts": {"active": active, "completed": completed, "unpaid": unpaid, "cancelled": cancelled, "total": len(jobs)},
        "revenue": {"range": range_revenue, "total": total_revenue, "currency": "CZK"},
        "profit": {"range": range_profit, "total": total_profit, "currency": "CZK"},
        "range": {"key": range, "from": start.isoformat() if start else None, "to": end.isoformat() if end else None, "granularity": granularity},
        "series": series,
        "by_status": dict(by_status),
        "by_category": dict(by_category),
        "recent_activity": activity,
        "recent_clients": clients,
        "recent_devices": devices,
        "upcoming": upcoming,
    })


@router.get("/finance")
async def get_finance(
    range: str = Query("6m", alias="range"),
    from_: str | None = Query(None, alias="from"),
    to: str | None = Query(None),
    user: dict = Depends(get_current_user),
):
    if (user.get("role") or "admin") == "spectator":
        raise HTTPException(403, "Insufficient permissions")
    from server import db
    jobs = await db.jobs.find({}, {"_id": 0}).to_list(5000)
    start, end = _range_bounds(range, from_, to)
    granularity = _pick_granularity(start, end)

    total_revenue = 0
    total_profit = 0
    total_internal_cost = 0
    unpaid_total = 0
    paid_jobs = []
    unpaid_jobs = []
    by_category = defaultdict(lambda: {"revenue": 0, "profit": 0, "count": 0})
    buckets = defaultdict(lambda: {"revenue": 0.0, "profit": 0.0})
    avg_total = 0
    avg_count = 0

    for j in jobs:
        f = j.get("finance", {}) or {}
        pd = _parse_iso(f.get("payment_date"))
        paid = f.get("paid_amount", 0) or 0
        total = _job_total(j)
        internal = _job_internal_cost(j)
        profit = paid - internal
        in_r = _in_range(pd, start, end) if pd else False

        if f.get("payment_status") == "Paid" and in_r:
            paid_jobs.append({"id": j["id"], "code": j.get("code"), "title": j["title"],
                              "amount": paid, "profit": profit, "date": f.get("payment_date"), "category": j["category"]})
            total_revenue += paid
            total_profit += profit
            total_internal_cost += internal
            by_category[j["category"]]["revenue"] += paid
            by_category[j["category"]]["profit"] += profit
            by_category[j["category"]]["count"] += 1
            if total > 0:
                avg_total += total
                avg_count += 1
            if pd:
                key = _bucket_key(pd, granularity)
                buckets[key]["revenue"] += paid
                buckets[key]["profit"] += profit
        elif f.get("payment_status") in ("Unpaid", "Partial"):
            outstanding = max(total - paid, 0)
            if outstanding > 0:
                unpaid_total += outstanding
                unpaid_jobs.append({"id": j["id"], "code": j.get("code"), "title": j["title"],
                                    "amount": outstanding, "status": f.get("payment_status", "Unpaid"),
                                    "category": j["category"]})

    avg_value = (avg_total / avg_count) if avg_count else 0
    avg_profit = (total_profit / avg_count) if avg_count else 0
    series = [{"bucket": k, "revenue": v["revenue"], "profit": v["profit"]} for k, v in sorted(buckets.items())]

    return {
        "total_revenue": total_revenue,
        "total_profit": total_profit,
        "total_internal_cost": total_internal_cost,
        "unpaid_total": unpaid_total,
        "paid_count": len(paid_jobs),
        "unpaid_count": len(unpaid_jobs),
        "avg_job_value": avg_value,
        "avg_profit": avg_profit,
        "by_category": [{"category": k, **v} for k, v in by_category.items()],
        "series": series,
        "unpaid_jobs": sorted(unpaid_jobs, key=lambda x: -x["amount"])[:50],
        "paid_jobs": sorted(paid_jobs, key=lambda x: x.get("date") or "", reverse=True)[:50],
        "range": {"key": range, "from": start.isoformat() if start else None, "to": end.isoformat() if end else None, "granularity": granularity},
        "currency": "CZK",
    }
