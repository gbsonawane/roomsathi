from pydantic_settings import BaseSettings
from typing import Optional, Any
from pydantic import field_validator, model_validator


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    SENTRY_DSN: str = ""
    # Any avoids pydantic-settings JSON-decoding comma-separated env values
    ALLOWED_ORIGINS: Any = []

    DATABASE_URL: str = "postgresql+asyncpg://postgres:root123@localhost:5432/roomsathi_db"
    SECRET_KEY: Optional[str] = None
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    ADMIN_SECRET_PASSWORD: str = ""  # bcrypt hash — generate: python -c "from backend.core.security import hash_password; print(hash_password('your-password'))"

    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_WEBHOOK_SECRET: str = ""

    GOOGLE_MAPS_API_KEY: str = ""

    SMS_PROVIDER: str = "dev"  # dev | fast2sms | twilio | msg91
    SMS_API_KEY: str = ""
    SMS_SENDER_ID: str = "RMSATH"

    # Twilio specific settings
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_PHONE_NUMBER: str = ""

    # MSG91 specific settings
    MSG91_TEMPLATE_ID: str = ""

    STORAGE_BACKEND: str = "local"  # local | s3
    AWS_S3_BUCKET: str = ""
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""

    # Email Settings
    EMAIL_PROVIDER: str = "dev"  # dev | smtp
    SMTP_SERVER: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = ""

    # Google OAuth
    GOOGLE_CLIENT_ID: str = ""

    # NVIDIA NIM / AI Settings
    NVIDIA_API_KEY: str = ""

    APP_URL: str = "http://localhost:8501"
    FASTAPI_URL: str = "http://localhost:8000"

    UPLOAD_DIR: str = "./uploads"

    CRON_SECRET: str = ""

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v or []

    @field_validator("SECRET_KEY", mode="before")
    @classmethod
    def validate_secret_key(cls, v):
        if not v or len(v) < 32:
            raise ValueError(
                "SECRET_KEY must be set and at least 32 characters long. "
                "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
            )
        return v

    @model_validator(mode="after")
    def validate_allowed_origins_in_production(self):
        if self.ENVIRONMENT == "production" and not self.ALLOWED_ORIGINS:
            raise ValueError(
                "ALLOWED_ORIGINS must be set in production "
                "(comma-separated list of frontend origins)."
            )
        return self

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
