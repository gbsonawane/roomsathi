import logging
import httpx
from fastapi import HTTPException
from backend.core.config import settings

logger = logging.getLogger(__name__)

NVIDIA_NIM_URL = "https://integrate.api.nvidia.com/v1/chat/completions"
NVIDIA_MODEL = "nvidia/llama-3.1-nemotron-70b-instruct"

SYSTEM_PROMPT = (
    "You are a helpful assistant for an Indian room rental platform called RoomSathi. "
    "Write a short, friendly, and honest 3-4 sentence room listing description in simple English "
    "based on the details provided. Do not exaggerate. Do not mention price. "
    "Be specific about location and features."
)

TITLE_SYSTEM_PROMPT = (
    "You are a helpful assistant for an Indian room rental platform called RoomSathi. "
    "Write a single short listing title (max 10 words) for a room rental based on the details provided. "
    "Format: '[property_type] in [area], [city] — [one key feature]'. "
    "Example: '1BHK in Hinjewadi, Pune — Fully Furnished with Parking'. "
    "Return only the title, nothing else."
)


def _build_prompt(listing_data: dict) -> str:
    """Build a human-readable prompt from listing_data fields."""
    parts = []

    property_type = listing_data.get("property_type", "")
    listing_type = listing_data.get("listing_type", "")
    city = listing_data.get("city", "")
    area = listing_data.get("area", "")
    rent = listing_data.get("rent", "")
    deposit = listing_data.get("deposit", "")
    furnishing = listing_data.get("furnishing", "")
    parking = listing_data.get("parking", "")
    floor = listing_data.get("floor", "")
    gender_preference = listing_data.get("gender_preference", "")
    available_from = listing_data.get("available_from", "")

    if property_type:
        parts.append(f"Property Type: {property_type}")
    if listing_type:
        parts.append(f"Listing Type: {listing_type}")
    if city:
        parts.append(f"City: {city}")
    if area:
        parts.append(f"Area/Locality: {area}")
    if rent:
        parts.append(f"Monthly Rent: ₹{rent}")
    if deposit:
        parts.append(f"Security Deposit: ₹{deposit}")
    if furnishing:
        parts.append(f"Furnishing: {furnishing}")
    if parking:
        parts.append(f"Parking: {parking}")
    if floor:
        parts.append(f"Floor: {floor}")
    if gender_preference:
        parts.append(f"Gender Preference: {gender_preference}")
    if available_from:
        parts.append(f"Available From: {available_from}")

    return "Generate a listing description for the following room/flat:\n\n" + "\n".join(parts)


async def generate_listing_description(listing_data: dict) -> str:
    """
    Call NVIDIA NIM API to generate a compelling room listing description.

    Args:
        listing_data: dict containing room/flat details (property_type, city, area, etc.)

    Returns:
        Generated description string.

    Raises:
        HTTPException 502 if the AI service is unavailable or returns an error.
    """
    if not settings.NVIDIA_API_KEY:
        logger.error("NVIDIA_API_KEY is not configured.")
        raise HTTPException(status_code=502, detail="AI service unavailable")

    prompt = _build_prompt(listing_data)

    headers = {
        "Authorization": f"Bearer {settings.NVIDIA_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": NVIDIA_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": 300,
        "temperature": 0.7,
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(NVIDIA_NIM_URL, json=payload, headers=headers)

        if response.status_code != 200:
            logger.error(
                "NVIDIA NIM API returned status %d: %s",
                response.status_code,
                response.text,
            )
            raise HTTPException(status_code=502, detail="AI service unavailable")

        data = response.json()
        description = data["choices"][0]["message"]["content"].strip()
        return description

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error calling NVIDIA NIM API: %s", str(exc))
        raise HTTPException(status_code=502, detail="AI service unavailable")


async def generate_listing_title(listing_data: dict) -> str:
    """
    Call NVIDIA NIM API to generate a short listing title.

    Args:
        listing_data: dict with fields: property_type, city, area,
                      furnishing, gender_preference, listing_type

    Returns:
        Generated title string (max ~10 words).

    Raises:
        HTTPException 502 if the AI service is unavailable or returns an error.
    """
    if not settings.NVIDIA_API_KEY:
        logger.error("NVIDIA_API_KEY is not configured.")
        raise HTTPException(status_code=502, detail="AI service unavailable")

    property_type = listing_data.get("property_type", "")
    city = listing_data.get("city", "")
    area = listing_data.get("area", "")
    furnishing = listing_data.get("furnishing", "")
    gender_preference = listing_data.get("gender_preference", "")
    listing_type = listing_data.get("listing_type", "")

    parts = []
    if property_type:
        parts.append(f"Property Type: {property_type}")
    if listing_type:
        parts.append(f"Listing Type: {listing_type}")
    if city:
        parts.append(f"City: {city}")
    if area:
        parts.append(f"Area/Locality: {area}")
    if furnishing:
        parts.append(f"Furnishing: {furnishing}")
    if gender_preference:
        parts.append(f"Gender Preference: {gender_preference}")

    prompt = "Generate a listing title for the following room/flat:\n\n" + "\n".join(parts)

    headers = {
        "Authorization": f"Bearer {settings.NVIDIA_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": NVIDIA_MODEL,
        "messages": [
            {"role": "system", "content": TITLE_SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": 50,
        "temperature": 0.7,
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(NVIDIA_NIM_URL, json=payload, headers=headers)

        if response.status_code != 200:
            logger.error(
                "NVIDIA NIM API returned status %d: %s",
                response.status_code,
                response.text,
            )
            raise HTTPException(status_code=502, detail="AI service unavailable")

        data = response.json()
        title = data["choices"][0]["message"]["content"].strip()
        return title

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error calling NVIDIA NIM API: %s", str(exc))
        raise HTTPException(status_code=502, detail="AI service unavailable")
