"""JWT + Argon2id password hashing (bcrypt fallback for legacy hashes)."""
import os
from datetime import datetime, timezone, timedelta
from typing import Optional

import bcrypt
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHashError, VerificationError
from fastapi import HTTPException, Request, Depends

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MIN = 60 * 8          # 8 hours — default session
REMEMBER_ME_DAYS = 30              # 30 days when "remember me"
DEFAULT_ADMIN_PASSWORD = "ChangeMe123!"

# Argon2id hasher (RFC 9106 / OWASP-recommended parameters, practical on a home server)
_ph = PasswordHasher(time_cost=3, memory_cost=64 * 1024, parallelism=2, hash_len=32, salt_len=16)


def _secret() -> str:
    return os.environ["JWT_SECRET"]


def is_production() -> bool:
    return os.environ.get("APP_ENV", "development").lower() == "production"


def cookie_secure() -> bool:
    # Explicit override wins; otherwise auto-enable in production.
    flag = os.environ.get("COOKIE_SECURE")
    if flag is not None:
        return flag.lower() in ("1", "true", "yes")
    return is_production()


def hash_password(password: str) -> str:
    """Hash a password with Argon2id."""
    return _ph.hash(password)


def verify_password(plain: str, stored: str) -> bool:
    """Verify a password against either an Argon2id or a legacy bcrypt hash."""
    if not stored:
        return False
    try:
        if stored.startswith("$argon2"):
            _ph.verify(stored, plain)
            return True
        if stored.startswith("$2"):  # bcrypt $2a$/$2b$/$2y$
            return bcrypt.checkpw(plain.encode("utf-8"), stored.encode("utf-8"))
    except (VerifyMismatchError, InvalidHashError, VerificationError, ValueError):
        return False
    return False


def needs_rehash(stored: str) -> bool:
    if not stored or not stored.startswith("$argon2"):
        return True
    try:
        return _ph.check_needs_rehash(stored)
    except Exception:
        return True


def create_access_token(user_id: str, email: str, remember: bool = False) -> str:
    if remember:
        exp = datetime.now(timezone.utc) + timedelta(days=REMEMBER_ME_DAYS)
    else:
        exp = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_MIN)
    payload = {"sub": user_id, "email": email, "exp": exp, "type": "access"}
    return jwt.encode(payload, _secret(), algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, _secret(), algorithms=[JWT_ALGORITHM])


def extract_token(request: Request) -> Optional[str]:
    # Prefer httpOnly cookie; Authorization header fallback for API tooling.
    token = request.cookies.get("access_token")
    if token:
        return token
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return None


async def get_current_user(request: Request) -> dict:
    from server import db  # avoid circular import
    token = extract_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "-"


def user_agent(request: Request) -> str:
    return request.headers.get("user-agent", "-")
