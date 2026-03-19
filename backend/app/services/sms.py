import httpx
import logging
import random
import string

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def generate_code(length: int = 4) -> str:
    """Generate a random numeric code."""
    return ''.join(random.choices(string.digits, k=length))


async def send_sms(phone: str, message: str) -> bool:
    """
    Send SMS via MTS Exolve API.

    Args:
        phone: Phone number in format +7XXXXXXXXXX
        message: Message text

    Returns:
        bool: True if sent successfully, False otherwise
    """
    settings = get_settings()

    if not settings.sms_exolve_api_key:
        logger.warning("SMS_EXOLVE_API_KEY not configured")
        return False

    # Remove + from phone number for API
    clean_phone = phone.lstrip('+')

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.exolve.ru/messaging/v1/SendSMS",
                headers={
                    "Authorization": f"Bearer {settings.sms_exolve_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "number": settings.sms_exolve_sender,
                    "destination": clean_phone,
                    "text": message
                },
                timeout=30.0
            )

            if response.status_code == 200:
                logger.info(f"SMS sent successfully to {phone}")
                return True
            else:
                logger.error(f"SMS send failed: {response.status_code} - {response.text}")
                return False

    except Exception as e:
        logger.error(f"SMS send error: {e}")
        return False


async def send_auth_code(phone: str, code: str) -> bool:
    """Send authentication code via SMS."""
    message = f"Bageatteria: Ваш код входа: {code}"
    return await send_sms(phone, message)
