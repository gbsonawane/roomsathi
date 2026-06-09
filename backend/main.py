import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from backend.routers import auth, listings, users, unlock, boost, saved, payments, webhooks
from backend.services.listing_service import expire_old_listings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Start scheduler for listing expiry only in persistent servers.
    # Serverless platforms like Vercel do not preserve process lifetime.
    if os.getenv("VERCEL") != "1":
        scheduler.add_job(expire_old_listings, "cron", hour=0, minute=0, id="expire_listings")
        scheduler.start()
        logger.info("🚀 RoomSathi API started. Scheduler running.")
    else:
        logger.info("🚀 RoomSathi API started on Vercel. Scheduler disabled in serverless mode.")

    yield

    if os.getenv("VERCEL") != "1":
        scheduler.shutdown()
        logger.info("🛑 RoomSathi API shutting down.")
    else:
        logger.info("🛑 RoomSathi API cleanup finished.")


app = FastAPI(
    title="RoomSathi API",
    description="Room and flat rental platform — zero broker, zero middleman",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount uploads directory for serving photos
uploads_dir = Path("./uploads")
uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

# Include all routers
app.include_router(auth.router)
app.include_router(listings.router)
app.include_router(users.router)
app.include_router(unlock.router)
app.include_router(boost.router)
app.include_router(saved.router)
app.include_router(payments.router)
app.include_router(webhooks.router)


@app.get("/")
async def root():
    return {
        "app": "RoomSathi API",
        "version": "1.0.0",
        "tagline": "Apna room, apna hisaab.",
    }


@app.get("/health")
async def health():
    return {"status": "ok"}
