from sqlalchemy.ext.asyncio import AsyncSession
from backend.models.notification import Notification
import uuid
import logging

logger = logging.getLogger(__name__)


async def create_notification(
    db: AsyncSession,
    user_id: uuid.UUID,
    type: str,
    title: str,
    body: str = "",
    metadata: dict = None,
):
    """Create an in-app notification for a user."""
    notification = Notification(
        user_id=user_id,
        type=type,
        title=title,
        body=body,
        extra_data=metadata or {},
    )
    db.add(notification)
    await db.flush()
    logger.info(f"Notification sent to {user_id}: {title}")
    return notification


async def notify_owner_contact_unlocked(db: AsyncSession, owner_id: uuid.UUID, seeker_name: str, listing_title: str):
    """Notify owner when someone unlocks their contact."""
    await create_notification(
        db=db,
        user_id=owner_id,
        type="contact_unlocked",
        title="New contact unlock! 🔓",
        body=f"{seeker_name} unlocked your contact for '{listing_title}'",
    )


async def notify_owner_listing_saved(db: AsyncSession, owner_id: uuid.UUID, listing_title: str):
    """Notify owner when someone saves their listing."""
    await create_notification(
        db=db,
        user_id=owner_id,
        type="listing_saved",
        title="Listing saved! ❤️",
        body=f"Someone saved your listing '{listing_title}'",
    )
