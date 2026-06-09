from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.db.dependencies import get_db, get_current_user
from backend.schemas.user import UserResponse, UserUpdate
from backend.models.user import User

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
async def get_me(current_user=Depends(get_current_user)):
    """Get current user profile."""
    return UserResponse.model_validate(current_user)


@router.patch("/me", response_model=UserResponse)
async def update_me(
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Update current user profile."""
    update_data = body.model_dump(exclude_none=True)
    for key, value in update_data.items():
        setattr(current_user, key, value)
    db.add(current_user)
    await db.flush()
    await db.refresh(current_user)
    return UserResponse.model_validate(current_user)
