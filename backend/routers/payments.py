from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.db.dependencies import get_db, get_current_user
from backend.models.payment import Payment
from backend.schemas.payment import PaymentResponse, PlanOrderRequest, CreateOrderResponse
from typing import List, Optional

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


@router.get("/all")
async def get_all_payments(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Get all payments (admin only)."""
    from fastapi import HTTPException
    from sqlalchemy import func as sa_func
    from backend.models.user import User

    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    # Build query with user join
    query = (
        select(Payment, User)
        .join(User, Payment.user_id == User.id)
        .order_by(Payment.created_at.desc())
        .limit(500)
    )
    if status:
        query = query.where(Payment.status == status)

    result = await db.execute(query)
    rows = result.all()

    # Total revenue from successful payments
    rev_result = await db.execute(
        select(sa_func.sum(Payment.amount)).where(Payment.status == "success")
    )
    total_revenue = rev_result.scalar() or 0

    payments_data = []
    for payment, user in rows:
        payments_data.append({
            "id": str(payment.id),
            "user_id": str(payment.user_id),
            "user_name": user.full_name if user else "Unknown",
            "payment_type": payment.payment_type,
            "amount": payment.amount,
            "currency": payment.currency,
            "status": payment.status,
            "created_at": payment.created_at.isoformat() if payment.created_at else None,
        })

    return {"payments": payments_data, "total_revenue": total_revenue}
