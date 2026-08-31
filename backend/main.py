import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Header, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.requests import Request
from pathlib import Path
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import settings
from backend.routers import auth, listings, users, unlock, boost, saved, payments, webhooks
from backend.services.listing_service import expire_old_listings, reset_daily_contacts
from backend.db.dependencies import get_db

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        integrations=[FastApiIntegration(), SqlalchemyIntegration()],
        environment=settings.ENVIRONMENT,
        traces_sample_rate=0.2,
        send_default_pii=False,
    )

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("roomsathi")

scheduler = AsyncIOScheduler()


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
origins = settings.ALLOWED_ORIGINS
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from slowapi.errors import RateLimitExceeded
from backend.routers.auth import limiter

app.state.limiter = limiter

@app.exception_handler(RateLimitExceeded)
async def custom_rate_limit_exceeded_handler(request, exc):
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many OTP requests. Please wait 10 minutes."},
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(
        f"Unhandled exception on {request.method} {request.url.path}",
        exc_info=exc,
        extra={
            "path": request.url.path,
            "method": request.method,
        }
    )
    if settings.SENTRY_DSN:
        sentry_sdk.capture_exception(exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "Something went wrong. Please try again."}
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    if exc.status_code >= 500:
        logger.error(
            f"HTTP {exc.status_code} on {request.method} {request.url.path}: {exc.detail}",
            exc_info=exc,
        )
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=exc.headers,
    )


# Only mount local uploads dir when not using S3
if settings.STORAGE_BACKEND != "s3":
    uploads_dir = Path(settings.UPLOAD_DIR)
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
async def health_check():
    return {"status": "ok"}


@app.post("/cron/expire-listings")
async def cron_expire_listings(
    x_cron_secret: str = Header(None),
    db: AsyncSession = Depends(get_db),
):
    if not settings.CRON_SECRET or x_cron_secret != settings.CRON_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")
    from backend.services.listing_service import expire_old_listings
    await expire_old_listings(db)
    return {"status": "done", "job": "expire_listings"}


@app.post("/cron/reset-contacts")
async def cron_reset_contacts(
    x_cron_secret: str = Header(None),
    db: AsyncSession = Depends(get_db),
):
    if not settings.CRON_SECRET or x_cron_secret != settings.CRON_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")
    from backend.services.listing_service import reset_daily_contacts
    await reset_daily_contacts(db)
    return {"status": "done", "job": "reset_contacts"}
