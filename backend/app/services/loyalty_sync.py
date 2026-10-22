"""
Синхронизация баланса карты с iikoCard.

Баллы живут в iikoCard. Узнать об изменении можно двумя путями:
1. вебхук iikoCard: в настройках программы галочка «Отправлять гостям уведомление на webhook
   при изменении баланса» + подписка в iikoCard → Настройки → Webhook-уведомления
   (https://ru.iiko.help/articles/#!iikocard/topic-9, #!iikocard/settings).
   Формат тела публично не описан — ищем в нём id гостя, телефон или номер карты.
2. страховка: периодический опрос карт (scripts/refresh_balances.py).
В обоих случаях баланс берём из iikoCloud API, тело вебхука — только сигнал.
"""
import logging
from datetime import datetime
from typing import Any, Iterable

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.loyalty import LoyaltyCard, WalletDevice, WalletRegistration
from app.services.iiko_loyalty import IikoLoyaltyClient, bonus_balance

logger = logging.getLogger(__name__)

_ID_KEYS = {"customerid", "guestid", "userid", "customer_id", "guest_id"}
_PHONE_KEYS = {"phone", "phonenumber", "userphone", "customerphone"}
_CARD_KEYS = {"cardnumber", "cardtrack", "card", "track", "number"}


def extract_identifiers(payload: Any) -> dict[str, set[str]]:
    """Достаёт из тела вебхука всё похожее на id гостя, телефон и номер карты (на любой глубине)."""
    found: dict[str, set[str]] = {"id": set(), "phone": set(), "card": set()}

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            for k, v in node.items():
                key = str(k).lower()
                if isinstance(v, (str, int)) and str(v).strip():
                    val = str(v).strip()
                    if key in _ID_KEYS:
                        found["id"].add(val)
                    elif key in _PHONE_KEYS:
                        found["phone"].add(normalize_phone(val))
                    elif key in _CARD_KEYS:
                        found["card"].add(val)
                else:
                    walk(v)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(payload)
    found["phone"].discard("")
    return found


def normalize_phone(raw: str) -> str:
    digits = "".join(ch for ch in raw if ch.isdigit())
    if len(digits) == 11 and digits[0] in "78":
        return "+7" + digits[1:]
    if len(digits) == 10:
        return "+7" + digits
    return ""


def cards_for_identifiers(db: Session, ids: dict[str, set[str]]) -> list[LoyaltyCard]:
    q = db.query(LoyaltyCard).filter(LoyaltyCard.is_active.is_(True))
    conds = []
    if ids["id"]:
        conds.append(LoyaltyCard.iiko_customer_id.in_(ids["id"]))
    if ids["phone"]:
        conds.append(LoyaltyCard.phone.in_(ids["phone"]))
    if ids["card"]:
        conds.append(LoyaltyCard.card_number.in_(ids["card"]))
        conds.append(LoyaltyCard.card_track.in_(ids["card"]))
    if not conds:
        return []
    return q.filter(or_(*conds)).all()


def refresh_card(db: Session, card: LoyaltyCard, client: IikoLoyaltyClient) -> bool:
    """Спрашивает баланс в iiko. True — баланс изменился (карту надо пересобрать и разослать push)."""
    if not card.iiko_customer_id:
        return False
    info = client.get_customer(card.iiko_customer_id)
    now = datetime.utcnow()
    card.balance_checked_at = now
    new_balance = bonus_balance(info)
    changed = new_balance != card.balance
    if changed:
        card.balance = new_balance
        card.updated_at = now
    db.commit()
    return changed


def push_tokens_by_platform(db: Session, cards: Iterable[LoyaltyCard]) -> dict[str, list[str]]:
    ids = [c.id for c in cards]
    if not ids:
        return {}
    rows = (
        db.query(WalletDevice.platform, WalletDevice.push_token)
        .join(WalletRegistration, WalletRegistration.device_library_id == WalletDevice.device_library_id)
        .filter(WalletRegistration.card_id.in_(ids))
        .distinct()
        .all()
    )
    out: dict[str, list[str]] = {}
    for platform, token in rows:
        out.setdefault(platform, []).append(token)
    return out


def stale_cards(db: Session, older_than: datetime, limit: int) -> list[LoyaltyCard]:
    """Карты для опроса-страховки: давно не проверенные, сначала самые «старые»."""
    return (
        db.query(LoyaltyCard)
        .filter(
            LoyaltyCard.is_active.is_(True),
            LoyaltyCard.iiko_customer_id.isnot(None),
            (LoyaltyCard.balance_checked_at.is_(None)) | (LoyaltyCard.balance_checked_at < older_than),
        )
        .order_by(LoyaltyCard.balance_checked_at.asc().nullsfirst())
        .limit(limit)
        .all()
    )


def sync_cards(db: Session, cards: Iterable[LoyaltyCard], client: IikoLoyaltyClient, notify) -> int:
    """Обновляет балансы; по изменившимся картам зовёт notify({platform: [push_tokens]}). Возвращает число изменений."""
    changed: list[LoyaltyCard] = []
    for card in cards:
        try:
            if refresh_card(db, card, client):
                changed.append(card)
        except Exception:  # одна сбойная карта не должна останавливать остальные
            logger.exception("Не удалось обновить баланс карты %s", card.serial_number)
            db.rollback()
    if changed:
        tokens = push_tokens_by_platform(db, changed)
        if tokens:
            notify(tokens)
    return len(changed)


def make_notifier(settings):
    """Настоящая рассылка push: APNs для iPhone, WalletPasses для Android."""
    from app.services import wallet_push

    def notify(tokens: dict[str, list[str]]) -> None:
        if tokens.get("apple") and settings.apple_pass_cert_path:
            with wallet_push.make_apns_client(
                settings.apple_pass_cert_path, settings.apple_pass_key_path, settings.apple_pass_key_password
            ) as apns:
                dead = wallet_push.send_pass_updates(apns, settings.apple_pass_type_id, tokens["apple"])
            if dead:
                logger.info("APNs: %d недействительных токенов", len(dead))
        if tokens.get("android"):
            import httpx

            with httpx.Client(timeout=10.0) as http:
                wallet_push.send_android_updates(
                    http, settings.apple_pass_type_id, tokens["android"], settings.walletpasses_api_key
                )

    return notify
