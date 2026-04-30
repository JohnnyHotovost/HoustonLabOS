"""Auth routes — Argon2id hashing, rate-limited login, httpOnly cookies, audit log."""
from fastapi import APIRouter, HTTPException, Depends, Response, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
import os

from auth import (
    hash_password, verify_password, needs_rehash, create_access_token,
    get_current_user, ACCESS_TOKEN_MIN, REMEMBER_ME_DAYS,
    cookie_secure, client_ip, user_agent, DEFAULT_ADMIN_PASSWORD,
)
from audit import log_event
from models import LoginPayload, ChangePasswordPayload, ProfileUpdatePayload

router = APIRouter(prefix="/auth", tags=["auth"])

limiter = Limiter(key_func=get_remote_address)

LOGIN_RATE_LIMIT = os.environ.get("LOGIN_RATE_LIMIT", "8/minute")


def _set_cookie(response: Response, token: str, remember: bool):
    max_age = REMEMBER_ME_DAYS * 86400 if remember else ACCESS_TOKEN_MIN * 60
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=cookie_secure(),
        samesite="lax",
        max_age=max_age,
        path="/",
    )


@router.post("/login")
@limiter.limit(LOGIN_RATE_LIMIT)
async def login(request: Request, payload: LoginPayload, response: Response):
    from server import db
    ident = payload.identifier.strip().lower()
    ip = client_ip(request)
    ua = user_agent(request)

    user = await db.users.find_one({"$or": [{"email": ident}, {"username": ident}]})
    if not user or not verify_password(payload.password, user["password_hash"]):
        await log_event(db, event="login.failed", username=ident, ip=ip, user_agent=ua, success=False)
        # Generic message, no hint about which field was wrong.
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Transparent rehash if hash is legacy (bcrypt) or argon2 parameters changed.
    if needs_rehash(user["password_hash"]):
        try:
            await db.users.update_one(
                {"id": user["id"]},
                {"$set": {"password_hash": hash_password(payload.password)}},
            )
        except Exception:
            pass

    # Default-password detection for forced change prompt.
    force_change = bool(user.get("must_change_password")) or verify_password(DEFAULT_ADMIN_PASSWORD, user["password_hash"])

    token = create_access_token(user["id"], user["email"], remember=payload.remember)
    _set_cookie(response, token, payload.remember)
    await log_event(db, event="login.success", user_id=user["id"], username=user["username"], ip=ip, user_agent=ua)
    return {
        "token": token,
        "user": {
            "id": user["id"], "username": user["username"], "email": user["email"],
            "name": user.get("name"), "role": user.get("role", "admin"),
            "created_at": user["created_at"],
            "must_change_password": force_change,
        },
    }


@router.post("/logout")
async def logout(request: Request, response: Response):
    from server import db
    response.delete_cookie("access_token", path="/")
    try:
        user = await get_current_user(request)
        await log_event(db, event="logout", user_id=user["id"], username=user["username"],
                        ip=client_ip(request), user_agent=user_agent(request))
    except Exception:
        pass
    return {"ok": True}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    from server import db
    db_user = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 1})
    force_change = verify_password(DEFAULT_ADMIN_PASSWORD, (db_user or {}).get("password_hash", ""))
    return {**user, "must_change_password": force_change}


@router.post("/change-password")
async def change_password(request: Request, payload: ChangePasswordPayload, user: dict = Depends(get_current_user)):
    from server import db
    db_user = await db.users.find_one({"id": user["id"]})
    if not db_user or not verify_password(payload.current_password, db_user["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(payload.new_password) < 10:
        raise HTTPException(status_code=400, detail="New password must be at least 10 characters")
    if payload.new_password == DEFAULT_ADMIN_PASSWORD:
        raise HTTPException(status_code=400, detail="New password must be different from the default")
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"password_hash": hash_password(payload.new_password), "must_change_password": False}},
    )
    await log_event(db, event="password.changed", user_id=user["id"], username=user["username"],
                    ip=client_ip(request), user_agent=user_agent(request))
    return {"ok": True}


@router.post("/profile")
async def update_profile(request: Request, payload: ProfileUpdatePayload, user: dict = Depends(get_current_user)):
    from server import db
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update:
        return user
    await db.users.update_one({"id": user["id"]}, {"$set": update})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    await log_event(db, event="profile.updated", user_id=user["id"], username=user["username"],
                    ip=client_ip(request), user_agent=user_agent(request), meta={"fields": list(update.keys())})
    return updated
