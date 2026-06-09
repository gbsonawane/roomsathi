from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.db.dependencies import get_db, get_current_user
from backend.models.payment import Payment
from backend.schemas.payment import PaymentResponse
from typing import List

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("/", response_model=List[PaymentResponse])
async def get_payments(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Get payment history for current user."""
    result = await db.execute(
        select(Payment)
        .where(Payment.user_id == current_user.id)
        .order_by(Payment.created_at.desc())
        .limit(50)
    )
    payments = result.scalars().all()
    return [PaymentResponse.model_validate(p) for p in payments]
