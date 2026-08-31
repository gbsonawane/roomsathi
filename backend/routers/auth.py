import logging
import json
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from slowapi import Limiter
from slowapi.util import get_remote_address

from backend.core.config import settings
from backend.db.dependencies import get_db
from backend.core.security import generate_otp, create_access_token, verify_password
from backend.schemas.auth import SendOTPRequest, VerifyOTPRequest, TokenResponse, UserBrief, AdminLoginRequest, GoogleAuthRequest
from backend.services.auth_service import send_otp_sms, save_otp, verify_otp_code, get_or_create_user, send_otp_email
from sqlalchemy import select
from backend.models.user import User
import time
from collections import defaultdict

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)
admin_login_attempts = defaultdict(lambda: {"attempts": 0, "lockout_until": 0})


async def get_phone_key(request: Request) -> str:
    try:
        if hasattr(request.state, "phone_number"):
            return request.state.phone_number
        body_bytes = await request.body()
        body = json.loads(body_bytes)
        phone = body.get("phone", "")
        request.state.phone_number = phone
        
        # Restore request body stream for FastAPI
        async def receive():
            return {"type": "http.request", "body": body_bytes, "more_body": False}
        request._receive = receive
        
        return phone
    except Exception:
        return get_remote_address(request)


@router.post("/send-otp")
@limiter.limit("3/10 minutes", key_func=get_phone_key)
async def send_otp(request: Request, body: SendOTPRequest, db: AsyncSession = Depends(get_db)):
    """Send OTP to the provided phone number."""
    try:
        otp = generate_otp()
        await save_otp(db, body.phone, otp)
        
        if "@" in body.phone:
            await send_otp_email(body.phone, otp)
        else:
            await send_otp_sms(body.phone, otp)
            
        if settings.ENVIRONMENT == "development":
            return {"message": "OTP sent", "dev_otp": otp}
        return {"message": "OTP sent"}
    except Exception as e:
        logger.error(f"Error in {__name__}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Something went wrong. Please try again."
        )


@router.post("/verify-otp", response_model=TokenResponse)
@limiter.limit("10/minute", key_func=get_phone_key)
async def verify_otp(request: Request, body: VerifyOTPRequest, db: AsyncSession = Depends(get_db)):
    """Verify OTP and return JWT token."""
    valid = await verify_otp_code(db, body.phone, body.otp)
    if not valid:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    user = await get_or_create_user(db, phone=body.phone, full_name=body.full_name)
    if not getattr(user, "is_active", True):
        raise HTTPException(
            status_code=403,
            detail="Your account has been suspended. Contact support at support@roomsathi.in",
        )
    token = create_access_token({"sub": str(user.id), "role": user.role})
    user_brief = UserBrief(
        id=user.id,
        full_name=user.full_name,
        phone=user.phone,
        email=user.email,
        role=user.role,
        is_verified=user.is_verified,
        plan_type=user.plan_type,
        avatar_url=user.avatar_url,
    )
    return TokenResponse(access_token=token, token_type="bearer", user=user_brief)


@router.post("/dev-login", response_model=TokenResponse)
async def dev_login(body: VerifyOTPRequest, db: AsyncSession = Depends(get_db)):
    """Dev-only: Login without OTP verification for testing."""
    if settings.ENVIRONMENT != "development":
        raise HTTPException(status_code=403, detail="Not allowed in production environment")
    user = await get_or_create_user(db, phone=body.phone, full_name=body.full_name)
    if not getattr(user, "is_active", True):
        raise HTTPException(
            status_code=403,
            detail="Your account has been suspended. Contact support at support@roomsathi.in",
        )
    token = create_access_token({"sub": str(user.id), "role": user.role})
    user_brief = UserBrief(
        id=user.id,
        full_name=user.full_name,
        phone=user.phone,
        email=user.email,
        role=user.role,
        is_verified=user.is_verified,
        plan_type=user.plan_type,
        avatar_url=user.avatar_url,
    )
    return TokenResponse(access_token=token, token_type="bearer", user=user_brief)


@router.post("/google", response_model=TokenResponse)
@limiter.limit("10/minute")
async def google_login(request: Request, body: GoogleAuthRequest, db: AsyncSession = Depends(get_db)):
    """Login or register using a Google ID token. Verifies via Google tokeninfo API."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": body.token},
                timeout=10.0,
            )
        if response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid Google token")

        info = response.json()
        if "error_description" in info:
            raise HTTPException(status_code=401, detail="Invalid Google token")

        email = info.get("email")
        name = info.get("name") or (email.split("@")[0] if email else "Google User")
        picture = info.get("picture")

        if not email:
            raise HTTPException(status_code=401, detail="Google token missing email")

    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Could not reach Google verification service")

    # Find or create user by email
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            email=email,
            full_name=name,
            phone=None,
            is_verified=True,
            role="seeker",
            avatar_url=picture,
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)

    if not getattr(user, "is_active", True):
        raise HTTPException(
            status_code=403,
            detail="Your account has been suspended. Contact support at support@roomsathi.in",
        )

    token = create_access_token({"sub": str(user.id), "role": user.role})
    user_brief = UserBrief(
        id=user.id,
        full_name=user.full_name,
        phone=user.phone,
        email=user.email,
        role=user.role,
        is_verified=user.is_verified,
        plan_type=user.plan_type,
        avatar_url=user.avatar_url,
    )
    return TokenResponse(access_token=token, token_type="bearer", user=user_brief)


@router.post("/admin-login", response_model=TokenResponse)
async def admin_login(request: Request, body: AdminLoginRequest, db: AsyncSession = Depends(get_db)):
    """Admin portal login with rate limiting and password check."""
    client_ip = get_remote_address(request)
    now = time.time()
    
    rate_info = admin_login_attempts[client_ip]
    if now < rate_info["lockout_until"]:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # ADMIN_SECRET_PASSWORD must be a bcrypt hash (see .env.example).
    # verify_password is constant-time via bcrypt.checkpw; fail-closed on bad hash.
    if not settings.ADMIN_SECRET_PASSWORD or not verify_password(
        body.password, settings.ADMIN_SECRET_PASSWORD
    ):
        rate_info["attempts"] += 1
        if rate_info["attempts"] >= 5:
            rate_info["lockout_until"] = now + 900  # 15 minutes
        raise HTTPException(status_code=401, detail="Invalid credentials")
        
    rate_info["attempts"] = 0
    
    from sqlalchemy import or_
    result = await db.execute(
        select(User).where(
            or_(User.email == body.email, User.phone == body.email)
        )
    )
    user = result.scalar_one_or_none()
    
    if not user or user.role != "admin":
        raise HTTPException(status_code=401, detail="Invalid credentials")
        
    token = create_access_token({"sub": str(user.id), "role": user.role})
    user_brief = UserBrief(
        id=user.id,
        full_name=user.full_name,
        phone=user.phone,
        email=user.email,
        role=user.role,
        is_verified=user.is_verified,
        plan_type=user.plan_type,
        avatar_url=user.avatar_url,
    )
    return TokenResponse(access_token=token, token_type="bearer", user=user_brief)
