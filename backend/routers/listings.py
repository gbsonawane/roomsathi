from fastapi import APIRouter, Depends, Query, UploadFile, File
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from backend.db.dependencies import get_db, get_current_user, get_current_user_optional
from backend.schemas.listing import ListingCreate, ListingResponse, SearchFilters
from backend.services.listing_service import (
    create_listing, get_listing, get_listings, get_owner_listings,
    update_listing, delete_listing, record_view,
)
from backend.services.storage_service import save_photo
from backend.core.exceptions import BadRequestError
import uuid

router = APIRouter(prefix="/listings", tags=["listings"])


@router.get("/", response_model=List[ListingResponse])
async def list_listings(
    listing_type: Optional[str] = None,
    city: Optional[str] = None,
    area: Optional[str] = None,
    property_type: Optional[str] = None,
    gender_preference: Optional[str] = None,
    furnishing: Optional[str] = None,
    min_rent: Optional[int] = None,
    max_rent: Optional[int] = None,
    parking: Optional[str] = None,
    sort_by: Optional[str] = "newest",
    page: int = 1,
    page_size: int = 12,
    owner: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user_optional),
):
    """Get listings with optional filters."""
    # If owner=me, return owner's listings
    if owner == "me" and current_user:
        return await get_owner_listings(db, current_user.id)

    filters = SearchFilters(
        listing_type=listing_type,
        city=city,
        area=area,
        property_type=property_type.split(",") if property_type else None,
        gender_preference=gender_preference,
        furnishing=furnishing.split(",") if furnishing else None,
        min_rent=min_rent,
        max_rent=max_rent,
        parking=parking.split(",") if parking else None,
        sort_by=sort_by,
        page=page,
        page_size=page_size,
    )
    viewer_id = current_user.id if current_user else None
    return await get_listings(db, filters, viewer_id=viewer_id)


@router.post("/", response_model=ListingResponse)
async def post_listing(
    body: ListingCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Create a new listing."""
    listing = await create_listing(db, body, owner_id=current_user.id)
    return await get_listing(db, str(listing.id), viewer_id=current_user.id)


@router.get("/{listing_id}", response_model=ListingResponse)
async def get_one(
    listing_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user_optional),
):
    """Get a single listing by ID."""
    viewer_id = current_user.id if current_user else None
    return await get_listing(db, listing_id, viewer_id=viewer_id)


@router.patch("/{listing_id}", response_model=ListingResponse)
async def edit_listing(
    listing_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Update a listing."""
    return await update_listing(db, listing_id, body, owner_id=current_user.id)


@router.delete("/{listing_id}")
async def remove_listing(
    listing_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Delete a listing."""
    await delete_listing(db, listing_id, owner_id=current_user.id)
    return {"message": "Deleted"}


@router.post("/{listing_id}/view")
async def track_view(
    listing_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user_optional),
):
    """Record a view on a listing."""
    viewer_id = current_user.id if current_user else None
    await record_view(db, listing_id, viewer_id=viewer_id)
    return {"message": "View recorded"}


@router.post("/upload-photos")
async def upload_photos(
    files: List[UploadFile] = File(...),
    current_user=Depends(get_current_user),
):
    """Upload listing photos. Returns list of URLs."""
    urls = []
    listing_id = uuid.uuid4().hex[:12]
    
    # Allowed mime types and extensions
    allowed_types = ["image/jpeg", "image/png", "image/webp"]
    allowed_exts = [".jpg", ".jpeg", ".png", ".webp"]
    
    for file in files:
        # Check size (5MB = 5 * 1024 * 1024 bytes)
        content = await file.read()
        if len(content) > 5 * 1024 * 1024:
            raise BadRequestError(f"File {file.filename} is larger than the 5MB size limit")
            
        content_type = file.content_type or ""
        filename = (file.filename or "").lower()
        is_valid_type = (
            content_type in allowed_types or
            any(filename.endswith(ext) for ext in allowed_exts)
        )
        if not is_valid_type:
            raise BadRequestError(f"File {file.filename} must be a JPEG, PNG, or WebP image")
            
        url = await save_photo(content, file.filename, listing_id)
        urls.append(url)
    return {"urls": urls}
