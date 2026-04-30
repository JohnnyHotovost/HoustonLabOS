"""File upload routes — persistent storage on local disk volume."""
import os
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from auth import get_current_user
from models import Attachment, now_iso, new_id

router = APIRouter(prefix="/uploads", tags=["uploads"], dependencies=[Depends(get_current_user)])

UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "/app/data/uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post("")
async def upload_file(
    file: UploadFile = File(...),
    job_id: str | None = Form(None),
    device_id: str | None = Form(None),
    category: str | None = Form(None),
    caption: str | None = Form(None),
):
    from server import db
    ext = ""
    if file.filename and "." in file.filename:
        ext = "." + file.filename.rsplit(".", 1)[1].lower()
    file_id = str(uuid.uuid4())
    stored_name = f"{file_id}{ext}"
    dest = UPLOAD_DIR / stored_name
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    size = dest.stat().st_size
    attachment = {
        "id": file_id,
        "filename": stored_name,
        "original_name": file.filename or stored_name,
        "mime": file.content_type or "application/octet-stream",
        "size": size,
        "category": category,
        "caption": caption,
        "url": f"/api/files/{stored_name}",
        "created_at": now_iso(),
    }
    if job_id:
        await db.jobs.update_one({"id": job_id}, {"$push": {"attachments": attachment}, "$set": {"updated_at": now_iso()}})
    if device_id:
        await db.devices.update_one({"id": device_id}, {"$push": {"photos": attachment["url"]}})
    return attachment


@router.delete("/{attachment_id}")
async def delete_attachment(attachment_id: str, job_id: str | None = None, device_id: str | None = None):
    from server import db
    if job_id:
        # find filename to delete on disk
        j = await db.jobs.find_one({"id": job_id, "attachments.id": attachment_id}, {"_id": 0, "attachments.$": 1})
        if j and j.get("attachments"):
            fname = j["attachments"][0].get("filename")
            if fname:
                try:
                    (UPLOAD_DIR / fname).unlink(missing_ok=True)
                except Exception:
                    pass
        await db.jobs.update_one({"id": job_id}, {"$pull": {"attachments": {"id": attachment_id}}, "$set": {"updated_at": now_iso()}})
    return {"ok": True}
