"""
Bageatteria Telegram Bot for staff operations.

This bot handles:
1. Phone number authentication for customers (iOS app)
2. Stock management for baristas:
   - Receiving deliveries (Приёмка)
   - Inventory counting (Инвентаризация)
   - Viewing current stock
"""

import os
import sys
import logging
import httpx
from datetime import datetime
from typing import Optional, Dict, Any

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from telegram import (
    Update,
    ReplyKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardRemove,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
)
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    ConversationHandler,
    filters,
    ContextTypes,
)

# Configure logging
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Bot token from environment (REQUIRED - no default for security)
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
if not BOT_TOKEN:
    raise ValueError("TELEGRAM_BOT_TOKEN environment variable is required")

BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:8000")

# Staff password for access control (REQUIRED - no default for security)
STAFF_PASSWORD = os.getenv("STAFF_BOT_PASSWORD")
if not STAFF_PASSWORD:
    raise ValueError("STAFF_BOT_PASSWORD environment variable is required")

# API key for backend communication (REQUIRED in production)
BOT_API_KEY = os.getenv("TELEGRAM_BOT_API_KEY", "")

# Conversation states
(
    MAIN_MENU,
    AUTH_PHONE,
    STAFF_LOGIN,  # New state for password entry
    SELECT_LOCATION,
    # Delivery states
    DELIVERY_LIST,
    DELIVERY_RECEIVE,
    DELIVERY_ITEM,
    DELIVERY_PHOTO,
    DELIVERY_CONFIRM,
    # Inventory states
    INVENTORY_START,
    INVENTORY_CATEGORY,
    INVENTORY_ITEM,
    INVENTORY_CONFIRM,
) = range(13)

# Authenticated staff telegram IDs (session-based, not persistent)
authenticated_staff: set = set()

# Rate limiting for staff login attempts: {telegram_id: {"attempts": int, "blocked_until": float}}
login_attempts: dict = {}
MAX_LOGIN_ATTEMPTS = 5  # Max failed attempts before blocking
LOGIN_BLOCK_DURATION = 300  # Block for 5 minutes after max attempts


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


def get_main_menu_keyboard(is_staff: bool = False) -> ReplyKeyboardMarkup:
    """Get main menu keyboard based on user role."""
    buttons = [[KeyboardButton("Поделиться номером телефона", request_contact=True)]]

    if is_staff:
        buttons = [
            [KeyboardButton("📦 Приёмка"), KeyboardButton("📋 Инвентаризация")],
            [KeyboardButton("📊 Остатки"), KeyboardButton("🔍 Найти поставку")],
            [KeyboardButton("👤 Авторизация клиента")],
            [KeyboardButton("🚪 Выйти из режима сотрудника")],
        ]

    return ReplyKeyboardMarkup(buttons, resize_keyboard=True)


def get_customer_menu_keyboard() -> ReplyKeyboardMarkup:
    """Get customer menu keyboard with staff login option."""
    return ReplyKeyboardMarkup(
        [[KeyboardButton("Поделиться номером телефона", request_contact=True)],
         [KeyboardButton("🔐 Вход для сотрудников")]],
        resize_keyboard=True
    )


def is_authenticated_staff(telegram_id: int) -> bool:
    """Check if user is authenticated as staff."""
    return telegram_id in authenticated_staff


def authenticate_staff(telegram_id: int) -> None:
    """Add user to authenticated staff."""
    authenticated_staff.add(telegram_id)
    logger.info(f"Staff authenticated: {telegram_id}")


def logout_staff(telegram_id: int) -> None:
    """Remove user from authenticated staff."""
    authenticated_staff.discard(telegram_id)
    logger.info(f"Staff logged out: {telegram_id}")


async def api_request(method: str, endpoint: str, **kwargs) -> Optional[Dict[str, Any]]:
    """Make API request to backend with authentication."""
    try:
        # Add API key header for authenticated endpoints
        headers = kwargs.pop("headers", {})
        if BOT_API_KEY:
            headers["X-Bot-API-Key"] = BOT_API_KEY

        async with httpx.AsyncClient() as client:
            if method == "GET":
                response = await client.get(f"{BACKEND_URL}{endpoint}", timeout=10.0, headers=headers, **kwargs)
            elif method == "POST":
                response = await client.post(f"{BACKEND_URL}{endpoint}", timeout=10.0, headers=headers, **kwargs)
            else:
                return None

            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"API error: {response.status_code} {response.text}")
                return None
    except Exception as e:
        logger.error(f"API request error: {e}")
        return None


# ============ Start & Main Menu ============

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle /start command."""
    user_id = update.effective_user.id

    # Check if already authenticated as staff
    if is_authenticated_staff(user_id):
        await update.message.reply_text(
            "Добро пожаловать в Bageatteria! ☕\n\n"
            "Вы авторизованы как сотрудник.\n"
            "Выберите действие:",
            reply_markup=get_main_menu_keyboard(is_staff=True)
        )
        return MAIN_MENU
    else:
        await update.message.reply_text(
            "Добро пожаловать в Bageatteria! ☕\n\n"
            "Для входа в приложение нажмите кнопку ниже и поделитесь номером телефона.\n\n"
            "Для сотрудников — нажмите 'Вход для сотрудников'.",
            reply_markup=get_customer_menu_keyboard()
        )
        return AUTH_PHONE


async def main_menu_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle main menu selections."""
    text = update.message.text
    user_id = update.effective_user.id

    # Check staff authentication for protected actions
    if text in ["📦 Приёмка", "📋 Инвентаризация", "📊 Остатки", "🔍 Найти поставку"]:
        if not is_authenticated_staff(user_id):
            await update.message.reply_text(
                "Доступ запрещён. Пожалуйста, авторизуйтесь как сотрудник.",
                reply_markup=get_customer_menu_keyboard()
            )
            return AUTH_PHONE

    if text == "📦 Приёмка":
        return await show_location_selection(update, context, "delivery")
    elif text == "📋 Инвентаризация":
        return await show_location_selection(update, context, "inventory")
    elif text == "📊 Остатки":
        return await show_location_selection(update, context, "stock")
    elif text == "🔍 Найти поставку":
        await update.message.reply_text("Введите номер накладной:")
        return DELIVERY_LIST
    elif text == "👤 Авторизация клиента":
        await update.message.reply_text(
            "Попросите клиента нажать кнопку для авторизации:",
            reply_markup=ReplyKeyboardMarkup(
                [[KeyboardButton("Поделиться номером телефона", request_contact=True)],
                 [KeyboardButton("⬅️ Назад")]],
                resize_keyboard=True
            )
        )
        return AUTH_PHONE
    elif text == "🚪 Выйти из режима сотрудника":
        logout_staff(user_id)
        await update.message.reply_text(
            "Вы вышли из режима сотрудника.",
            reply_markup=get_customer_menu_keyboard()
        )
        return AUTH_PHONE
    elif text == "🔐 Вход для сотрудников":
        await update.message.reply_text(
            "🔐 Введите пароль для сотрудников:",
            reply_markup=ReplyKeyboardMarkup(
                [[KeyboardButton("⬅️ Отмена")]],
                resize_keyboard=True
            )
        )
        return STAFF_LOGIN
    else:
        is_staff = is_authenticated_staff(user_id)
        if is_staff:
            await update.message.reply_text("Выберите действие из меню:", reply_markup=get_main_menu_keyboard(is_staff=True))
            return MAIN_MENU
        else:
            await update.message.reply_text("Выберите действие:", reply_markup=get_customer_menu_keyboard())
            return AUTH_PHONE


async def handle_staff_login(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle staff password entry with rate limiting."""
    import time

    text = update.message.text
    user_id = update.effective_user.id

    if text == "⬅️ Отмена":
        await update.message.reply_text(
            "Вход отменён.",
            reply_markup=get_customer_menu_keyboard()
        )
        return AUTH_PHONE

    # Check if user is blocked due to too many failed attempts
    if user_id in login_attempts:
        attempt_data = login_attempts[user_id]
        if attempt_data.get("blocked_until", 0) > time.time():
            remaining = int(attempt_data["blocked_until"] - time.time())
            await update.message.reply_text(
                f"⏳ Слишком много неудачных попыток.\n"
                f"Повторите через {remaining // 60} мин. {remaining % 60} сек.",
                reply_markup=get_customer_menu_keyboard()
            )
            return AUTH_PHONE

    # Check password
    if text == STAFF_PASSWORD:
        # Clear failed attempts on success
        login_attempts.pop(user_id, None)
        authenticate_staff(user_id)
        await update.message.reply_text(
            "✅ Вход выполнен!\n\n"
            "Теперь вам доступны функции для сотрудников.",
            reply_markup=get_main_menu_keyboard(is_staff=True)
        )
        return MAIN_MENU
    else:
        # Track failed attempt
        if user_id not in login_attempts:
            login_attempts[user_id] = {"attempts": 0, "blocked_until": 0}

        login_attempts[user_id]["attempts"] += 1
        attempts = login_attempts[user_id]["attempts"]

        if attempts >= MAX_LOGIN_ATTEMPTS:
            # Block user
            login_attempts[user_id]["blocked_until"] = time.time() + LOGIN_BLOCK_DURATION
            login_attempts[user_id]["attempts"] = 0
            logger.warning(f"User {user_id} blocked for {LOGIN_BLOCK_DURATION}s due to failed login attempts")
            await update.message.reply_text(
                f"🚫 Превышено количество попыток ({MAX_LOGIN_ATTEMPTS}).\n"
                f"Повторите через {LOGIN_BLOCK_DURATION // 60} минут.",
                reply_markup=get_customer_menu_keyboard()
            )
            return AUTH_PHONE
        else:
            remaining_attempts = MAX_LOGIN_ATTEMPTS - attempts
            await update.message.reply_text(
                f"❌ Неверный пароль. Осталось попыток: {remaining_attempts}",
                reply_markup=ReplyKeyboardMarkup(
                    [[KeyboardButton("⬅️ Отмена")]],
                    resize_keyboard=True
                )
            )
            return STAFF_LOGIN


# ============ Location Selection ============

async def show_location_selection(update: Update, context: ContextTypes.DEFAULT_TYPE, action: str) -> int:
    """Show location selection for staff actions."""
    context.user_data["action"] = action

    # Get locations from API
    locations = await api_request("GET", "/admin/store-locations")

    if not locations:
        await update.message.reply_text(
            "Не удалось загрузить список точек. Попробуйте позже.",
            reply_markup=get_main_menu_keyboard(is_staff=True)
        )
        return MAIN_MENU

    buttons = [[KeyboardButton(loc["name"])] for loc in locations if loc.get("is_active")]
    buttons.append([KeyboardButton("⬅️ Назад")])

    context.user_data["locations"] = {loc["name"]: loc["id"] for loc in locations}

    action_text = {
        "delivery": "приёмки",
        "inventory": "инвентаризации",
        "stock": "просмотра остатков",
    }.get(action, action)

    await update.message.reply_text(
        f"Выберите точку для {action_text}:",
        reply_markup=ReplyKeyboardMarkup(buttons, resize_keyboard=True)
    )
    return SELECT_LOCATION


async def handle_location_selection(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle location selection."""
    text = update.message.text

    if text == "⬅️ Назад":
        await update.message.reply_text("Главное меню:", reply_markup=get_main_menu_keyboard(is_staff=True))
        return MAIN_MENU

    locations = context.user_data.get("locations", {})
    if text not in locations:
        await update.message.reply_text("Выберите точку из списка.")
        return SELECT_LOCATION

    location_id = locations[text]
    context.user_data["location_id"] = location_id
    context.user_data["location_name"] = text

    action = context.user_data.get("action")

    if action == "delivery":
        return await show_pending_deliveries(update, context)
    elif action == "inventory":
        return await start_inventory(update, context)
    elif action == "stock":
        return await show_current_stock(update, context)

    return MAIN_MENU


# ============ Deliveries (Приёмка) ============

async def show_pending_deliveries(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Show list of pending deliveries for location."""
    location_id = context.user_data.get("location_id")

    deliveries = await api_request("GET", f"/admin/stock/telegram/pending-deliveries/{location_id}")

    if not deliveries:
        await update.message.reply_text(
            "Нет ожидающих поставок на этой точке.\n\n"
            "Вы можете создать новую приёмку вручную или вернуться в меню.",
            reply_markup=ReplyKeyboardMarkup(
                [[KeyboardButton("➕ Создать приёмку")], [KeyboardButton("⬅️ Назад")]],
                resize_keyboard=True
            )
        )
        return DELIVERY_LIST

    # Store deliveries in context
    context.user_data["deliveries"] = {str(d["id"]): d for d in deliveries}

    buttons = []
    message = "📦 Ожидающие поставки:\n\n"

    for d in deliveries:
        status = "⏳" if d["status"] == "pending" else "🔄"
        supplier = d.get("supplier_name") or "Без поставщика"
        date_str = ""
        if d.get("expected_date"):
            date_str = f" ({d['expected_date'][:10]})"
        message += f"{status} #{d['id']} - {supplier}{date_str}\n"
        buttons.append([KeyboardButton(f"📦 Поставка #{d['id']}")])

    buttons.append([KeyboardButton("⬅️ Назад")])

    await update.message.reply_text(
        message + "\nВыберите поставку для приёмки:",
        reply_markup=ReplyKeyboardMarkup(buttons, resize_keyboard=True)
    )
    return DELIVERY_LIST


async def handle_delivery_selection(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle delivery selection for receiving."""
    text = update.message.text

    if text == "⬅️ Назад":
        return await show_location_selection(update, context, "delivery")

    if text == "➕ Создать приёмку":
        await update.message.reply_text("Функция создания приёмки через бота в разработке.")
        return DELIVERY_LIST

    # Extract delivery ID
    if text.startswith("📦 Поставка #"):
        delivery_id = text.replace("📦 Поставка #", "")
        deliveries = context.user_data.get("deliveries", {})
        delivery = deliveries.get(delivery_id)

        if delivery:
            context.user_data["current_delivery"] = delivery
            context.user_data["delivery_items"] = {}
            return await show_delivery_items(update, context, delivery)

    await update.message.reply_text("Выберите поставку из списка.")
    return DELIVERY_LIST


async def show_delivery_items(update: Update, context: ContextTypes.DEFAULT_TYPE, delivery: dict) -> int:
    """Show items in delivery for receiving."""
    lines = delivery.get("lines", [])

    if not lines:
        await update.message.reply_text(
            "В этой поставке нет позиций.",
            reply_markup=get_main_menu_keyboard(is_staff=True)
        )
        return MAIN_MENU

    context.user_data["delivery_lines"] = {str(l["id"]): l for l in lines}
    context.user_data["current_line_index"] = 0

    message = f"📦 Поставка #{delivery['id']}\n"
    if delivery.get("supplier_name"):
        message += f"Поставщик: {delivery['supplier_name']}\n"
    message += f"\nПозиций: {len(lines)}\n\n"

    for i, line in enumerate(lines, 1):
        item_name = line.get("stock_item", {}).get("name", f"ID: {line['stock_item_id']}")
        expected = line["expected_quantity"]
        message += f"{i}. {item_name} — ожидается {expected}\n"

    message += "\nНачните приёмку. Для каждой позиции введите фактическое количество."

    await update.message.reply_text(
        message,
        reply_markup=ReplyKeyboardMarkup(
            [[KeyboardButton("✅ Начать приёмку")], [KeyboardButton("⬅️ Назад")]],
            resize_keyboard=True
        )
    )
    return DELIVERY_RECEIVE


async def start_delivery_receiving(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Start the delivery receiving process."""
    text = update.message.text

    if text == "⬅️ Назад":
        return await show_pending_deliveries(update, context)

    if text == "✅ Начать приёмку":
        delivery = context.user_data.get("current_delivery")
        lines = delivery.get("lines", [])

        if not lines:
            await update.message.reply_text("Нет позиций для приёмки.")
            return DELIVERY_LIST

        context.user_data["current_line_index"] = 0
        return await ask_for_item_quantity(update, context)

    return DELIVERY_RECEIVE


async def ask_for_item_quantity(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Ask for quantity of current item."""
    delivery = context.user_data.get("current_delivery")
    lines = delivery.get("lines", [])
    index = context.user_data.get("current_line_index", 0)

    if index >= len(lines):
        # All items done, show summary
        return await show_delivery_summary(update, context)

    line = lines[index]
    item_name = line.get("stock_item", {}).get("name", f"ID: {line['stock_item_id']}")
    expected = line["expected_quantity"]

    await update.message.reply_text(
        f"📦 Позиция {index + 1} из {len(lines)}\n\n"
        f"**{item_name}**\n"
        f"Ожидается: {expected}\n\n"
        f"Введите фактическое количество (или 'пропустить'):",
        reply_markup=ReplyKeyboardMarkup(
            [[KeyboardButton(str(int(expected)))], [KeyboardButton("Пропустить")], [KeyboardButton("⬅️ Назад")]],
            resize_keyboard=True
        ),
        parse_mode="Markdown"
    )
    return DELIVERY_ITEM


async def handle_item_quantity(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle quantity input for delivery item."""
    text = update.message.text

    if text == "⬅️ Назад":
        return await show_delivery_items(update, context, context.user_data.get("current_delivery"))

    delivery = context.user_data.get("current_delivery")
    lines = delivery.get("lines", [])
    index = context.user_data.get("current_line_index", 0)
    line = lines[index]

    if text.lower() == "пропустить":
        actual = line["expected_quantity"]
    else:
        try:
            actual = float(text.replace(",", "."))
        except ValueError:
            await update.message.reply_text("Введите число или 'пропустить'.")
            return DELIVERY_ITEM

    # Store the quantity
    delivery_items = context.user_data.get("delivery_items", {})
    delivery_items[str(line["id"])] = {
        "stock_item_id": line["stock_item_id"],
        "actual_quantity": actual,
        "expected_quantity": line["expected_quantity"],
        "item_name": line.get("stock_item", {}).get("name", ""),
    }
    context.user_data["delivery_items"] = delivery_items

    # Move to next item
    context.user_data["current_line_index"] = index + 1
    return await ask_for_item_quantity(update, context)


async def show_delivery_summary(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Show summary of delivery receiving and ask for confirmation."""
    delivery = context.user_data.get("current_delivery")
    items = context.user_data.get("delivery_items", {})

    message = f"📦 Приёмка #{delivery['id']} — Итого:\n\n"
    has_discrepancy = False

    for item_id, item_data in items.items():
        name = item_data["item_name"]
        expected = item_data["expected_quantity"]
        actual = item_data["actual_quantity"]
        diff = actual - expected

        status = "✅" if diff == 0 else ("⬆️" if diff > 0 else "⬇️")
        diff_str = f" ({'+' if diff > 0 else ''}{diff})" if diff != 0 else ""

        if diff != 0:
            has_discrepancy = True

        message += f"{status} {name}: {actual}{diff_str}\n"

    if has_discrepancy:
        message += "\n⚠️ Есть расхождения с накладной."

    message += "\n\nПодтвердить приёмку?"

    await update.message.reply_text(
        message,
        reply_markup=ReplyKeyboardMarkup(
            [[KeyboardButton("📸 Добавить фото")],
             [KeyboardButton("✅ Подтвердить"), KeyboardButton("❌ Отмена")]],
            resize_keyboard=True
        )
    )
    return DELIVERY_CONFIRM


async def handle_delivery_confirmation(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle delivery confirmation."""
    text = update.message.text

    if text == "❌ Отмена":
        await update.message.reply_text("Приёмка отменена.", reply_markup=get_main_menu_keyboard(is_staff=True))
        return MAIN_MENU

    if text == "📸 Добавить фото":
        await update.message.reply_text(
            "Отправьте фото товаров (можно несколько).\n"
            "Когда закончите, нажмите 'Готово'.",
            reply_markup=ReplyKeyboardMarkup(
                [[KeyboardButton("✅ Готово")]],
                resize_keyboard=True
            )
        )
        return DELIVERY_PHOTO

    if text == "✅ Подтвердить" or text == "✅ Готово":
        return await submit_delivery(update, context)

    return DELIVERY_CONFIRM


async def handle_delivery_photo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle photo upload for delivery."""
    if update.message.text == "✅ Готово":
        return await submit_delivery(update, context)

    if update.message.photo:
        photo = update.message.photo[-1]  # Largest size
        file = await photo.get_file()

        # Download and upload to backend
        delivery = context.user_data.get("current_delivery")
        file_bytes = await file.download_as_bytearray()

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{BACKEND_URL}/admin/stock/telegram/upload-photo/{delivery['id']}",
                    files={"file": ("photo.jpg", bytes(file_bytes), "image/jpeg")},
                    timeout=30.0
                )
                if response.status_code == 200:
                    await update.message.reply_text("📸 Фото добавлено!")
                else:
                    await update.message.reply_text("Ошибка загрузки фото.")
        except Exception as e:
            logger.error(f"Photo upload error: {e}")
            await update.message.reply_text("Ошибка загрузки фото.")

    return DELIVERY_PHOTO


async def submit_delivery(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Submit delivery receiving to backend."""
    delivery = context.user_data.get("current_delivery")
    items = context.user_data.get("delivery_items", {})
    user = update.effective_user

    lines_data = [
        {
            "stock_item_id": item["stock_item_id"],
            "actual_quantity": item["actual_quantity"],
        }
        for item in items.values()
    ]

    result = await api_request(
        "POST",
        "/admin/stock/telegram/receive-delivery",
        json={
            "delivery_id": delivery["id"],
            "telegram_id": user.id,
            "telegram_name": user.full_name,
            "lines": lines_data,
        }
    )

    if result and result.get("ok"):
        status = "с расхождениями ⚠️" if result.get("has_discrepancy") else "успешно ✅"
        await update.message.reply_text(
            f"Приёмка #{delivery['id']} завершена {status}!",
            reply_markup=get_main_menu_keyboard(is_staff=True)
        )
    else:
        await update.message.reply_text(
            "Ошибка при сохранении приёмки. Попробуйте позже.",
            reply_markup=get_main_menu_keyboard(is_staff=True)
        )

    return MAIN_MENU


# ============ Inventory (Инвентаризация) ============

async def start_inventory(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Start inventory process."""
    location_id = context.user_data.get("location_id")
    location_name = context.user_data.get("location_name")

    # Get stock items for this location
    items = await api_request("GET", f"/admin/stock/telegram/stock-items/{location_id}")

    if not items:
        await update.message.reply_text(
            "Не удалось загрузить товары для инвентаризации.",
            reply_markup=get_main_menu_keyboard(is_staff=True)
        )
        return MAIN_MENU

    # Group by category
    categories = {}
    for item in items:
        cat_name = item.get("category_name") or "Без категории"
        if cat_name not in categories:
            categories[cat_name] = []
        categories[cat_name].append(item)

    context.user_data["inventory_categories"] = categories
    context.user_data["inventory_items"] = {str(item["id"]): item for item in items}
    context.user_data["inventory_counts"] = {}

    await update.message.reply_text(
        f"📋 Инвентаризация — {location_name}\n\n"
        f"Всего товаров: {len(items)}\n"
        f"Категорий: {len(categories)}\n\n"
        f"Начните вводить фактические остатки.",
        reply_markup=ReplyKeyboardMarkup(
            [[KeyboardButton("▶️ Начать")], [KeyboardButton("⬅️ Назад")]],
            resize_keyboard=True
        )
    )
    return INVENTORY_START


async def handle_inventory_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle inventory start."""
    text = update.message.text

    if text == "⬅️ Назад":
        return await show_location_selection(update, context, "inventory")

    if text == "▶️ Начать":
        categories = context.user_data.get("inventory_categories", {})
        cat_names = list(categories.keys())
        context.user_data["category_index"] = 0
        context.user_data["item_index"] = 0
        return await ask_inventory_item(update, context)

    return INVENTORY_START


async def ask_inventory_item(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Ask for current inventory item count."""
    categories = context.user_data.get("inventory_categories", {})
    cat_names = list(categories.keys())
    cat_index = context.user_data.get("category_index", 0)
    item_index = context.user_data.get("item_index", 0)

    # Check if we've gone through all categories
    if cat_index >= len(cat_names):
        return await show_inventory_summary(update, context)

    cat_name = cat_names[cat_index]
    cat_items = categories[cat_name]

    # Check if we've gone through all items in current category
    if item_index >= len(cat_items):
        context.user_data["category_index"] = cat_index + 1
        context.user_data["item_index"] = 0
        return await ask_inventory_item(update, context)

    item = cat_items[item_index]
    unit = item.get("unit", "шт")
    expected = item.get("expected_quantity", 0)

    # Count progress
    total_items = sum(len(items) for items in categories.values())
    done_items = len(context.user_data.get("inventory_counts", {}))

    await update.message.reply_text(
        f"📋 [{done_items + 1}/{total_items}] {cat_name}\n\n"
        f"**{item['name']}**\n"
        f"Расчётный остаток: {expected} {unit}\n\n"
        f"Введите фактическое количество:",
        reply_markup=ReplyKeyboardMarkup(
            [[KeyboardButton(str(int(expected)))],
             [KeyboardButton("Пропустить")],
             [KeyboardButton("⏭️ Завершить")]],
            resize_keyboard=True
        ),
        parse_mode="Markdown"
    )
    return INVENTORY_ITEM


async def handle_inventory_item(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle inventory item count input."""
    text = update.message.text

    if text == "⏭️ Завершить":
        return await show_inventory_summary(update, context)

    categories = context.user_data.get("inventory_categories", {})
    cat_names = list(categories.keys())
    cat_index = context.user_data.get("category_index", 0)
    item_index = context.user_data.get("item_index", 0)

    cat_name = cat_names[cat_index]
    item = categories[cat_name][item_index]

    if text.lower() == "пропустить":
        actual = item.get("expected_quantity", 0)
    else:
        try:
            actual = float(text.replace(",", "."))
        except ValueError:
            await update.message.reply_text("Введите число, 'пропустить' или '⏭️ Завершить'.")
            return INVENTORY_ITEM

    # Store count
    counts = context.user_data.get("inventory_counts", {})
    counts[str(item["id"])] = {
        "stock_item_id": item["id"],
        "actual_quantity": actual,
        "expected_quantity": item.get("expected_quantity", 0),
        "item_name": item["name"],
        "tolerance": item.get("tolerance", 0),
    }
    context.user_data["inventory_counts"] = counts

    # Move to next item
    context.user_data["item_index"] = item_index + 1
    return await ask_inventory_item(update, context)


async def show_inventory_summary(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Show inventory summary and ask for confirmation."""
    counts = context.user_data.get("inventory_counts", {})
    location_name = context.user_data.get("location_name")

    if not counts:
        await update.message.reply_text(
            "Нет данных для инвентаризации.",
            reply_markup=get_main_menu_keyboard(is_staff=True)
        )
        return MAIN_MENU

    message = f"📋 Инвентаризация — {location_name}\n\n"

    ok_count = 0
    warning_count = 0
    error_count = 0

    for item_id, data in counts.items():
        expected = data["expected_quantity"]
        actual = data["actual_quantity"]
        tolerance = data["tolerance"]
        diff = actual - expected

        if abs(diff) == 0:
            ok_count += 1
        elif abs(diff) <= tolerance:
            warning_count += 1
        else:
            error_count += 1
            name = data["item_name"]
            message += f"⚠️ {name}: {actual} (ожидалось {expected})\n"

    message += f"\n✅ В норме: {ok_count}\n"
    message += f"⚠️ В допуске: {warning_count}\n"
    message += f"❌ За допуском: {error_count}\n"
    message += f"\nВсего позиций: {len(counts)}\n"
    message += "\nОтправить инвентаризацию?"

    await update.message.reply_text(
        message,
        reply_markup=ReplyKeyboardMarkup(
            [[KeyboardButton("✅ Отправить")], [KeyboardButton("❌ Отмена")]],
            resize_keyboard=True
        )
    )
    return INVENTORY_CONFIRM


async def handle_inventory_confirmation(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle inventory confirmation."""
    text = update.message.text

    if text == "❌ Отмена":
        await update.message.reply_text(
            "Инвентаризация отменена.",
            reply_markup=get_main_menu_keyboard(is_staff=True)
        )
        return MAIN_MENU

    if text == "✅ Отправить":
        return await submit_inventory(update, context)

    return INVENTORY_CONFIRM


async def submit_inventory(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Submit inventory to backend."""
    location_id = context.user_data.get("location_id")
    counts = context.user_data.get("inventory_counts", {})
    user = update.effective_user

    lines_data = [
        {
            "stock_item_id": data["stock_item_id"],
            "expected_quantity": data["expected_quantity"],
            "actual_quantity": data["actual_quantity"],
        }
        for data in counts.values()
    ]

    result = await api_request(
        "POST",
        "/admin/stock/telegram/submit-inventory",
        json={
            "store_location_id": location_id,
            "telegram_id": user.id,
            "telegram_name": user.full_name,
            "lines": lines_data,
        }
    )

    if result and result.get("ok"):
        status = result.get("status", "submitted")
        status_text = {
            "ok": "Все в норме ✅",
            "discrepancy": "Требует проверки руководителем ⚠️",
            "submitted": "Отправлена на проверку 📤",
        }.get(status, status)

        await update.message.reply_text(
            f"Инвентаризация #{result.get('inventory_id')} отправлена!\n"
            f"Статус: {status_text}",
            reply_markup=get_main_menu_keyboard(is_staff=True)
        )
    else:
        await update.message.reply_text(
            "Ошибка при сохранении инвентаризации.",
            reply_markup=get_main_menu_keyboard(is_staff=True)
        )

    return MAIN_MENU


# ============ Current Stock ============

async def show_current_stock(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Show current stock for location."""
    location_id = context.user_data.get("location_id")
    location_name = context.user_data.get("location_name")

    stock = await api_request("GET", f"/admin/stock/current/{location_id}")

    if not stock:
        await update.message.reply_text(
            f"Нет данных об остатках на точке {location_name}.",
            reply_markup=get_main_menu_keyboard(is_staff=True)
        )
        return MAIN_MENU

    message = f"📊 Остатки — {location_name}\n\n"

    for item in stock[:20]:  # Limit to 20 items
        item_data = item.get("stock_item", {})
        name = item_data.get("name", f"ID: {item['stock_item_id']}")
        qty = item.get("quantity", 0)
        unit = item_data.get("unit") or item_data.get("stock_category", {}).get("unit", "шт")
        message += f"• {name}: {qty} {unit}\n"

    if len(stock) > 20:
        message += f"\n... и ещё {len(stock) - 20} позиций"

    await update.message.reply_text(
        message,
        reply_markup=get_main_menu_keyboard(is_staff=True)
    )
    return MAIN_MENU


# ============ Authentication ============

async def handle_contact(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle shared contact (phone number)."""
    contact = update.message.contact

    if not contact:
        await update.message.reply_text("Не удалось получить номер телефона.")
        return AUTH_PHONE

    if contact.user_id != update.effective_user.id:
        await update.message.reply_text("Пожалуйста, поделитесь своим номером.")
        return AUTH_PHONE

    phone = normalize_phone(contact.phone_number)
    telegram_id = update.effective_user.id
    first_name = update.effective_user.first_name or ""
    last_name = update.effective_user.last_name or ""

    logger.info(f"Phone verification: {phone} from Telegram user {telegram_id}")

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
                logger.info(f"Auth confirmed for phone: {phone}")
            else:
                logger.error(f"Failed to confirm auth: {response.status_code}")
    except Exception as e:
        logger.error(f"Error notifying backend: {e}")

    is_staff = is_authenticated_staff(telegram_id)

    await update.message.reply_text(
        "Отлично! Авторизация успешна. ✅\n\n"
        "Вернитесь в приложение — вход будет выполнен автоматически.",
        reply_markup=get_main_menu_keyboard(is_staff=is_staff)
    )

    return MAIN_MENU if is_staff else ConversationHandler.END


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /help command."""
    await update.message.reply_text(
        "Bageatteria Bot\n\n"
        "Команды:\n"
        "/start - Главное меню\n"
        "/help - Справка\n\n"
        "Для сотрудников:\n"
        "📦 Приёмка - принять поставку\n"
        "📋 Инвентаризация - провести инвентаризацию\n"
        "📊 Остатки - посмотреть текущие остатки\n"
    )


async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Cancel current operation."""
    await update.message.reply_text(
        "Операция отменена.",
        reply_markup=get_main_menu_keyboard(is_staff=True)
    )
    return MAIN_MENU


def main():
    """Start the bot."""
    if not BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN not set!")
        sys.exit(1)

    logger.info("Starting Bageatteria Telegram Bot...")

    application = Application.builder().token(BOT_TOKEN).build()

    # Main conversation handler
    conv_handler = ConversationHandler(
        entry_points=[CommandHandler("start", start)],
        states={
            MAIN_MENU: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, main_menu_handler),
                MessageHandler(filters.CONTACT, handle_contact),
            ],
            AUTH_PHONE: [
                MessageHandler(filters.CONTACT, handle_contact),
                MessageHandler(filters.TEXT & ~filters.COMMAND, main_menu_handler),
            ],
            STAFF_LOGIN: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, handle_staff_login),
            ],
            SELECT_LOCATION: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, handle_location_selection),
            ],
            DELIVERY_LIST: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, handle_delivery_selection),
            ],
            DELIVERY_RECEIVE: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, start_delivery_receiving),
            ],
            DELIVERY_ITEM: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, handle_item_quantity),
            ],
            DELIVERY_PHOTO: [
                MessageHandler(filters.PHOTO, handle_delivery_photo),
                MessageHandler(filters.TEXT & ~filters.COMMAND, handle_delivery_confirmation),
            ],
            DELIVERY_CONFIRM: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, handle_delivery_confirmation),
            ],
            INVENTORY_START: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, handle_inventory_start),
            ],
            INVENTORY_ITEM: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, handle_inventory_item),
            ],
            INVENTORY_CONFIRM: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, handle_inventory_confirmation),
            ],
        },
        fallbacks=[
            CommandHandler("cancel", cancel),
            CommandHandler("start", start),
        ],
    )

    application.add_handler(conv_handler)
    application.add_handler(CommandHandler("help", help_command))

    logger.info("Bot is running...")
    application.run_polling(allowed_updates=Update.ALL_TYPES, drop_pending_updates=True)


if __name__ == "__main__":
    main()
