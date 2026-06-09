from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime


class SendOTPRequest(BaseModel):
    phone: str


class VerifyOTPRequest(BaseModel):
    phone: str
    otp: str
    full_name: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserBrief"


class UserBrief(BaseModel):
    id: uuid.UUID
    full_name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    role: str
    is_verified: bool
    plan_type: str
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True


class GoogleAuthRequest(BaseModel):
    token: str  # Google ID token


# Rebuild TokenResponse to resolve forward reference
TokenResponse.model_rebuild()
