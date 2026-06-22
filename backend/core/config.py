from pydantic_settings import BaseSettings
from typing import Optional
from pydantic import model_validator


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    ALLOWED_ORIGINS: str = "http://localhost:3000"

    DATABASE_URL: str = "postgresql+asyncpg://postgres:root123@localhost:5432/roomsathi_db"
    SECRET_KEY: Optional[str] = None
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""

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

    APP_URL: str = "http://localhost:8501"
    FASTAPI_URL: str = "http://localhost:8000"

    UPLOAD_DIR: str = "./uploads"

    @model_validator(mode="after")
    def validate_secret_key(self) -> 'Settings':
        if self.ENVIRONMENT != "development" and not self.SECRET_KEY:
            raise ValueError("SECRET_KEY must be set in production environment")
        if not self.SECRET_KEY:
            self.SECRET_KEY = "roomsathi_super_secret_jwt_key_change_in_production_2024"
        return self

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
