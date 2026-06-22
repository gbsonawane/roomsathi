from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.db.dependencies import get_db, get_current_user
from backend.models.payment import Payment
from backend.schemas.payment import PaymentResponse, PlanOrderRequest, CreateOrderResponse
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


@router.post("/order", response_model=CreateOrderResponse)
async def create_plan_order(
    body: PlanOrderRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Create a Razorpay order for standard/premium listing plans."""
    if body.plan_type == "standard":
        amount = 199 * 100  # paise
        payment_type = "listing_standard"
    elif body.plan_type == "premium":
        amount = 399 * 100  # paise
        payment_type = "listing_premium"
    else:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Invalid plan_type. Use 'standard' or 'premium'")

    from backend.services.payment_service import create_razorpay_order
    from backend.core.config import settings

    order = create_razorpay_order(amount, receipt=f"plan_{current_user.id}_{body.plan_type}")

    payment = Payment(
        user_id=current_user.id,
        payment_type=payment_type,
        amount=amount // 100,
        razorpay_order_id=order["id"],
        status="pending",
        extra_data={"plan_type": body.plan_type},
    )
    db.add(payment)
    await db.flush()

    return {
        "order_id": order["id"],
        "amount": amount,
        "currency": "INR",
        "key_id": settings.RAZORPAY_KEY_ID,
    }
