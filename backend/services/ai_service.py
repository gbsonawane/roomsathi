import logging
from typing import Optional
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


SCORE_SYSTEM_PROMPT = (
    "You are a listing quality checker for an Indian room rental platform. "
    "Rate the following listing description on a scale of 1 to 5 based on: "
    "clarity, specificity, and helpfulness for a room seeker. "
    "Respond in JSON only, no explanation, exactly in this format: "
    "{ \"score\": <1-5>, \"tip\": \"<one short improvement tip in under 10 words>\" } "
    "If score is 5, set tip to empty string."
)


async def score_listing_description(description: str) -> dict:
    """
    Call NVIDIA NIM API to rate the quality of a listing description.

    Returns a dict with keys:
        score (int 1-5): quality rating
        tip   (str):     short improvement tip, empty string if score 5

    Never raises — on any failure returns { "score": 0, "tip": "" }.
    """
    _silent_fail = {"score": 0, "tip": ""}

    if not settings.NVIDIA_API_KEY:
        logger.warning("NVIDIA_API_KEY not configured; skipping description score.")
        return _silent_fail

    headers = {
        "Authorization": f"Bearer {settings.NVIDIA_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": NVIDIA_MODEL,
        "messages": [
            {"role": "system", "content": SCORE_SYSTEM_PROMPT},
            {"role": "user", "content": description},
        ],
        "max_tokens": 80,
        "temperature": 0.3,
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(NVIDIA_NIM_URL, json=payload, headers=headers)

        if response.status_code != 200:
            logger.warning(
                "NVIDIA NIM returned %d for score request: %s",
                response.status_code,
                response.text,
            )
            return _silent_fail

        data = response.json()
        raw = data["choices"][0]["message"]["content"].strip()

        # Strip potential markdown code fences if the model wraps in ```json
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()

        import json as _json
        parsed = _json.loads(raw)
        score = int(parsed.get("score", 0))
        tip = str(parsed.get("tip", ""))
        if not (1 <= score <= 5):
            return _silent_fail
        return {"score": score, "tip": tip}

    except Exception as exc:
        logger.warning("Error scoring description (non-critical): %s", str(exc))
        return _silent_fail


SEARCH_PARSE_SYSTEM_PROMPT = """You are a search query parser for an Indian room rental platform called
    RoomSathi. Extract search parameters from natural language queries.
    Respond ONLY with a JSON object, no explanation, no markdown, no code fences.
    Use exactly these keys (omit a key if not mentioned):
    {
      'city': string,
      'area': string (locality name only, not city),
      'listing_type': 'room_available' | 'roommate_needed',
      'property_type': one of ['shared_room','1rk','1bhk','2bhk','3bhk','pg','hostel'],
      'gender_preference': 'any' | 'boys' | 'girls' | 'family',
      'min_rent': integer (monthly rent in INR),
      'max_rent': integer (monthly rent in INR),
      'furnishing': one of ['unfurnished','semi','fully'],
      'parking': one of ['none','bike','car','both']
    }
    Examples:
    Query: '2BHK near Hinjewadi under 15k girls only'
    Output: {'area':'Hinjewadi','property_type':'2bhk','max_rent':15000,'gender_preference':'girls'}

    Query: 'fully furnished 1rk in Kothrud Pune for boys with parking'
    Output: {'city':'Pune','area':'Kothrud','property_type':'1rk','furnishing':'fully','gender_preference':'boys','parking':'bike'}

    Query: 'looking for roommate in Baner under 8000'
    Output: {'area':'Baner','listing_type':'roommate_needed','max_rent':8000}"""


async def parse_search_query(query: str) -> dict:
    """
    Call NVIDIA NIM API to parse a natural language search query.
    Returns: dict containing the parsed elements validated against schema.
    """
    _empty = {}

    if not settings.NVIDIA_API_KEY:
        logger.error("NVIDIA_API_KEY is not configured.")
        return _empty

    headers = {
        "Authorization": f"Bearer {settings.NVIDIA_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": NVIDIA_MODEL,
        "messages": [
            {"role": "system", "content": SEARCH_PARSE_SYSTEM_PROMPT},
            {"role": "user", "content": query},
        ],
        "max_tokens": 200,
        "temperature": 0.1,
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
            return _empty

        data = response.json()
        raw = data["choices"][0]["message"]["content"].strip()

        # Strip potential markdown code fences if the model wraps in ```json or ```
        if raw.startswith("```"):
            raw = raw.replace("```json", "").replace("```", "").strip()

        import json as _json
        import ast

        parsed = {}
        try:
            parsed = _json.loads(raw)
        except Exception:
            try:
                parsed = ast.literal_eval(raw)
            except Exception:
                # Try simple single-quote to double-quote conversion if both fail
                try:
                    parsed = _json.loads(raw.replace("'", '"'))
                except Exception:
                    logger.warning("Failed to parse JSON response from search parser: %s", raw)
                    return _empty

        if not isinstance(parsed, dict):
            return _empty

        validated = {}

        # 1. city
        city = parsed.get("city")
        if city and isinstance(city, str):
            validated["city"] = city.strip()

        # 2. area
        area = parsed.get("area")
        if area and isinstance(area, str):
            validated["area"] = area.strip()

        # 3. listing_type
        listing_type = parsed.get("listing_type")
        if listing_type in ["room_available", "roommate_needed"]:
            validated["listing_type"] = listing_type

        # 4. property_type validation & aliases
        prop_aliases = {
            "1bhk": "1bhk", "1 bhk": "1bhk", "1-bhk": "1bhk",
            "2bhk": "2bhk", "2 bhk": "2bhk", "2-bhk": "2bhk",
            "3bhk": "3bhk", "3 bhk": "3bhk", "3-bhk": "3bhk",
            "1rk": "1rk", "1 rk": "1rk", "1-rk": "1rk", "studio": "1rk",
            "pg": "pg", "paying guest": "pg", "payingguest": "pg",
            "hostel": "hostel",
            "shared_room": "shared_room", "shared room": "shared_room", "sharedroom": "shared_room", "shared": "shared_room"
        }
        prop_val = parsed.get("property_type")
        if prop_val and isinstance(prop_val, str):
            prop_normalized = prop_val.lower().strip()
            if prop_normalized in prop_aliases:
                validated["property_type"] = prop_aliases[prop_normalized]

        # 5. gender_preference
        gender_preference = parsed.get("gender_preference")
        if gender_preference in ["any", "boys", "girls", "family"]:
            validated["gender_preference"] = gender_preference

        # 6. min_rent & max_rent helper
        def parse_rent(val) -> Optional[int]:
            if val is None:
                return None
            if isinstance(val, int):
                return val
            if isinstance(val, float):
                return int(val)
            if isinstance(val, str):
                import re
                s = val.lower().strip()
                # Remove common non-numeric junk
                for junk in ["inr", "rs", "₹", ",", "monthly", "p.m", "pm", "/mo", "rent"]:
                    s = s.replace(junk, "")
                s = s.strip()
                multiplier = 1
                if "k" in s:
                    multiplier = 1000
                    s = s.replace("k", "")
                elif "lakh" in s:
                    multiplier = 100000
                    s = s.replace("lakh", "")
                nums = re.findall(r'\d+', s)
                if nums:
                    return int(nums[0]) * multiplier
            return None

        min_rent = parse_rent(parsed.get("min_rent"))
        if min_rent is not None:
            validated["min_rent"] = min_rent

        max_rent = parse_rent(parsed.get("max_rent"))
        if max_rent is not None:
            validated["max_rent"] = max_rent

        # 7. furnishing
        furnishing = parsed.get("furnishing")
        if furnishing in ["unfurnished", "semi", "fully"]:
            validated["furnishing"] = furnishing

        # 8. parking
        parking = parsed.get("parking")
        if parking in ["none", "bike", "car", "both"]:
            validated["parking"] = parking

        return validated

    except Exception as exc:
        logger.error("Error parsing search query: %s", str(exc))
        return _empty


async def chat_with_assistant(
    messages: list[dict],
    listing_context: dict
) -> str:
    """
    Interact with RoomSathi Assistant using the NVIDIA NIM API.
    Provides context-aware help on listing, safety, legal, and amenities.
    """
    if not settings.NVIDIA_API_KEY:
        logger.error("NVIDIA_API_KEY is not configured.")
        raise HTTPException(status_code=502, detail="Assistant unavailable")

    headers = {
        "Authorization": f"Bearer {settings.NVIDIA_API_KEY}",
        "Content-Type": "application/json",
    }

    SYSTEM_PROMPT = f"""You are RoomSathi Assistant — a helpful, friendly, and
    honest AI for an Indian room rental platform. You are helping a room seeker
    who is viewing a specific listing. Answer their questions concisely (2-4
    sentences max). Be practical and India-specific.

    === Current Listing ===
    Title: {listing_context.get('title', 'N/A')}
    Property type: {listing_context.get('property_type', 'N/A')}
    Area: {listing_context.get('area', 'N/A')}
    City: {listing_context.get('city', 'N/A')}
    Rent: ₹{listing_context.get('rent', 'N/A')}/month
    Deposit: ₹{listing_context.get('deposit', 'N/A')}
    Furnishing: {listing_context.get('furnishing', 'N/A')}
    Gender preference: {listing_context.get('gender_preference', 'N/A')}
    Parking: {listing_context.get('parking', 'N/A')}
    Floor: {listing_context.get('floor', 'N/A')}
    Available from: {listing_context.get('available_from', 'N/A')}
    Description: {listing_context.get('description', 'N/A')}

    === Your expertise ===
    - Area safety, vibe, and locality knowledge for Indian cities
    - Commute times to major IT hubs (Hinjewadi, Magarpatta, Viman Nagar, etc.)
    - Rent negotiation tactics for Indian rental market
    - Typical deposit norms (2-3 months is standard in Pune/Mumbai)
    - Nearby amenities: grocery, metro, hospitals, colleges
    - Tenant rights in Maharashtra (11-month lease, police verification, etc.)
    - Red flags in rental listings and what to check during site visit
    - Questions to ask the owner before signing

    === Rules ===
    - Never make up specific addresses or phone numbers
    - If asked something outside rental context, redirect politely
    - Keep answers short and actionable
    - Use ₹ for currency, not $ or Rs.
    - Always be on the seeker's side"""

    payload = {
        "model": NVIDIA_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            *messages
        ],
        "max_tokens": 350,
        "temperature": 0.65,
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
            raise HTTPException(status_code=502, detail="Assistant unavailable")

        data = response.json()
        reply = data["choices"][0]["message"]["content"].strip()
        return reply

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error in chat_with_assistant: %s", str(exc))
        raise HTTPException(status_code=502, detail="Assistant unavailable")


