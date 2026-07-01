"""Jobs routes — full CRUD + nested timeline/checklist/finance/secrets/attachments."""
from fastapi import APIRouter, HTTPException, Depends, Request
from auth import get_current_user, client_ip, user_agent, require_min_role, require_role
from audit import log_event
from models import (
    Job, JobIn, ChecklistItem, ChecklistItemIn, TimelineEntry, TimelineEntryIn,
    FinanceInfo, SecretIn, SecretItem, new_id, now_iso,
)
from crypto_utils import encrypt_secret, decrypt_secret, mask_secret
from fastapi import Query
from fastapi.responses import Response
from report_pdf import render_report_pdf

router = APIRouter(prefix="/jobs", tags=["jobs"], dependencies=[Depends(get_current_user)])


async def _next_code(db) -> str:
    last = await db.jobs.find_one({}, {"_id": 0, "code": 1}, sort=[("created_at", -1)])
    n = 1
    if last and last.get("code", "").startswith("HL-"):
        try:
            n = int(last["code"].split("-")[1]) + 1
        except Exception:
            n = await db.jobs.count_documents({}) + 1
    else:
        n = await db.jobs.count_documents({}) + 1
    return f"HL-{n:04d}"


def _redact_secrets(job: dict) -> dict:
    """Return job without revealing secret values."""
    out = {**job}
    out["secrets"] = [
        {"id": s["id"], "label": s["label"],
         "created_at": s["created_at"],
         "updated_at": s.get("updated_at", s["created_at"]),
         "masked": mask_secret(s["encrypted_value"])}
        for s in job.get("secrets", [])
    ]
    return out


@router.get("")
async def list_jobs(status: str | None = None, category: str | None = None,
                    payment_status: str | None = None, client_id: str | None = None,
                    device_id: str | None = None):
    from server import db
    q = {}
    if status: q["status"] = status
    if category: q["category"] = category
    if payment_status: q["finance.payment_status"] = payment_status
    if client_id: q["client_id"] = client_id
    if device_id: q["device_id"] = device_id
    items = await db.jobs.find(q, {"_id": 0}).sort("created_at", -1).to_list(2000)
    # Enrich with client name and device name
    for j in items:
        if j.get("client_id"):
            c = await db.clients.find_one({"id": j["client_id"]}, {"_id": 0, "full_name": 1})
            j["client_name"] = c["full_name"] if c else None
        if j.get("device_id"):
            d = await db.devices.find_one({"id": j["device_id"]}, {"_id": 0, "name": 1})
            j["device_name"] = d["name"] if d else None
        j.pop("secrets", None)
    return items


@router.post("")
async def create_job(payload: JobIn, user: dict = Depends(require_min_role("collaborator"))):
    from server import db
    code = await _next_code(db)
    job = Job(**payload.model_dump(), code=code)
    # If client provided a template, auto-fill checklist from template if checklist is empty
    if payload.template_id and not payload.checklist:
        tpl = await db.templates.find_one({"id": payload.template_id}, {"_id": 0})
        if tpl:
            job.checklist = [ChecklistItem(text=t) for t in tpl.get("checklist", [])]
    doc = job.model_dump()
    await db.jobs.insert_one(doc)
    doc.pop("_id", None)
    return _redact_secrets(doc)


@router.get("/{job_id}")
async def get_job(job_id: str):
    from server import db
    j = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not j:
        raise HTTPException(404, "Job not found")
    if j.get("client_id"):
        j["client"] = await db.clients.find_one({"id": j["client_id"]}, {"_id": 0})
    if j.get("device_id"):
        j["device"] = await db.devices.find_one({"id": j["device_id"]}, {"_id": 0})
    if j.get("template_id"):
        j["template"] = await db.templates.find_one({"id": j["template_id"]}, {"_id": 0})
    return _redact_secrets(j)


@router.get("/{job_id}/report.pdf")
async def job_report_pdf(
    job_id: str,
    prices: bool = Query(True),
    checklist: bool = Query(True),
    photos: bool = Query(True),
    user: dict = Depends(require_min_role("collaborator")),
):
    """Server-side Customer Job Sheet PDF. Mirrors the print view exactly.
    Secrets / internal_notes / audit data are never included."""
    from server import db
    j = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not j:
        raise HTTPException(404, "Job not found")
    client = await db.clients.find_one({"id": j["client_id"]}, {"_id": 0}) if j.get("client_id") else None
    device = await db.devices.find_one({"id": j["device_id"]}, {"_id": 0}) if j.get("device_id") else None
    settings = await db.settings.find_one({"_id": "app"})
    opts = {"prices": prices, "checklist": checklist, "photos": photos}
    pdf = render_report_pdf(j, client, device, settings, opts)
    fname = f"{(j.get('code') or 'report')}-job-sheet.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{fname}"',
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.put("/{job_id}")
async def update_job(job_id: str, payload: JobIn, user: dict = Depends(require_min_role("collaborator"))):
    from server import db
    update = payload.model_dump()
    update["updated_at"] = now_iso()
    res = await db.jobs.update_one({"id": job_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Job not found")
    j = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    return _redact_secrets(j)


@router.delete("/{job_id}")
async def delete_job(job_id: str, request: Request, user: dict = Depends(require_role("admin"))):
    from server import db
    j = await db.jobs.find_one({"id": job_id}, {"_id": 0, "title": 1, "code": 1})
    res = await db.jobs.delete_one({"id": job_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Job not found")
    await log_event(db, event="job.deleted", user_id=user["id"], username=user["username"],
                    entity_type="job", entity_id=job_id, entity_label=(j or {}).get("title"),
                    ip=client_ip(request), user_agent=user_agent(request))
    return {"ok": True}


# --- Checklist ---
@router.post("/{job_id}/checklist")
async def add_checklist(job_id: str, payload: ChecklistItemIn, user: dict = Depends(require_min_role("collaborator"))):
    from server import db
    item = ChecklistItem(**payload.model_dump()).model_dump()
    res = await db.jobs.update_one({"id": job_id}, {"$push": {"checklist": item}, "$set": {"updated_at": now_iso()}})
    if res.matched_count == 0:
        raise HTTPException(404, "Job not found")
    return item


@router.put("/{job_id}/checklist/{item_id}")
async def update_checklist(job_id: str, item_id: str, payload: dict, user: dict = Depends(require_min_role("collaborator"))):
    from server import db
    set_doc = {}
    for k in ("text", "done", "note"):
        if k in payload:
            set_doc[f"checklist.$.{k}"] = payload[k]
    if "done" in payload:
        set_doc["checklist.$.completed_at"] = now_iso() if payload["done"] else None
    if not set_doc:
        return {"ok": True}
    set_doc["updated_at"] = now_iso()
    res = await db.jobs.update_one(
        {"id": job_id, "checklist.id": item_id}, {"$set": set_doc}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Item not found")
    return {"ok": True}


@router.delete("/{job_id}/checklist/{item_id}")
async def delete_checklist(job_id: str, item_id: str, user: dict = Depends(require_min_role("collaborator"))):
    from server import db
    await db.jobs.update_one({"id": job_id}, {"$pull": {"checklist": {"id": item_id}}, "$set": {"updated_at": now_iso()}})
    return {"ok": True}


# --- Timeline ---
@router.post("/{job_id}/timeline")
async def add_timeline(job_id: str, payload: TimelineEntryIn, user: dict = Depends(require_min_role("collaborator"))):
    from server import db
    entry = TimelineEntry(**payload.model_dump()).model_dump()
    res = await db.jobs.update_one({"id": job_id}, {"$push": {"timeline": entry}, "$set": {"updated_at": now_iso()}})
    if res.matched_count == 0:
        raise HTTPException(404, "Job not found")
    return entry


@router.delete("/{job_id}/timeline/{entry_id}")
async def delete_timeline(job_id: str, entry_id: str, user: dict = Depends(require_min_role("collaborator"))):
    from server import db
    await db.jobs.update_one({"id": job_id}, {"$pull": {"timeline": {"id": entry_id}}, "$set": {"updated_at": now_iso()}})
    return {"ok": True}


# --- Finance ---
@router.put("/{job_id}/finance")
async def update_finance(job_id: str, payload: FinanceInfo, user: dict = Depends(require_min_role("collaborator"))):
    from server import db
    res = await db.jobs.update_one({"id": job_id}, {"$set": {"finance": payload.model_dump(), "updated_at": now_iso()}})
    if res.matched_count == 0:
        raise HTTPException(404, "Job not found")
    return payload.model_dump()


# --- Secrets ---
@router.post("/{job_id}/secrets")
async def add_secret(job_id: str, payload: SecretIn, request: Request, user: dict = Depends(require_min_role("collaborator"))):
    from server import db
    item = {
        "id": new_id(),
        "label": payload.label,
        "encrypted_value": encrypt_secret(payload.value),
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    res = await db.jobs.update_one({"id": job_id}, {"$push": {"secrets": item}, "$set": {"updated_at": now_iso()}})
    if res.matched_count == 0:
        raise HTTPException(404, "Job not found")
    await log_event(db, event="secret.created", user_id=user["id"], username=user["username"],
                    entity_type="secret", entity_id=item["id"], entity_label=payload.label,
                    ip=client_ip(request), user_agent=user_agent(request), meta={"job_id": job_id})
    return {"id": item["id"], "label": item["label"], "created_at": item["created_at"],
            "updated_at": item["updated_at"], "masked": mask_secret(item["encrypted_value"])}


@router.post("/{job_id}/secrets/{secret_id}/reveal")
async def reveal_secret(job_id: str, secret_id: str, body: dict, request: Request, user: dict = Depends(require_role("admin"))):
    """Reveal a secret. Admin role + admin password confirmation required."""
    from server import db
    from auth import verify_password
    password = body.get("password", "")
    db_user = await db.users.find_one({"id": user["id"]})
    if not db_user or not verify_password(password, db_user["password_hash"]):
        await log_event(db, event="secret.reveal_denied", user_id=user["id"], username=user["username"],
                        entity_type="secret", entity_id=secret_id,
                        ip=client_ip(request), user_agent=user_agent(request), success=False,
                        meta={"job_id": job_id})
        raise HTTPException(401, "Password confirmation required")
    j = await db.jobs.find_one({"id": job_id}, {"_id": 0, "secrets": 1})
    if not j:
        raise HTTPException(404, "Job not found")
    for s in j.get("secrets", []):
        if s["id"] == secret_id:
            await log_event(db, event="secret.revealed", user_id=user["id"], username=user["username"],
                            entity_type="secret", entity_id=secret_id, entity_label=s.get("label"),
                            ip=client_ip(request), user_agent=user_agent(request), meta={"job_id": job_id})
            return {"id": secret_id, "value": decrypt_secret(s["encrypted_value"])}
    raise HTTPException(404, "Secret not found")


@router.delete("/{job_id}/secrets/{secret_id}")
async def delete_secret(job_id: str, secret_id: str, request: Request, user: dict = Depends(require_role("admin"))):
    from server import db
    await db.jobs.update_one({"id": job_id}, {"$pull": {"secrets": {"id": secret_id}}, "$set": {"updated_at": now_iso()}})
    await log_event(db, event="secret.deleted", user_id=user["id"], username=user["username"],
                    entity_type="secret", entity_id=secret_id,
                    ip=client_ip(request), user_agent=user_agent(request), meta={"job_id": job_id})
    return {"ok": True}


@router.post("/{job_id}/secrets/{secret_id}/copied")
async def log_secret_copied(job_id: str, secret_id: str, request: Request, user: dict = Depends(get_current_user)):
    """Audit-only — fired when the operator copies a revealed secret to clipboard.
    Stores label + entity ids only; never the value."""
    from server import db
    j = await db.jobs.find_one({"id": job_id, "secrets.id": secret_id}, {"_id": 0, "secrets.$": 1})
    if not j or not j.get("secrets"):
        raise HTTPException(404, "Secret not found")
    label = j["secrets"][0].get("label")
    await log_event(db, event="secret.copied", user_id=user["id"], username=user["username"],
                    entity_type="secret", entity_id=secret_id, entity_label=label,
                    ip=client_ip(request), user_agent=user_agent(request), meta={"job_id": job_id})
    return {"ok": True}
