from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from backend.db.dependencies import get_db, get_current_user
from backend.schemas.user import UserResponse, UserUpdate
from backend.models.user import User
from backend.models.listing import Listing
from typing import List

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


@router.get("/all")
async def get_all_users(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Get all users (admin only)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    result = await db.execute(select(User).order_by(User.created_at.desc()).limit(500))
    users = result.scalars().all()

    users_data = []
    for user in users:
        # Count listings
        listing_count_result = await db.execute(
            select(func.count(Listing.id)).where(Listing.owner_id == user.id)
        )
        listing_count = listing_count_result.scalar() or 0

        users_data.append({
            "id": str(user.id),
            "full_name": user.full_name,
            "phone": user.phone,
            "email": user.email,
            "role": user.role,
            "is_active": user.is_active if hasattr(user, "is_active") else True,
            "plan_type": user.plan_type,
            "is_verified": user.is_verified,
            "listing_count": listing_count,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        })

    return {"users": users_data}


@router.patch("/{user_id}/promote")
async def promote_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Promote user to admin role (admin only)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.role = "admin"
    await db.flush()
    return {"id": user_id, "role": "admin", "message": "User promoted to admin"}


@router.patch("/{user_id}/ban")
async def ban_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Ban or unban a user (admin only)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Toggle ban status
    current_active = getattr(user, "is_active", True)
    user.is_active = not current_active
    await db.flush()
    status = "banned" if not user.is_active else "unbanned"
    return {"id": user_id, "is_active": user.is_active, "message": f"User {status}"}
