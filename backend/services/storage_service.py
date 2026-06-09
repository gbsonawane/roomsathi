import os
import uuid
import aiofiles
from pathlib import Path
from backend.core.config import settings
import logging

logger = logging.getLogger(__name__)

UPLOAD_DIR = Path(settings.UPLOAD_DIR)


async def save_photo(file_bytes: bytes, filename: str, listing_id: str = "") -> str:
    """Save a photo to local storage or S3. Returns the URL/path."""
    if settings.STORAGE_BACKEND == "s3":
        return await _upload_to_s3(file_bytes, filename, listing_id)
    else:
        return await _save_local(file_bytes, filename, listing_id)


async def _save_local(file_bytes: bytes, filename: str, listing_id: str) -> str:
    """Save file to local filesystem."""
    upload_path = UPLOAD_DIR / listing_id
    upload_path.mkdir(parents=True, exist_ok=True)

    ext = Path(filename).suffix or ".jpg"
    safe_name = f"{uuid.uuid4().hex}{ext}"
    file_path = upload_path / safe_name

    async with aiofiles.open(file_path, "wb") as f:
        await f.write(file_bytes)

    # Return URL path for serving
    return f"/uploads/{listing_id}/{safe_name}"


async def _upload_to_s3(file_bytes: bytes, filename: str, listing_id: str) -> str:
    """Upload file to AWS S3."""
    try:
        import boto3
        s3 = boto3.client(
            "s3",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )
        ext = Path(filename).suffix or ".jpg"
        key = f"listings/{listing_id}/{uuid.uuid4().hex}{ext}"
        s3.put_object(
            Bucket=settings.AWS_S3_BUCKET,
            Key=key,
            Body=file_bytes,
            ContentType=f"image/{ext.lstrip('.')}",
        )
        return f"https://{settings.AWS_S3_BUCKET}.s3.amazonaws.com/{key}"
    except Exception as e:
        logger.error(f"S3 upload failed: {e}")
        # Fallback to local
        return await _save_local(file_bytes, filename, listing_id)
