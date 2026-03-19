"""
Bageatteria Auth Bot - Simple bot for customer phone authentication.
"""

import os
import logging
import httpx

from telegram import Update, ReplyKeyboardMarkup, KeyboardButton, WebAppInfo
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes

# Configure logging
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Bot token
BOT_TOKEN = os.getenv("TELEGRAM_AUTH_BOT_TOKEN")
if not BOT_TOKEN:
    raise ValueError("TELEGRAM_AUTH_BOT_TOKEN environment variable is required")

BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:8000")


def normalize_phone(phone: str) -> str:
    """Normalize phone number to +7XXXXXXXXXX format."""
    digits = "".join(c for c in phone if c.isdigit())
    if digits.startswith("8") and len(digits) == 11:
        digits = "7" + digits[1:]
    elif digits.startswith("7") and len(digits) == 11:
        pass
    elif len(digits) == 10:
        digits = "7" + digits
    return f"+{digits}"


def get_phone_keyboard() -> ReplyKeyboardMarkup:
    """Big phone share button."""
    return ReplyKeyboardMarkup(
        [[KeyboardButton(
            "📱 ПОДЕЛИТЬСЯ НОМЕРОМ ТЕЛЕФОНА",
            request_contact=True
        )]],
        resize_keyboard=False,  # Full size keyboard
        one_time_keyboard=True
    )


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /start command - show big phone button."""
    await update.message.reply_text(
        "🥯 Добро пожаловать в Bageatteria!\n\n"
        "Для входа в приложение нажмите большую кнопку ниже 👇",
        reply_markup=get_phone_keyboard()
    )


async def handle_contact(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle shared contact - authenticate user."""
    contact = update.message.contact

    if not contact:
        await update.message.reply_text(
            "Не удалось получить номер. Попробуйте ещё раз.",
            reply_markup=get_phone_keyboard()
        )
        return

    # Verify it's user's own phone
    if contact.user_id != update.effective_user.id:
        await update.message.reply_text(
            "Пожалуйста, поделитесь своим номером телефона.",
            reply_markup=get_phone_keyboard()
        )
        return

    phone = normalize_phone(contact.phone_number)
    telegram_id = update.effective_user.id
    first_name = update.effective_user.first_name or ""
    last_name = update.effective_user.last_name or ""

    logger.info(f"Auth request: {phone} from Telegram user {telegram_id}")

    # Notify backend
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{BACKEND_URL}/auth/telegram-bot/confirm",
                json={
                    "phone": phone,
                    "telegram_id": telegram_id,
                    "first_name": first_name,
                    "last_name": last_name,
                },
                timeout=10.0
            )
            if response.status_code == 200:
                logger.info(f"Auth confirmed for {phone}")
                await update.message.reply_text(
                    "✅ Отлично! Авторизация успешна.\n\n"
                    "Вернитесь в приложение — вход выполнится автоматически.",
                    reply_markup=ReplyKeyboardMarkup(
                        [[KeyboardButton("🔄 Авторизоваться снова", request_contact=True)]],
                        resize_keyboard=True
                    )
                )
            else:
                logger.error(f"Backend error: {response.status_code}")
                await update.message.reply_text(
                    "❌ Ошибка авторизации. Попробуйте позже.",
                    reply_markup=get_phone_keyboard()
                )
    except Exception as e:
        logger.error(f"Error: {e}")
        await update.message.reply_text(
            "❌ Ошибка соединения. Попробуйте позже.",
            reply_markup=get_phone_keyboard()
        )


async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle any text - remind to share phone."""
    await update.message.reply_text(
        "Для авторизации нажмите кнопку ниже 👇",
        reply_markup=get_phone_keyboard()
    )


def main():
    """Start the auth bot."""
    logger.info("Starting Bageatteria Auth Bot...")

    application = Application.builder().token(BOT_TOKEN).build()

    application.add_handler(CommandHandler("start", start))
    application.add_handler(MessageHandler(filters.CONTACT, handle_contact))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))

    logger.info("Auth Bot is running...")
    application.run_polling(allowed_updates=Update.ALL_TYPES, drop_pending_updates=True)


if __name__ == "__main__":
    main()
