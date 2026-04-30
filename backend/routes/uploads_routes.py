"""File upload + authenticated file serving — safe filenames, type/size validation."""
import os
import shutil
import uuid
import mimetypes
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, Request
from fastapi.responses import FileResponse
from auth import get_current_user, client_ip, user_agent
from audit import log_event
from models import now_iso

router = APIRouter(prefix="/uploads", tags=["uploads"])

UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "/app/data/uploads")).resolve()
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# 25 MB limit keeps photos/screenshots/configs practical while blocking abuse.
MAX_SIZE = 25 * 1024 * 1024
ALLOWED_MIME_PREFIXES = ("image/", "video/", "audio/")
ALLOWED_MIME_EXACT = {
    "application/pdf", "text/plain", "text/csv", "application/json",
    "application/xml", "text/xml", "application/zip", "application/x-yaml",
    "text/yaml", "application/octet-stream",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/msword", "application/vnd.ms-excel",
}
# Ban known dangerous executables outright.
BLOCKED_EXTS = {".exe", ".msi", ".bat", ".cmd", ".com", ".scr", ".ps1", ".sh", ".vbs",
                ".jar", ".apk", ".dll", ".dylib", ".so", ".php", ".phtml"}


def _safe_filename(original: str) -> tuple[str, str]:
    """Return (random_storage_name, safe_display_name). Strips paths, keeps extension."""
    original = (original or "file").strip().replace("\x00", "")
    base = os.path.basename(original)
    # Keep only last extension; normalise.
    _, ext = os.path.splitext(base)
    ext = ext.lower()
    if ext in BLOCKED_EXTS:
        raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")
    if len(ext) > 10:
        ext = ""
    stored = f"{uuid.uuid4()}{ext}"
    display = base[:200] or stored
    return stored, display


def _mime_ok(mime: str) -> bool:
    if not mime:
        return True  # many tools upload without a proper type
    if mime in ALLOWED_MIME_EXACT:
        return True
    return any(mime.startswith(p) for p in ALLOWED_MIME_PREFIXES)


@router.post("", dependencies=[Depends(get_current_user)])
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    job_id: str | None = Form(None),
    device_id: str | None = Form(None),
    category: str | None = Form(None),
    caption: str | None = Form(None),
    user: dict = Depends(get_current_user),
):
    from server import db
    if not _mime_ok(file.content_type or ""):
        raise HTTPException(status_code=400, detail="Unsupported file type")

    stored_name, display_name = _safe_filename(file.filename or "file")
    dest = (UPLOAD_DIR / stored_name).resolve()
    # Defense-in-depth against path traversal.
    if UPLOAD_DIR not in dest.parents and dest.parent != UPLOAD_DIR:
        raise HTTPException(status_code=400, detail="Invalid path")

    size = 0
    with dest.open("wb") as out:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            if size > MAX_SIZE:
                out.close()
                try:
                    dest.unlink(missing_ok=True)
                except Exception:
                    pass
                raise HTTPException(status_code=413, detail="File too large (25 MB max)")
            out.write(chunk)

    attachment_id = str(uuid.uuid4())
    mime = file.content_type or mimetypes.guess_type(display_name)[0] or "application/octet-stream"
    attachment = {
        "id": attachment_id,
        "filename": stored_name,
        "original_name": display_name,
        "mime": mime,
        "size": size,
        "category": category,
        "caption": caption,
        "url": f"/api/files/{attachment_id}",  # opaque, requires auth
        "created_at": now_iso(),
    }
    if job_id:
        await db.jobs.update_one({"id": job_id}, {"$push": {"attachments": attachment}, "$set": {"updated_at": now_iso()}})
    if device_id:
        await db.devices.update_one({"id": device_id}, {"$push": {"photos": attachment["url"]}})

    await log_event(db, event="attachment.uploaded", user_id=user["id"], username=user["username"],
                    entity_type="attachment", entity_id=attachment_id, entity_label=display_name,
                    ip=client_ip(request), user_agent=user_agent(request),
                    meta={"size": size, "mime": mime, "job_id": job_id, "device_id": device_id})
    return attachment


@router.delete("/{attachment_id}", dependencies=[Depends(get_current_user)])
async def delete_attachment(attachment_id: str, request: Request, job_id: str | None = None, user: dict = Depends(get_current_user)):
    from server import db
    fname = None
    if job_id:
        j = await db.jobs.find_one({"id": job_id, "attachments.id": attachment_id}, {"_id": 0, "attachments.$": 1})
        if j and j.get("attachments"):
            fname = j["attachments"][0].get("filename")
        await db.jobs.update_one({"id": job_id}, {"$pull": {"attachments": {"id": attachment_id}}, "$set": {"updated_at": now_iso()}})

    if fname:
        target = (UPLOAD_DIR / fname).resolve()
        if target.parent == UPLOAD_DIR and target.exists():
            try:
                target.unlink()
            except Exception:
                pass

    await log_event(db, event="attachment.deleted", user_id=user["id"], username=user["username"],
                    entity_type="attachment", entity_id=attachment_id,
                    ip=client_ip(request), user_agent=user_agent(request))
    return {"ok": True}


# --- Authenticated file serving (replaces public StaticFiles) ---
files_router = APIRouter(prefix="/files", tags=["files"])


async def _find_attachment(db, attachment_id: str) -> dict | None:
    j = await db.jobs.find_one({"attachments.id": attachment_id}, {"_id": 0, "attachments.$": 1})
    if j and j.get("attachments"):
        return j["attachments"][0]
    return None


@files_router.get("/{attachment_id}", dependencies=[Depends(get_current_user)])
async def serve_file(attachment_id: str, request: Request, user: dict = Depends(get_current_user)):
    from server import db
    att = await _find_attachment(db, attachment_id)
    if not att:
        raise HTTPException(status_code=404, detail="File not found")
    fname = att.get("filename", "")
    # Reject anything with path separators — only bare filenames produced by us.
    if "/" in fname or "\\" in fname or ".." in fname:
        raise HTTPException(status_code=400, detail="Invalid file reference")
    target = (UPLOAD_DIR / fname).resolve()
    if target.parent != UPLOAD_DIR or not target.exists():
        raise HTTPException(status_code=404, detail="File not found")
    await log_event(db, event="file.viewed", user_id=user["id"], username=user["username"],
                    entity_type="attachment", entity_id=attachment_id,
                    entity_label=att.get("original_name"),
                    ip=client_ip(request), user_agent=user_agent(request),
                    meta={"mime": att.get("mime"), "size": att.get("size")})
    return FileResponse(
        path=str(target),
        media_type=att.get("mime") or "application/octet-stream",
        filename=att.get("original_name") or fname,
        headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=3600"},
    )
