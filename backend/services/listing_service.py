from datetime import datetime, timedelta, timezone
from typing import Optional, List
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, update, desc, asc
from backend.models.listing import Listing
from backend.models.saved_listing import SavedListing
from backend.models.contact_unlock import ContactUnlock
from backend.models.listing_view import ListingView
from backend.models.user import User
from backend.schemas.listing import ListingCreate, ListingUpdate, SearchFilters
from backend.core.exceptions import NotFoundError, ForbiddenError


async def create_listing(db: AsyncSession, data: ListingCreate, owner_id: uuid.UUID) -> Listing:
    """Create a new listing."""
    # Verify payment if plan is not basic
    if data.listing_plan in ("standard", "premium"):
        if not data.razorpay_order_id or not data.razorpay_payment_id or not data.razorpay_signature:
            from backend.core.exceptions import BadRequestError
            raise BadRequestError("Payment details are required for standard or premium plan")
        
        from backend.services.payment_service import verify_razorpay_signature
        valid = verify_razorpay_signature(
            data.razorpay_order_id, data.razorpay_payment_id, data.razorpay_signature
        )
        if not valid:
            from backend.core.exceptions import BadRequestError
            raise BadRequestError("Payment verification failed")
        
        # Save payment as success
        from backend.models.payment import Payment
        result = await db.execute(
            select(Payment).where(Payment.razorpay_order_id == data.razorpay_order_id)
        )
        payment = result.scalar_one_or_none()
        if payment:
            payment.razorpay_payment_id = data.razorpay_payment_id
            payment.status = "success"
        else:
            amount = 199 if data.listing_plan == "standard" else 399
            payment = Payment(
                user_id=owner_id,
                payment_type=f"listing_{data.listing_plan}",
                amount=amount,
                razorpay_order_id=data.razorpay_order_id,
                razorpay_payment_id=data.razorpay_payment_id,
                status="success",
            )
            db.add(payment)

    # Auto-generate title if not provided
    title = data.title
    if not title:
        type_labels = {
            "shared_room": "Shared Room",
            "1rk": "1 RK",
            "1bhk": "1 BHK",
            "2bhk": "2 BHK",
            "3bhk": "3 BHK",
            "pg": "PG",
            "hostel": "Hostel",
        }
        type_label = type_labels.get(data.property_type, data.property_type)
        if data.listing_type == "roommate_needed":
            title = f"Roommate needed ({type_label}) in {data.area}, {data.city}"
        else:
            title = f"{type_label} in {data.area}, {data.city}"

    listing = Listing(
        owner_id=owner_id,
        listing_type=data.listing_type,
        title=title,
        property_type=data.property_type,
        gender_preference=data.gender_preference,
        furnishing=data.furnishing,
        floor=data.floor,
        parking=data.parking,
        city=data.city,
        area=data.area,
        full_address=data.full_address,
        latitude=data.latitude,
        longitude=data.longitude,
        rent=data.rent,
        deposit=data.deposit,
        available_from=data.available_from,
        description=data.description,
        photos=data.photos or [],
        listing_plan=data.listing_plan,
        status="pending",
        expires_at=datetime.now(timezone.utc) + timedelta(days=30),
    )
    db.add(listing)
    await db.flush()
    await db.refresh(listing)

    # Update owner role to 'owner' if still seeker
    result = await db.execute(select(User).where(User.id == owner_id))
    owner = result.scalar_one_or_none()
    if owner and owner.role == "seeker":
        owner.role = "owner"
        await db.flush()

    return listing


async def get_listing(
    db: AsyncSession, listing_id: str, viewer_id: Optional[uuid.UUID] = None
) -> dict:
    """Get a single listing with viewer-specific flags."""
    result = await db.execute(select(Listing).where(Listing.id == listing_id))
    listing = result.scalar_one_or_none()
    if not listing:
        raise NotFoundError("Listing not found")

    # Get owner info
    owner_result = await db.execute(select(User).where(User.id == listing.owner_id))
    owner = owner_result.scalar_one_or_none()

    is_saved = False
    is_unlocked = False
    owner_phone = None

    if viewer_id:
        # Check if saved
        save_result = await db.execute(
            select(SavedListing).where(
                and_(SavedListing.user_id == viewer_id, SavedListing.listing_id == listing.id)
            )
        )
        is_saved = save_result.scalar_one_or_none() is not None

        # Check if unlocked
        unlock_result = await db.execute(
            select(ContactUnlock).where(
                and_(ContactUnlock.seeker_id == viewer_id, ContactUnlock.listing_id == listing.id)
            )
        )
        unlock = unlock_result.scalar_one_or_none()
        if unlock:
            is_unlocked = True
            owner_phone = owner.phone if owner else None

        # Check if viewer is the owner
        if viewer_id == listing.owner_id:
            is_unlocked = True
            owner_phone = owner.phone if owner else None

        # Check if viewer has active plan
        if not is_unlocked and viewer_id:
            viewer_result = await db.execute(select(User).where(User.id == viewer_id))
            viewer = viewer_result.scalar_one_or_none()
            if viewer and viewer.plan_type == "monthly" and viewer.plan_expires_at and viewer.plan_expires_at > datetime.now(timezone.utc):
                is_unlocked = True
                owner_phone = owner.phone if owner else None

    return {
        "id": listing.id,
        "owner_id": listing.owner_id,
        "listing_type": listing.listing_type,
        "title": listing.title,
        "property_type": listing.property_type,
        "gender_preference": listing.gender_preference,
        "furnishing": listing.furnishing,
        "floor": listing.floor,
        "parking": listing.parking,
        "city": listing.city,
        "area": listing.area,
        "full_address": listing.full_address,
        "latitude": float(listing.latitude) if listing.latitude else None,
        "longitude": float(listing.longitude) if listing.longitude else None,
        "rent": listing.rent,
        "deposit": listing.deposit,
        "available_from": listing.available_from,
        "description": listing.description,
        "photos": listing.photos or [],
        "listing_plan": listing.listing_plan,
        "is_boosted": listing.is_boosted,
        "boost_expires_at": listing.boost_expires_at,
        "is_active": listing.is_active,
        "is_verified": listing.is_verified,
        "expires_at": listing.expires_at,
        "view_count": listing.view_count,
        "unlock_count": listing.unlock_count,
        "save_count": listing.save_count,
        "created_at": listing.created_at,
        "updated_at": listing.updated_at,
        "is_saved": is_saved,
        "is_unlocked": is_unlocked,
        "owner_name": owner.full_name if owner else None,
        "owner_phone": owner_phone,
    }


async def get_listings(
    db: AsyncSession, filters: SearchFilters, viewer_id: Optional[uuid.UUID] = None
) -> List[dict]:
    """Get listings with filters, sorting, and pagination."""
    query = select(Listing).where(and_(Listing.is_active == True, Listing.status == "approved"))

    if filters.listing_type and filters.listing_type != "both":
        query = query.where(Listing.listing_type == filters.listing_type)
    if filters.city:
        query = query.where(func.lower(Listing.city) == filters.city.lower())
    if filters.area:
        query = query.where(func.lower(Listing.area).contains(filters.area.lower()))
    if filters.property_type:
        query = query.where(Listing.property_type.in_(filters.property_type))
    if filters.gender_preference:
        query = query.where(Listing.gender_preference == filters.gender_preference)
    if filters.furnishing:
        query = query.where(Listing.furnishing.in_(filters.furnishing))
    if filters.min_rent:
        query = query.where(Listing.rent >= filters.min_rent)
    if filters.max_rent:
        query = query.where(Listing.rent <= filters.max_rent)
    if filters.parking:
        query = query.where(Listing.parking.in_(filters.parking))

    # Boosted listings first, then sort
    if filters.sort_by == "rent_asc":
        query = query.order_by(desc(Listing.is_boosted), asc(Listing.rent))
    elif filters.sort_by == "rent_desc":
        query = query.order_by(desc(Listing.is_boosted), desc(Listing.rent))
    else:  # newest
        query = query.order_by(desc(Listing.is_boosted), desc(Listing.created_at))

    # Pagination
    offset = (filters.page - 1) * filters.page_size
    query = query.offset(offset).limit(filters.page_size)

    result = await db.execute(query)
    listings = result.scalars().all()

    # Pre-fetch all saved listing IDs for the viewer to avoid N+1 query issue
    saved_listing_ids = set()
    if viewer_id and listings:
        listing_ids = [l.id for l in listings]
        save_result = await db.execute(
            select(SavedListing.listing_id).where(
                and_(
                    SavedListing.user_id == viewer_id,
                    SavedListing.listing_id.in_(listing_ids)
                )
            )
        )
        saved_listing_ids = set(save_result.scalars().all())

    # Build response list
    response = []
    for listing in listings:
        is_saved = listing.id in saved_listing_ids

        response.append({
            "id": listing.id,
            "owner_id": listing.owner_id,
            "listing_type": listing.listing_type,
            "title": listing.title,
            "property_type": listing.property_type,
            "gender_preference": listing.gender_preference,
            "furnishing": listing.furnishing,
            "floor": listing.floor,
            "parking": listing.parking,
            "city": listing.city,
            "area": listing.area,
            "full_address": listing.full_address,
            "latitude": float(listing.latitude) if listing.latitude else None,
            "longitude": float(listing.longitude) if listing.longitude else None,
            "rent": listing.rent,
            "deposit": listing.deposit,
            "available_from": listing.available_from,
            "description": listing.description,
            "photos": listing.photos or [],
            "listing_plan": listing.listing_plan,
            "is_boosted": listing.is_boosted,
            "boost_expires_at": listing.boost_expires_at,
            "is_active": listing.is_active,
            "is_verified": listing.is_verified,
            "expires_at": listing.expires_at,
            "view_count": listing.view_count,
            "unlock_count": listing.unlock_count,
            "save_count": listing.save_count,
            "created_at": listing.created_at,
            "updated_at": listing.updated_at,
            "is_saved": is_saved,
            "is_unlocked": None,
            "owner_name": None,
            "owner_phone": None,
        })

    return response


async def get_owner_listings(db: AsyncSession, owner_id: uuid.UUID) -> List[dict]:
    """Get all listings for an owner."""
    result = await db.execute(
        select(Listing).where(Listing.owner_id == owner_id).order_by(desc(Listing.created_at))
    )
    listings = result.scalars().all()
    response = []
    for listing in listings:
        response.append({
            "id": listing.id,
            "owner_id": listing.owner_id,
            "listing_type": listing.listing_type,
            "title": listing.title,
            "property_type": listing.property_type,
            "gender_preference": listing.gender_preference,
            "furnishing": listing.furnishing,
            "floor": listing.floor,
            "parking": listing.parking,
            "city": listing.city,
            "area": listing.area,
            "full_address": listing.full_address,
            "latitude": float(listing.latitude) if listing.latitude else None,
            "longitude": float(listing.longitude) if listing.longitude else None,
            "rent": listing.rent,
            "deposit": listing.deposit,
            "available_from": listing.available_from,
            "description": listing.description,
            "photos": listing.photos or [],
            "listing_plan": listing.listing_plan,
            "is_boosted": listing.is_boosted,
            "boost_expires_at": listing.boost_expires_at,
            "is_active": listing.is_active,
            "is_verified": listing.is_verified,
            "expires_at": listing.expires_at,
            "view_count": listing.view_count,
            "unlock_count": listing.unlock_count,
            "save_count": listing.save_count,
            "created_at": listing.created_at,
            "updated_at": listing.updated_at,
            "is_saved": None,
            "is_unlocked": None,
            "owner_name": None,
            "owner_phone": None,
        })
    return response


async def update_listing(
    db: AsyncSession, listing_id: str, data: dict, owner_id: uuid.UUID
) -> dict:
    """Update a listing owned by the current user."""
    result = await db.execute(select(Listing).where(Listing.id == listing_id))
    listing = result.scalar_one_or_none()
    if not listing:
        raise NotFoundError("Listing not found")
    if listing.owner_id != owner_id:
        raise ForbiddenError("You can only edit your own listings")

    for key, value in data.items():
        if hasattr(listing, key) and key not in ("id", "owner_id", "created_at"):
            setattr(listing, key, value)
    await db.flush()
    await db.refresh(listing)
    return await get_listing(db, listing_id, viewer_id=owner_id)


async def delete_listing(db: AsyncSession, listing_id: str, owner_id: uuid.UUID):
    """Delete a listing owned by the current user."""
    result = await db.execute(select(Listing).where(Listing.id == listing_id))
    listing = result.scalar_one_or_none()
    if not listing:
        raise NotFoundError("Listing not found")
    if listing.owner_id != owner_id:
        raise ForbiddenError("You can only delete your own listings")
    await db.delete(listing)
    await db.flush()


async def record_view(db: AsyncSession, listing_id: str, viewer_id: Optional[uuid.UUID] = None):
    """Record a listing view and increment count."""
    view = ListingView(listing_id=listing_id, viewer_id=viewer_id)
    db.add(view)
    await db.execute(
        update(Listing).where(Listing.id == listing_id).values(view_count=Listing.view_count + 1)
    )
    await db.flush()


async def get_pending_listings(db: AsyncSession) -> List[dict]:
    """Get all listings with status=pending (admin only)."""
    result = await db.execute(
        select(Listing, User)
        .join(User, Listing.owner_id == User.id)
        .where(Listing.status == "pending")
        .order_by(desc(Listing.created_at))
    )
    rows = result.all()
    response = []
    for listing, owner in rows:
        response.append({
            "id": listing.id,
            "owner_id": listing.owner_id,
            "listing_type": listing.listing_type,
            "title": listing.title,
            "property_type": listing.property_type,
            "gender_preference": listing.gender_preference,
            "furnishing": listing.furnishing,
            "floor": listing.floor,
            "parking": listing.parking,
            "city": listing.city,
            "area": listing.area,
            "full_address": listing.full_address,
            "latitude": float(listing.latitude) if listing.latitude else None,
            "longitude": float(listing.longitude) if listing.longitude else None,
            "rent": listing.rent,
            "deposit": listing.deposit,
            "available_from": listing.available_from,
            "description": listing.description,
            "photos": listing.photos or [],
            "listing_plan": listing.listing_plan,
            "is_boosted": listing.is_boosted,
            "boost_expires_at": listing.boost_expires_at,
            "is_active": listing.is_active,
            "is_verified": listing.is_verified,
            "status": listing.status,
            "expires_at": listing.expires_at,
            "view_count": listing.view_count,
            "unlock_count": listing.unlock_count,
            "save_count": listing.save_count,
            "created_at": listing.created_at,
            "updated_at": listing.updated_at,
            "is_saved": None,
            "is_unlocked": None,
            "owner_name": owner.full_name if owner else None,
            "owner_phone": None,
        })
    return response


async def approve_listing(db: AsyncSession, listing_id: str) -> dict:
    """Approve a listing (admin only)."""
    result = await db.execute(select(Listing).where(Listing.id == listing_id))
    listing = result.scalar_one_or_none()
    if not listing:
        raise NotFoundError("Listing not found")
    listing.status = "approved"
    await db.flush()
    await db.refresh(listing)
    return {"id": listing.id, "status": listing.status}


async def reject_listing(db: AsyncSession, listing_id: str) -> dict:
    """Reject a listing (admin only)."""
    result = await db.execute(select(Listing).where(Listing.id == listing_id))
    listing = result.scalar_one_or_none()
    if not listing:
        raise NotFoundError("Listing not found")
    listing.status = "rejected"
    await db.flush()
    await db.refresh(listing)
    return {"id": listing.id, "status": listing.status}


async def expire_old_listings():
    """Expire listings past their expiry date. Called by APScheduler."""
    from backend.db.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        try:
            await db.execute(
                update(Listing)
                .where(and_(Listing.expires_at < datetime.now(timezone.utc), Listing.is_active == True))
                .values(is_active=False)
            )
            await db.commit()
        except Exception:
            await db.rollback()
