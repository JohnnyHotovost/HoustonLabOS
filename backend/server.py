"""HoustonLab OS — main FastAPI server."""
from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging

from fastapi import FastAPI, APIRouter, Request
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

# --- DB ---
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

APP_ENV = os.environ.get("APP_ENV", "development").lower()
IS_PROD = APP_ENV == "production"

app = FastAPI(
    title="HoustonLab OS",
    docs_url=None if IS_PROD else "/docs",
    redoc_url=None if IS_PROD else "/redoc",
    openapi_url=None if IS_PROD else "/openapi.json",
)

# --- Rate limiter ---
from routes.auth_routes import limiter as auth_limiter
app.state.limiter = auth_limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        if IS_PROD:
            response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        return response


app.add_middleware(SecurityHeadersMiddleware)

api_router = APIRouter(prefix="/api")

# Routers
from routes.auth_routes import router as auth_router
from routes.clients_routes import router as clients_router
from routes.devices_routes import router as devices_router
from routes.templates_routes import router as templates_router
from routes.jobs_routes import router as jobs_router
from routes.uploads_routes import router as uploads_router, files_router
from routes.dashboard_routes import router as dashboard_router
from routes.settings_routes import router as settings_router
from routes.search_routes import router as search_router
from routes.audit_routes import router as audit_router
from routes.users_routes import router as users_router

api_router.include_router(auth_router)
api_router.include_router(clients_router)
api_router.include_router(devices_router)
api_router.include_router(templates_router)
api_router.include_router(jobs_router)
api_router.include_router(uploads_router)
api_router.include_router(files_router)
api_router.include_router(dashboard_router)
api_router.include_router(settings_router)
api_router.include_router(search_router)
api_router.include_router(audit_router)
api_router.include_router(users_router)


@api_router.get("/")
async def root():
    return {"app": "HoustonLab OS", "status": "ok", "env": APP_ENV}


app.include_router(api_router)

# CORS — credentials require explicit origins in production.
cors_origins_env = os.environ.get("CORS_ORIGINS", "*")
if cors_origins_env == "*":
    cors_allow_origins = ["*"]
    cors_allow_credentials = False  # browser would reject credentials+'*' anyway
else:
    cors_allow_origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()]
    cors_allow_credentials = True

app.add_middleware(
    CORSMiddleware,
    allow_credentials=cors_allow_credentials,
    allow_origins=cors_allow_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    # Never leak stack traces in production.
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    if IS_PROD:
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})
    return JSONResponse(status_code=500, content={"detail": str(exc)})


logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def on_startup():
    from seed import run_seeders
    await db.users.create_index("email", unique=True)
    await db.users.create_index("username", unique=True)
    await db.clients.create_index("id", unique=True)
    await db.devices.create_index("id", unique=True)
    await db.jobs.create_index("id", unique=True)
    await db.jobs.create_index("code")
    await db.templates.create_index("id", unique=True)
    await db.audit_log.create_index("created_at")
    await db.audit_log.create_index("event")
    await run_seeders(db)
    logger.info("HoustonLab OS started in %s mode.", APP_ENV)


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
