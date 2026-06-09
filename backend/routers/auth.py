from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from backend.db.dependencies import get_db
from backend.core.security import generate_otp, create_access_token
from backend.schemas.auth import SendOTPRequest, VerifyOTPRequest, TokenResponse, UserBrief
from backend.services.auth_service import send_otp_sms, save_otp, verify_otp_code, get_or_create_user, send_otp_email

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/send-otp")
async def send_otp(body: SendOTPRequest, db: AsyncSession = Depends(get_db)):
    """Send OTP to the provided phone number."""
    try:
        otp = generate_otp()
        await save_otp(db, body.phone, otp)
        
        if "@" in body.phone:
            await send_otp_email(body.phone, otp)
        else:
            await send_otp_sms(body.phone, otp)
            
        return {"message": "OTP sent", "dev_otp": otp}  # Remove dev_otp in production
    except Exception as e:
        import traceback
        with open("error.log", "w") as f:
            f.write(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/verify-otp", response_model=TokenResponse)
async def verify_otp(body: VerifyOTPRequest, db: AsyncSession = Depends(get_db)):
    """Verify OTP and return JWT token."""
    valid = await verify_otp_code(db, body.phone, body.otp)
    if not valid:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    user = await get_or_create_user(db, phone=body.phone, full_name=body.full_name)
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
    user = await get_or_create_user(db, phone=body.phone, full_name=body.full_name)
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
