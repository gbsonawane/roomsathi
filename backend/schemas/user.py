from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime


class UserResponse(BaseModel):
    id: uuid.UUID
    full_name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    role: str
    is_verified: bool
    aadhar_verified: bool
    plan_type: str
    plan_expires_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    role: Optional[str] = None
