from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from backend.models.otp import OTPCode
from backend.models.user import User
from backend.core.config import settings
import logging
import httpx
import asyncio
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger(__name__)


async def save_otp(db: AsyncSession, phone: str, otp: str):
    """Save OTP code to database with 10-minute expiry."""
    otp_record = OTPCode(
        phone=phone,
        code=otp,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
    )
    db.add(otp_record)
    await db.flush()
    return otp_record


async def verify_otp_code(db: AsyncSession, phone: str, otp: str) -> bool:
    """Verify OTP code is valid and not expired.

    Tracks failed attempts per OTP record. After 5 wrong guesses the OTP is
    invalidated (marked used) so it cannot be brute-forced within its window.
    """
    import hmac

    result = await db.execute(
        select(OTPCode).where(
            and_(
                OTPCode.phone == phone,
                OTPCode.used == False,
                OTPCode.expires_at > datetime.now(timezone.utc),
            )
        ).order_by(OTPCode.created_at.desc()).limit(1)
    )
    otp_record = result.scalar_one_or_none()
    if not otp_record:
        return False

    if (otp_record.attempts or 0) >= 5:
        return False

    if hmac.compare_digest(str(otp_record.code), str(otp)):
        otp_record.used = True
        await db.flush()
        return True

    otp_record.attempts = (otp_record.attempts or 0) + 1
    if otp_record.attempts >= 5:
        otp_record.used = True  # invalidate after too many guesses
    await db.flush()
    return False


async def get_or_create_user(db: AsyncSession, phone: str, full_name: str = None) -> User:
    """Get existing user by phone or email, or create a new one."""
    is_email = "@" in phone
    if is_email:
        result = await db.execute(select(User).where(User.email == phone))
    else:
        result = await db.execute(select(User).where(User.phone == phone))
        
    user = result.scalar_one_or_none()
    if user:
        return user

    if is_email:
        new_user = User(
            email=phone,
            full_name=full_name or f"User {phone.split('@')[0]}",
            role="seeker",
        )
    else:
        new_user = User(
            phone=phone,
            full_name=full_name or f"User {phone[-4:]}",
            role="seeker",
        )
    db.add(new_user)
    await db.flush()
    await db.refresh(new_user)
    return new_user


async def send_otp_sms(phone: str, otp: str):
    """Send OTP via SMS gateway. Supports dev, fast2sms, twilio, msg91."""
    provider = settings.SMS_PROVIDER.lower()
    
    # Ensure phone number formatting (remove any non-digits)
    clean_phone = "".join(filter(str.isdigit, phone))
    
    if provider == "dev":
        logger.info(f"[DEV MODE] OTP for {clean_phone}: {otp}")
        print(f"\n{'='*40}")
        print(f"  [DEV MODE] OTP for {clean_phone}: {otp}")
        print(f"{'='*40}\n")
        return
        
    elif provider == "fast2sms":
        if not settings.SMS_API_KEY or "your_sms_gateway_key" in settings.SMS_API_KEY:
            logger.error("Fast2SMS API Key is not configured.")
            return
            
        url = "https://www.fast2sms.com/dev/bulkV2"
        # Fast2SMS expects a 10-digit number for Indian numbers or local routing
        target_number = clean_phone[-10:] if len(clean_phone) >= 10 else clean_phone
        
        params = {
            "authorization": settings.SMS_API_KEY,
            "variables_values": otp,
            "route": "otp",
            "numbers": target_number
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params, timeout=10.0)
                res_data = response.json()
                if response.status_code == 200 and res_data.get("return"):
                    logger.info(f"Fast2SMS OTP sent successfully to {target_number}")
                else:
                    logger.error(f"Fast2SMS failed to send OTP: {response.text}")
        except Exception as e:
            logger.error(f"Error sending SMS via Fast2SMS: {str(e)}")
            
    elif provider == "twilio":
        if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN or not settings.TWILIO_PHONE_NUMBER:
            logger.error("Twilio credentials are not fully configured.")
            return
            
        # Twilio expects E.164 format (with + prefix)
        formatted_phone = phone if phone.startswith("+") else f"+{phone}"
        url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json"
        
        data = {
            "To": formatted_phone,
            "From": settings.TWILIO_PHONE_NUMBER,
            "Body": f"Your RoomSathi verification code is: {otp}"
        }
        
        auth = (settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, data=data, auth=auth, timeout=10.0)
                if response.status_code in [200, 201]:
                    logger.info(f"Twilio OTP sent successfully to {formatted_phone}")
                else:
                    logger.error(f"Twilio failed to send OTP: {response.text}")
        except Exception as e:
            logger.error(f"Error sending SMS via Twilio: {str(e)}")
            
    elif provider == "msg91":
        if not settings.SMS_API_KEY or not settings.MSG91_TEMPLATE_ID:
            logger.error("MSG91 credentials/template ID not configured.")
            return
            
        url = "https://control.msg91.com/api/v5/flow/"
        # MSG91 expects country code, without '+' prefix
        target_number = clean_phone if len(clean_phone) > 10 else f"91{clean_phone}"
        
        headers = {
            "authkey": settings.SMS_API_KEY,
            "accept": "application/json",
            "content-type": "application/json"
        }
        
        payload = {
            "template_id": settings.MSG91_TEMPLATE_ID,
            "sender": settings.SMS_SENDER_ID,
            "short_url": "0",
            "mobiles": target_number,
            "otp": otp
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload, headers=headers, timeout=10.0)
                if response.status_code == 200:
                    logger.info(f"MSG91 OTP sent successfully to {target_number}")
                else:
                    logger.error(f"MSG91 failed to send OTP: {response.text}")
        except Exception as e:
            logger.error(f"Error sending SMS via MSG91: {str(e)}")
    else:
        logger.warning(f"Unknown SMS provider: {provider}. Falling back to dev mode.")
        logger.info(f"[DEV MODE] OTP for {clean_phone}: {otp}")


def _smtp_credentials_look_placeholder() -> bool:
    user = (settings.SMTP_USERNAME or "").strip().lower()
    password = (settings.SMTP_PASSWORD or "").strip().lower()
    placeholders = ("your_email", "example.com", "your_smtp", "changeme", "password")
    if not user or not password:
        return True
    return any(p in user or p in password for p in placeholders)


async def send_otp_email(email: str, otp: str):
    """Send OTP via email. Supports dev and smtp modes."""
    provider = settings.EMAIL_PROVIDER.lower()

    if provider == "dev":
        logger.info(f"[DEV MODE] Email OTP for {email}: {otp}")
        print(f"\n{'='*40}")
        print(f"  [DEV MODE] Email OTP for {email}: {otp}")
        print(f"{'='*40}\n")
        return

    if provider != "smtp":
        raise RuntimeError(
            f"Unknown EMAIL_PROVIDER '{settings.EMAIL_PROVIDER}'. Use 'smtp' or 'dev'."
        )

    if _smtp_credentials_look_placeholder():
        raise RuntimeError(
            "Email OTP is not configured. Set real SMTP_USERNAME and SMTP_PASSWORD "
            "in .env (for Gmail: use an App Password from "
            "https://myaccount.google.com/apppasswords) and EMAIL_PROVIDER=smtp."
        )

    def send_sync():
        msg = MIMEMultipart()
        msg["From"] = settings.EMAIL_FROM or settings.SMTP_USERNAME
        msg["To"] = email
        msg["Subject"] = f"RoomSathi Verification Code: {otp}"

        body = f"""
            <html>
                <body style="font-family: Arial, sans-serif; background-color: #F8FAFC; padding: 20px;">
                    <div style="max-width: 480px; margin: 0 auto; background: #FFFFFF; border-radius: 8px; padding: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                        <h2 style="color: #1D9E75; margin-top: 0; text-align: center;">RoomSathi</h2>
                        <p style="color: #475569; font-size: 16px; line-height: 1.5;">Hello,</p>
                        <p style="color: #475569; font-size: 16px; line-height: 1.5;">Use the verification code below to log into your RoomSathi account:</p>
                        <div style="background-color: #F1F5F9; border-radius: 6px; padding: 15px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #0F172A; margin: 25px 0;">
                            {otp}
                        </div>
                        <p style="color: #94A3B8; font-size: 13px; line-height: 1.5; text-align: center; margin-bottom: 0;">
                            This code will expire in 10 minutes. If you did not request this code, you can ignore this email.
                        </p>
                    </div>
                </body>
            </html>
            """
        msg.attach(MIMEText(body, "html"))

        if settings.SMTP_PORT == 465:
            server = smtplib.SMTP_SSL(settings.SMTP_SERVER, settings.SMTP_PORT, timeout=20)
        else:
            server = smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT, timeout=20)
            server.starttls()

        # Gmail app passwords are often copied with spaces — strip them
        password = (settings.SMTP_PASSWORD or "").replace(" ", "")
        server.login(settings.SMTP_USERNAME, password)
        server.sendmail(msg["From"], email, msg.as_string())
        server.quit()
        logger.info(f"Email OTP sent successfully to {email}")

    try:
        await asyncio.to_thread(send_sync)
    except Exception as e:
        logger.error(f"Failed to send email OTP to {email}: {e}", exc_info=True)
        raise RuntimeError(
            "Could not send OTP email. Check SMTP credentials / App Password and try again."
        ) from e
