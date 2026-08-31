from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, and_, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.dependencies import get_db, get_current_user
from backend.models.notification import Notification
from backend.core.exceptions import NotFoundError

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _serialize(n: Notification) -> dict:
    return {
        "id": str(n.id),
        "type": n.type,
        "title": n.title,
        "body": n.body,
        "is_read": n.is_read,
        "metadata": n.extra_data or {},
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }


@router.get("/unread-count")
async def unread_count(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Unread notification count for the nav bell badge."""
    result = await db.execute(
        select(func.count())
        .select_from(Notification)
        .where(
            and_(
                Notification.user_id == current_user.id,
                Notification.is_read == False,  # noqa: E712
            )
        )
    )
    return {"count": int(result.scalar() or 0)}


@router.get("")
@router.get("/")
async def list_notifications(
    unread_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return notifications for the current user (newest first)."""
    q = select(Notification).where(Notification.user_id == current_user.id)
    if unread_only:
        q = q.where(Notification.is_read == False)  # noqa: E712
    q = q.order_by(Notification.created_at.desc())
    result = await db.execute(q)
    return [_serialize(n) for n in result.scalars().all()]


@router.patch("/read-all")
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Mark all of the current user's notifications as read."""
    await db.execute(
        update(Notification)
        .where(
            and_(
                Notification.user_id == current_user.id,
                Notification.is_read == False,  # noqa: E712
            )
        )
        .values(is_read=True)
    )
    await db.flush()
    return {"status": "ok"}


@router.patch("/{notification_id}/read")
async def mark_one_read(
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Mark a single notification as read."""
    result = await db.execute(
        select(Notification).where(
            and_(
                Notification.id == notification_id,
                Notification.user_id == current_user.id,
            )
        )
    )
    notification = result.scalar_one_or_none()
    if not notification:
        raise NotFoundError("Notification not found")
    notification.is_read = True
    await db.flush()
    return _serialize(notification)
