from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum
from datetime import date, datetime
import uuid


class ListingType(str, Enum):
    room_available = "room_available"
    roommate_needed = "roommate_needed"


class PropertyType(str, Enum):
    shared_room = "shared_room"
    one_rk = "1rk"
    one_bhk = "1bhk"
    two_bhk = "2bhk"
    three_bhk = "3bhk"
    pg = "pg"
    hostel = "hostel"


class GenderPreference(str, Enum):
    any = "any"
    boys = "boys"
    girls = "girls"
    family = "family"


class Furnishing(str, Enum):
    unfurnished = "unfurnished"
    semi = "semi"
    fully = "fully"


class Parking(str, Enum):
    none = "none"
    bike = "bike"
    car = "car"
    both = "both"


class ListingPlan(str, Enum):
    basic = "basic"
    standard = "standard"
    premium = "premium"


class ListingCreate(BaseModel):
    listing_type: ListingType = ListingType.room_available
    property_type: PropertyType
    gender_preference: GenderPreference = GenderPreference.any
    furnishing: Furnishing = Furnishing.unfurnished
    floor: Optional[str] = None
    parking: Parking = Parking.none
    city: str
    area: str
    full_address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    rent: int = Field(gt=0)
    deposit: int = Field(ge=0)
    available_from: date
    description: Optional[str] = None
    photos: List[str] = []
    listing_plan: ListingPlan = ListingPlan.basic
    title: Optional[str] = None
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    razorpay_signature: Optional[str] = None


class ListingUpdate(BaseModel):
    listing_type: Optional[ListingType] = None
    title: Optional[str] = None
    property_type: Optional[PropertyType] = None
    gender_preference: Optional[GenderPreference] = None
    furnishing: Optional[Furnishing] = None
    floor: Optional[str] = None
    parking: Optional[Parking] = None
    city: Optional[str] = None
    area: Optional[str] = None
    full_address: Optional[str] = None
    rent: Optional[int] = None
    deposit: Optional[int] = None
    available_from: Optional[date] = None
    description: Optional[str] = None
    photos: Optional[List[str]] = None
    is_active: Optional[bool] = None


class ListingResponse(BaseModel):
    id: uuid.UUID
    owner_id: uuid.UUID
    listing_type: str = "room_available"
    title: Optional[str] = None
    property_type: str
    gender_preference: str
    furnishing: str
    floor: Optional[str] = None
    parking: str
    city: str
    area: str
    full_address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    rent: int
    deposit: int
    available_from: date
    description: Optional[str] = None
    photos: List[str] = []
    listing_plan: str
    is_boosted: bool = False
    boost_expires_at: Optional[datetime] = None
    status: str = "pending"
    is_active: bool = True
    is_verified: bool = False
    expires_at: Optional[datetime] = None
    view_count: int = 0
    unlock_count: int = 0
    save_count: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None
    is_saved: Optional[bool] = None
    is_unlocked: Optional[bool] = None
    owner_name: Optional[str] = None
    owner_phone: Optional[str] = None

    class Config:
        from_attributes = True


class SearchFilters(BaseModel):
    listing_type: Optional[str] = None
    city: Optional[str] = None
    area: Optional[str] = None
    property_type: Optional[List[str]] = None
    gender_preference: Optional[str] = None
    furnishing: Optional[List[str]] = None
    min_rent: Optional[int] = None
    max_rent: Optional[int] = None
    parking: Optional[List[str]] = None
    sort_by: Optional[str] = "newest"  # newest | rent_asc | rent_desc
    page: int = 1
    page_size: int = 12


LISTING_PLANS = {
    "basic": {
        "price": 0,
        "duration_days": 30,
        "max_photos": 5,
        "features": [
            "1 listing for 30 days",
            "Up to 5 photos",
            "Appears in search",
        ],
    },
    "standard": {
        "price": 199,
        "duration_days": 30,
        "max_photos": 15,
        "features": [
            "Top of search in your area",
            "Featured badge",
            "Up to 15 photos",
            "View & unlock analytics",
        ],
    },
    "premium": {
        "price": 399,
        "duration_days": 30,
        "max_photos": 999,
        "features": [
            "#1 placement city-wide",
            "Verified + Premium badge",
            "Unlimited photos + video",
            "Full analytics",
            "Push notification to seekers",
            "Priority support",
        ],
    },
}

PRICING = {
    "contact_single": 29,
    "monthly_plan": 299,
    "boost_7": 49,
    "boost_15": 89,
    "listing_standard": 199,
    "listing_premium": 399,
}
