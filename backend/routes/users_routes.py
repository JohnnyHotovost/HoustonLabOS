"""Admin user management — admin-only CRUD with last-admin guard + audit logging."""
from fastapi import APIRouter, HTTPException, Depends, Request
from auth import (
    get_current_user, hash_password, require_role, client_ip, user_agent,
)
from audit import log_event
from models import (
    UserCreatePayload, UserUpdatePayload, AdminResetPasswordPayload, new_id, now_iso,
)

router = APIRouter(
    prefix="/users",
    tags=["users"],
    dependencies=[Depends(require_role("admin"))],
)


def _public(u: dict) -> dict:
    return {k: v for k, v in u.items() if k not in ("_id", "password_hash")}


async def _count_active_admins(db, exclude_id: str | None = None) -> int:
    q = {"role": "admin", "is_active": {"$ne": False}}
    if exclude_id:
        q["id"] = {"$ne": exclude_id}
    return await db.users.count_documents(q)


@router.get("")
async def list_users():
    from server import db
    items = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(500)
    return items


@router.post("")
async def create_user(payload: UserCreatePayload, request: Request, user: dict = Depends(get_current_user)):
    from server import db
    role = (payload.role or "collaborator").lower()
    if role not in ("admin", "collaborator", "spectator"):
        raise HTTPException(400, "Invalid role")
    if len(payload.password) < 10:
        raise HTTPException(400, "Password must be at least 10 characters")
    username = payload.username.strip().lower()
    email = str(payload.email).strip().lower()
    if not username:
        raise HTTPException(400, "Username required")
    if await db.users.find_one({"$or": [{"username": username}, {"email": email}]}):
        raise HTTPException(400, "Username or email already in use")
    doc = {
        "id": new_id(),
        "username": username,
        "email": email,
        "name": payload.name,
        "role": role,
        "is_active": payload.is_active,
        "password_hash": hash_password(payload.password),
        "must_change_password": False,
        "created_at": now_iso(),
        "last_login_at": None,
    }
    await db.users.insert_one(doc)
    await log_event(db, event="user.created", user_id=user["id"], username=user["username"],
                    entity_type="user", entity_id=doc["id"], entity_label=username,
                    ip=client_ip(request), user_agent=user_agent(request),
                    meta={"role": role})
    return _public(doc)


@router.put("/{user_id}")
async def update_user(user_id: str, payload: UserUpdatePayload, request: Request, user: dict = Depends(get_current_user)):
    from server import db
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(404, "User not found")

    update = {k: v for k, v in payload.model_dump().items() if v is not None}

    # Last-admin guard: prevent demote/deactivate of the last active admin.
    if target.get("role") == "admin":
        will_demote = "role" in update and update["role"] != "admin"
        will_disable = update.get("is_active") is False
        if (will_demote or will_disable) and await _count_active_admins(db, exclude_id=user_id) == 0:
            raise HTTPException(400, "Cannot demote or deactivate the last active admin")

    if "username" in update:
        update["username"] = update["username"].strip().lower()
        clash = await db.users.find_one({"username": update["username"], "id": {"$ne": user_id}})
        if clash:
            raise HTTPException(400, "Username already taken")
    if "email" in update:
        update["email"] = str(update["email"]).strip().lower()
        clash = await db.users.find_one({"email": update["email"], "id": {"$ne": user_id}})
        if clash:
            raise HTTPException(400, "Email already in use")
    if "role" in update and update["role"] not in ("admin", "collaborator", "spectator"):
        raise HTTPException(400, "Invalid role")

    if not update:
        return _public(target)

    await db.users.update_one({"id": user_id}, {"$set": update})
    fresh = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})

    event = "user.role_changed" if "role" in update else "user.updated"
    await log_event(db, event=event, user_id=user["id"], username=user["username"],
                    entity_type="user", entity_id=user_id, entity_label=fresh.get("username"),
                    ip=client_ip(request), user_agent=user_agent(request),
                    meta={"fields": list(update.keys()), "new_role": update.get("role")})
    return fresh


@router.post("/{user_id}/reset-password")
async def admin_reset_password(user_id: str, payload: AdminResetPasswordPayload, request: Request, user: dict = Depends(get_current_user)):
    from server import db
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(404, "User not found")
    if len(payload.new_password) < 10:
        raise HTTPException(400, "Password must be at least 10 characters")
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"password_hash": hash_password(payload.new_password), "must_change_password": True}},
    )
    await log_event(db, event="user.password_reset", user_id=user["id"], username=user["username"],
                    entity_type="user", entity_id=user_id, entity_label=target.get("username"),
                    ip=client_ip(request), user_agent=user_agent(request))
    return {"ok": True}


@router.delete("/{user_id}")
async def delete_user(user_id: str, request: Request, user: dict = Depends(get_current_user)):
    from server import db
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(404, "User not found")
    if target["id"] == user["id"]:
        raise HTTPException(400, "You cannot delete your own account")
    if target.get("role") == "admin" and await _count_active_admins(db, exclude_id=user_id) == 0:
        raise HTTPException(400, "Cannot delete the last active admin")
    await db.users.delete_one({"id": user_id})
    await log_event(db, event="user.deleted", user_id=user["id"], username=user["username"],
                    entity_type="user", entity_id=user_id, entity_label=target.get("username"),
                    ip=client_ip(request), user_agent=user_agent(request),
                    meta={"role": target.get("role")})
    return {"ok": True}
