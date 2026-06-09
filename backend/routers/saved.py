from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, delete
from backend.db.dependencies import get_db, get_current_user
from backend.models.saved_listing import SavedListing
from backend.models.listing import Listing
from backend.services.listing_service import get_listing
from backend.core.exceptions import ConflictError
from typing import List

router = APIRouter(prefix="/saved", tags=["saved"])


@router.get("/")
async def get_saved(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Get all saved listings for current user."""
    result = await db.execute(
        select(SavedListing).where(SavedListing.user_id == current_user.id).order_by(SavedListing.created_at.desc())
    )
    saved_items = result.scalars().all()

    listings = []
    for item in saved_items:
        try:
            listing_data = await get_listing(db, str(item.listing_id), viewer_id=current_user.id)
            listings.append(listing_data)
        except Exception:
            continue

    return listings


@router.post("/")
async def save_listing(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Save/bookmark a listing."""
    listing_id = body.get("listing_id")
    if not listing_id:
        from backend.core.exceptions import BadRequestError
        raise BadRequestError("listing_id is required")

    # Check if already saved
    result = await db.execute(
        select(SavedListing).where(
            and_(SavedListing.user_id == current_user.id, SavedListing.listing_id == listing_id)
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        return {"message": "Already saved", "status": "already_saved"}

    saved = SavedListing(user_id=current_user.id, listing_id=listing_id)
    db.add(saved)

    # Increment save count
    listing_result = await db.execute(select(Listing).where(Listing.id == listing_id))
    listing = listing_result.scalar_one_or_none()
    if listing:
        listing.save_count = (listing.save_count or 0) + 1

    await db.flush()
    return {"message": "Saved", "status": "saved"}


@router.delete("/{listing_id}")
async def unsave_listing(
    listing_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Remove a saved listing."""
    result = await db.execute(
        select(SavedListing).where(
            and_(SavedListing.user_id == current_user.id, SavedListing.listing_id == listing_id)
        )
    )
    saved = result.scalar_one_or_none()
    if saved:
        await db.delete(saved)

        # Decrement save count
        listing_result = await db.execute(select(Listing).where(Listing.id == listing_id))
        listing = listing_result.scalar_one_or_none()
        if listing and listing.save_count and listing.save_count > 0:
            listing.save_count -= 1

        await db.flush()
    return {"message": "Unsaved"}
