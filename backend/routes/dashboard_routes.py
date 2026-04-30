"""Dashboard stats + finance summary."""
from datetime import datetime, timezone, timedelta
from collections import defaultdict
from fastapi import APIRouter, Depends
from auth import get_current_user

router = APIRouter(prefix="/dashboard", tags=["dashboard"], dependencies=[Depends(get_current_user)])


def _job_total(j):
    f = j.get("finance", {}) or {}
    return (f.get("labor_price", 0) or 0) + (f.get("parts_price", 0) or 0) - (f.get("discount", 0) or 0)


@router.get("/stats")
async def get_stats():
    from server import db
    jobs = await db.jobs.find({}, {"_id": 0}).to_list(5000)
    active_statuses = {"New", "Diagnosing", "Waiting for Parts", "In Progress", "Testing", "Ready for Pickup"}
    active = sum(1 for j in jobs if j["status"] in active_statuses)
    completed = sum(1 for j in jobs if j["status"] == "Completed")
    cancelled = sum(1 for j in jobs if j["status"] == "Cancelled")
    unpaid = sum(1 for j in jobs if j.get("finance", {}).get("payment_status") in ("Unpaid", "Partial"))

    total_revenue = sum(j.get("finance", {}).get("paid_amount", 0) or 0 for j in jobs)
    now = datetime.now(timezone.utc)
    monthly = 0
    for j in jobs:
        pd = j.get("finance", {}).get("payment_date")
        if pd:
            try:
                d = datetime.fromisoformat(pd.replace("Z", "+00:00"))
                if d.year == now.year and d.month == now.month:
                    monthly += j.get("finance", {}).get("paid_amount", 0) or 0
            except Exception:
                pass

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

    # Recent clients
    clients = await db.clients.find({}, {"_id": 0}).sort("created_at", -1).to_list(6)
    devices = await db.devices.find({}, {"_id": 0}).sort("created_at", -1).to_list(6)

    # Upcoming deadlines (active jobs with deadlines in future or overdue)
    upcoming = []
    for j in jobs:
        if j["status"] in active_statuses and j.get("deadline"):
            upcoming.append({
                "id": j["id"], "code": j.get("code"), "title": j["title"],
                "deadline": j["deadline"], "status": j["status"], "priority": j["priority"],
            })
    upcoming.sort(key=lambda x: x["deadline"] or "")
    upcoming = upcoming[:8]

    return {
        "counts": {"active": active, "completed": completed, "unpaid": unpaid, "cancelled": cancelled, "total": len(jobs)},
        "revenue": {"monthly": monthly, "total": total_revenue, "currency": "CZK"},
        "by_status": dict(by_status),
        "by_category": dict(by_category),
        "recent_activity": activity,
        "recent_clients": clients,
        "recent_devices": devices,
        "upcoming": upcoming,
    }


@router.get("/finance")
async def get_finance():
    from server import db
    jobs = await db.jobs.find({}, {"_id": 0}).to_list(5000)
    total_revenue = sum(j.get("finance", {}).get("paid_amount", 0) or 0 for j in jobs)
    unpaid_total = 0
    paid_jobs = []
    unpaid_jobs = []
    by_category = defaultdict(lambda: {"revenue": 0, "count": 0})
    monthly = defaultdict(float)
    avg_total = 0
    avg_count = 0
    for j in jobs:
        f = j.get("finance", {}) or {}
        total = _job_total(j)
        paid = f.get("paid_amount", 0) or 0
        if f.get("payment_status") == "Paid":
            paid_jobs.append({"id": j["id"], "code": j.get("code"), "title": j["title"], "amount": paid, "date": f.get("payment_date"), "category": j["category"]})
        else:
            unpaid_total += max(total - paid, 0)
            unpaid_jobs.append({"id": j["id"], "code": j.get("code"), "title": j["title"], "amount": total - paid, "status": f.get("payment_status", "Unpaid"), "category": j["category"]})
        if total > 0:
            avg_total += total
            avg_count += 1
        by_category[j["category"]]["revenue"] += paid
        by_category[j["category"]]["count"] += 1
        pd = f.get("payment_date")
        if pd and paid:
            try:
                d = datetime.fromisoformat(pd.replace("Z", "+00:00"))
                key = f"{d.year:04d}-{d.month:02d}"
                monthly[key] += paid
            except Exception:
                pass
    avg_value = (avg_total / avg_count) if avg_count else 0
    # last 6 months
    now = datetime.now(timezone.utc)
    months = []
    for i in range(5, -1, -1):
        m = (now.month - i - 1) % 12 + 1
        y = now.year + ((now.month - i - 1) // 12)
        key = f"{y:04d}-{m:02d}"
        months.append({"month": key, "revenue": monthly.get(key, 0)})
    return {
        "total_revenue": total_revenue,
        "unpaid_total": unpaid_total,
        "paid_count": len(paid_jobs),
        "unpaid_count": len(unpaid_jobs),
        "avg_job_value": avg_value,
        "by_category": [{"category": k, **v} for k, v in by_category.items()],
        "monthly": months,
        "unpaid_jobs": sorted(unpaid_jobs, key=lambda x: -x["amount"])[:20],
        "paid_jobs": sorted(paid_jobs, key=lambda x: x.get("date") or "", reverse=True)[:20],
        "currency": "CZK",
    }
