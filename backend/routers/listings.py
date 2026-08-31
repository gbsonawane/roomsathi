from fastapi import APIRouter, Depends, Query, UploadFile, File, HTTPException
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from backend.db.dependencies import get_db, get_current_user, get_current_user_optional
from backend.schemas.listing import ListingCreate, ListingResponse, SearchFilters, PaginatedListings
from backend.services.listing_service import (
    create_listing, get_listing, get_listings, get_owner_listings,
    update_listing, delete_listing, record_view,
    get_pending_listings, approve_listing, reject_listing,
)
from backend.services.storage_service import save_photo
from backend.services import ai_service
from backend.core.exceptions import BadRequestError
import uuid

router = APIRouter(prefix="/listings", tags=["listings"])

# Magic-byte signatures for allowed image types
_JPEG_MAGIC = b"\xff\xd8\xff"
_PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


def _detect_image_magic(content: bytes) -> str | None:
    """Return 'jpeg' | 'png' | 'webp' if file bytes match a known image signature."""
    if content.startswith(_JPEG_MAGIC):
        return "jpeg"
    if content.startswith(_PNG_MAGIC):
        return "png"
    if len(content) >= 12 and content[0:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "webp"
    return None


@router.get("/", response_model=PaginatedListings)
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
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user_optional),
):
    """Get listings with optional filters."""
    # If owner=me, return owner's listings
    if owner == "me" and current_user:
        items = await get_owner_listings(db, current_user.id)
        return {"items": items, "total": len(items), "page": 1, "page_size": max(len(items), 1), "total_pages": 1}

    # Admin-only: return pending listings
    if status == "pending" and current_user and current_user.role == "admin":
        items = await get_pending_listings(db)
        return {"items": items, "total": len(items), "page": 1, "page_size": max(len(items), 1), "total_pages": 1}

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

        # Magic-byte check — reject spoofed MIME/extension
        magic_kind = _detect_image_magic(content)
        if magic_kind is None:
            raise BadRequestError(
                f"File {file.filename} content is not a valid JPEG, PNG, or WebP image"
            )

        url = await save_photo(content, file.filename, listing_id)
        urls.append(url)
    return {"urls": urls}


@router.get("/pending", response_model=List[ListingResponse])
async def list_pending_listings(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Get all pending listings (admin only)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return await get_pending_listings(db)


@router.patch("/{listing_id}/approve")
async def approve_listing_route(
    listing_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Approve a listing (admin only)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return await approve_listing(db, listing_id)


@router.patch("/{listing_id}/reject")
async def reject_listing_route(
    listing_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Reject a listing (admin only)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return await reject_listing(db, listing_id)


@router.post("/generate-description")
async def generate_description(
    body: dict,
    current_user=Depends(get_current_user),
):
    """Generate a listing description using AI based on form fields."""
    description = await ai_service.generate_listing_description(body)
    return {"description": description}


@router.post("/generate-title")
async def generate_title(
    body: dict,
    current_user=Depends(get_current_user),
):
    """Generate a short listing title using AI based on form fields."""
    title = await ai_service.generate_listing_title(body)
    return {"title": title}


@router.post("/score-description")
async def score_description(
    body: dict,
    current_user=Depends(get_current_user),
):
    """Rate the quality of a listing description using AI (1-5 stars). Silent fail."""
    description = body.get("description", "")
    if len(description) < 20:
        return {"score": 0, "tip": ""}
    result = await ai_service.score_listing_description(description)
    return result


@router.post("/parse-search")
async def parse_search(
    body: dict,
    current_user=Depends(get_current_user),
):
    """Parse a natural language query into listing search filters. Silent fail."""
    try:
        query = body.get("query", "")
        if not query or len(query.strip()) < 3:
            return {}
        result = await ai_service.parse_search_query(query)
        return result
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Error in parse_search endpoint: {e}")
        return {}


@router.post("/{listing_id}/chat")
async def chat_listing(
    listing_id: str,
    body: dict,
    current_user=Depends(get_current_user),
):
    """Chat with RoomSathi Assistant about a specific listing."""
    messages = body.get("messages")
    listing_context = body.get("listing_context", {})

    if not isinstance(messages, list) or not messages:
        raise HTTPException(status_code=400, detail="Messages must be a non-empty list")
    
    if messages[-1].get("role") != "user":
        raise HTTPException(status_code=400, detail="Last message must be from user")

    # cap at last 10 messages
    history = messages[-10:]

    reply = await ai_service.chat_with_assistant(history, listing_context)
    return {"reply": reply}


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
