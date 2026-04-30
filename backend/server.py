"""HoustonLab OS — main FastAPI server."""
from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging

from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from motor.motor_asyncio import AsyncIOMotorClient

# --- DB ---
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="HoustonLab OS")

api_router = APIRouter(prefix="/api")

# Routers
from routes.auth_routes import router as auth_router
from routes.clients_routes import router as clients_router
from routes.devices_routes import router as devices_router
from routes.templates_routes import router as templates_router
from routes.jobs_routes import router as jobs_router
from routes.uploads_routes import router as uploads_router
from routes.dashboard_routes import router as dashboard_router
from routes.settings_routes import router as settings_router
from routes.search_routes import router as search_router

api_router.include_router(auth_router)
api_router.include_router(clients_router)
api_router.include_router(devices_router)
api_router.include_router(templates_router)
api_router.include_router(jobs_router)
api_router.include_router(uploads_router)
api_router.include_router(dashboard_router)
api_router.include_router(settings_router)
api_router.include_router(search_router)


@api_router.get("/")
async def root():
    return {"app": "HoustonLab OS", "status": "ok"}


app.include_router(api_router)

# Serve uploads as static files (persistent dir)
UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "/app/data/uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/api/files", StaticFiles(directory=UPLOAD_DIR), name="files")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    await run_seeders(db)
    logger.info("HoustonLab OS started.")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
