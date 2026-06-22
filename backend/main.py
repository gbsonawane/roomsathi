import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from backend.core.config import settings
from backend.routers import auth, listings, users, unlock, boost, saved, payments, webhooks
from backend.services.listing_service import expire_old_listings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def reset_daily_contacts():
    """Reset contacts_used_today to 0 for all users at midnight."""
    from backend.db.database import AsyncSessionLocal
    from backend.models.user import User
    from sqlalchemy import update

    async with AsyncSessionLocal() as db:
        try:
            await db.execute(
                update(User).values(contacts_used_today=0)
            )
            await db.commit()
            logger.info("Successfully reset contacts_used_today for all users.")
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to reset contacts_used_today: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Start scheduler for listing expiry only in persistent servers.
    # Serverless platforms like Vercel do not preserve process lifetime.
    if os.getenv("VERCEL") != "1":
        scheduler.add_job(expire_old_listings, "cron", hour=0, minute=0, id="expire_listings")
        scheduler.add_job(reset_daily_contacts, "cron", hour=0, minute=0, id="reset_contacts")
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
origins = [origin.strip() for origin in settings.ALLOWED_ORIGINS.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from slowapi.errors import RateLimitExceeded
from fastapi.responses import JSONResponse
from backend.routers.auth import limiter

app.state.limiter = limiter

@app.exception_handler(RateLimitExceeded)
async def custom_rate_limit_exceeded_handler(request, exc):
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many OTP requests. Please wait 10 minutes."},
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
