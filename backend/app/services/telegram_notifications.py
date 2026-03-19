import asyncio
import logging
from typing import Optional

from telegram import Bot
from telegram.error import TelegramError

from app.core.config import get_settings
from app.models.order import Order, DeliveryType
from app.models.user import User

logger = logging.getLogger(__name__)


async def send_new_order_notification(order: Order, user: User):
    """
    Send notification about new order to Telegram chat.
    """
    try:
        settings = get_settings()

        if not settings.telegram_bot_token or not settings.telegram_chat_id:
            logger.warning("Telegram bot token or chat_id not configured")
            return

        bot = Bot(token=settings.telegram_bot_token)

        # Форматируем информацию о заказе
        items_text = format_order_items(order)

        # Определяем тип доставки
        delivery_text = "🚚 Доставка" if order.delivery_type == DeliveryType.DELIVERY else "🏪 Самовывоз"
        address_text = order.delivery_address or "Самовывоз"

        # Собираем сообщение
        message = f"""
🆕 <b>Новый заказ №{order.id}</b>

👤 <b>Клиент:</b> {user.name or 'Не указано'}
📞 <b>Телефон:</b> {user.phone}

📦 <b>Состав заказа:</b>
{items_text}

💰 <b>Сумма:</b> {int(order.total)} ₽
{delivery_text}: {int(order.delivery_fee)} ₽
Скидка: {int(order.discount) if order.discount else 0} ₽
<b>Итого:</b> {int(order.total)} ₽

📍 <b>Адрес:</b> {address_text}
📅 <b>Желаемое время:</b> {order.desired_delivery_time or 'Не указано'}

💬 <b>Комментарий:</b> {order.comment or 'Нет'}
"""

        # Отправляем сообщение
        await bot.send_message(
            chat_id=settings.telegram_chat_id,
            text=message,
            parse_mode="HTML"
        )

        logger.info(f"Telegram notification sent for order {order.id}")

    except TelegramError as e:
        logger.error(f"Telegram error while sending notification for order {order.id}: {e}")
    except Exception as e:
        logger.error(f"Unexpected error while sending Telegram notification for order {order.id}: {e}")


def format_order_items(order: Order) -> str:
    """Format order items as text list."""
    if not order.items:
        return "• Нет товаров"

    lines = []
    for item in order.items:
        product_name = item.product_name or f"Товар #{item.product_id}"
        lines.append(f"• {product_name} x{item.quantity} — {int(item.total_price)} ₽")

    return "\n".join(lines)


def send_new_order_notification_sync(order: Order, user: User):
    """
    Synchronous wrapper for send_new_order_notification.
    Can be called from sync code.
    """
    try:
        # Создаём новый event loop если его нет
        try:
            loop = asyncio.get_running_loop()
            # Если event loop уже запущен, создаём task
            loop.create_task(send_new_order_notification(order, user))
        except RuntimeError:
            # Если event loop не запущен, запускаем напрямую
            asyncio.run(send_new_order_notification(order, user))
    except Exception as e:
        logger.error(f"Error in sync wrapper for Telegram notification: {e}")
