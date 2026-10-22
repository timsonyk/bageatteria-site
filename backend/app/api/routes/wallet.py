"""
Веб-сервис обновления карт Apple Wallet.

Пути — по спецификации Apple (их вызывает сам iPhone, базовый URL = webServiceURL из карты):
https://developer.apple.com/documentation/walletpasses/adding-a-web-service-to-update-passes
Плюс /wallet/download/{serial} — первая выдача карты гостю после регистрации на сайте.
"""
import hmac
import logging
from datetime import datetime, timezone
from email.utils import format_datetime, parsedate_to_datetime
from functools import lru_cache
from typing import Optional

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.config import get_settings
from app.core.rate_limit import limiter
from app.models.loyalty import LoyaltyCard, WalletDevice, WalletRegistration
from app.services.wallet_pass import PKPASS_MIME, LoyaltyCard as PassCard, PassSigner, build_pass_json, build_pkpass

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/wallet", tags=["wallet"])


def require_wallet():
    settings = get_settings()
    if not (settings.wallet_enabled and settings.apple_pass_type_id and settings.apple_pass_cert_path):
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Wallet не настроен")
    return settings


@lru_cache
def _signer_from_settings(cert: str, key: str, wwdr: str, password: str) -> PassSigner:
    return PassSigner.from_files(cert, key, wwdr, password)


def get_signer(settings=Depends(require_wallet)) -> PassSigner:
    return _signer_from_settings(
        settings.apple_pass_cert_path,
        settings.apple_pass_key_path,
        settings.apple_wwdr_cert_path,
        settings.apple_pass_key_password,
    )


def _check_pass_type(pass_type_id: str, settings) -> None:
    if pass_type_id != settings.apple_pass_type_id:
        raise HTTPException(status_code=404)


def _card_by_auth(db: Session, serial: str, authorization: Optional[str]) -> LoyaltyCard:
    card = db.query(LoyaltyCard).filter(LoyaltyCard.serial_number == serial, LoyaltyCard.is_active.is_(True)).first()
    prefix = "ApplePass "
    token = authorization[len(prefix):] if authorization and authorization.startswith(prefix) else ""
    if not card or not hmac.compare_digest(token, card.auth_token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    return card


def _http_time(dt: datetime) -> str:
    # В базе время в UTC без часового пояса.
    return format_datetime(dt.replace(microsecond=0, tzinfo=timezone.utc), usegmt=True)


def render_pkpass(card: LoyaltyCard, settings, signer: PassSigner) -> bytes:
    pass_json = build_pass_json(
        PassCard(
            serial_number=card.serial_number,
            card_number=card.card_number,
            barcode_message=card.card_track,
            balance=card.balance,
            auth_token=card.auth_token,
        ),
        pass_type_id=settings.apple_pass_type_id,
        team_id=settings.apple_team_id,
        web_service_url=settings.wallet_web_service_url or None,
    )
    return build_pkpass(pass_json, signer)


@router.post("/v1/devices/{device_id}/registrations/{pass_type_id}/{serial}")
def register_device(
    device_id: str,
    pass_type_id: str,
    serial: str,
    payload: dict = Body(...),
    authorization: Optional[str] = Header(None),
    settings=Depends(require_wallet),
    db: Session = Depends(get_db),
):
    _check_pass_type(pass_type_id, settings)
    card = _card_by_auth(db, serial, authorization)
    push_token = str(payload.get("pushToken") or "")
    if not push_token:
        raise HTTPException(status_code=400, detail="pushToken required")

    device = db.get(WalletDevice, device_id)
    if device:
        device.push_token = push_token
    else:
        db.add(WalletDevice(device_library_id=device_id, push_token=push_token))
    exists = (
        db.query(WalletRegistration)
        .filter(WalletRegistration.device_library_id == device_id, WalletRegistration.card_id == card.id)
        .first()
    )
    if not exists:
        db.add(WalletRegistration(device_library_id=device_id, card_id=card.id))
    db.commit()
    return Response(status_code=200 if exists else 201)


@router.get("/v1/devices/{device_id}/registrations/{pass_type_id}")
def updated_serials(
    device_id: str,
    pass_type_id: str,
    passesUpdatedSince: Optional[str] = None,
    settings=Depends(require_wallet),
    db: Session = Depends(get_db),
):
    _check_pass_type(pass_type_id, settings)
    q = (
        db.query(LoyaltyCard)
        .join(WalletRegistration, WalletRegistration.card_id == LoyaltyCard.id)
        .filter(WalletRegistration.device_library_id == device_id)
    )
    if passesUpdatedSince and passesUpdatedSince.isdigit():
        q = q.filter(LoyaltyCard.updated_at > datetime.utcfromtimestamp(int(passesUpdatedSince)))
    cards = q.all()
    if not cards:
        return Response(status_code=204)
    last = max(c.updated_at for c in cards)
    return {
        "serialNumbers": [c.serial_number for c in cards],
        "lastUpdated": str(int((last - datetime(1970, 1, 1)).total_seconds())),
    }


@router.get("/v1/passes/{pass_type_id}/{serial}")
def latest_pass(
    pass_type_id: str,
    serial: str,
    authorization: Optional[str] = Header(None),
    if_modified_since: Optional[str] = Header(None),
    settings=Depends(require_wallet),
    signer: PassSigner = Depends(get_signer),
    db: Session = Depends(get_db),
):
    _check_pass_type(pass_type_id, settings)
    card = _card_by_auth(db, serial, authorization)
    if if_modified_since:
        try:
            since = parsedate_to_datetime(if_modified_since).replace(tzinfo=None)
            if card.updated_at.replace(microsecond=0) <= since:
                return Response(status_code=304)
        except (TypeError, ValueError):
            pass
    return Response(
        content=render_pkpass(card, settings, signer),
        media_type=PKPASS_MIME,
        headers={"Last-Modified": _http_time(card.updated_at)},
    )


@router.delete("/v1/devices/{device_id}/registrations/{pass_type_id}/{serial}")
def unregister_device(
    device_id: str,
    pass_type_id: str,
    serial: str,
    authorization: Optional[str] = Header(None),
    settings=Depends(require_wallet),
    db: Session = Depends(get_db),
):
    _check_pass_type(pass_type_id, settings)
    card = _card_by_auth(db, serial, authorization)
    db.query(WalletRegistration).filter(
        WalletRegistration.device_library_id == device_id, WalletRegistration.card_id == card.id
    ).delete()
    if not db.query(WalletRegistration).filter(WalletRegistration.device_library_id == device_id).first():
        db.query(WalletDevice).filter(WalletDevice.device_library_id == device_id).delete()
    db.commit()
    return Response(status_code=200)


@router.post("/v1/log")
def device_log(payload: dict = Body(default={})):
    for line in (payload.get("logs") or [])[:20]:
        logger.warning("Wallet device log: %s", str(line)[:500])
    return Response(status_code=200)


@router.get("/download/{serial}")
@limiter.limit("20/minute")
def download_pass(
    request: Request,
    serial: str,
    token: str,
    settings=Depends(require_wallet),
    signer: PassSigner = Depends(get_signer),
    db: Session = Depends(get_db),
):
    """Ссылка «Добавить в Apple Wallet» со страницы гостя: ?token= — тот же authenticationToken."""
    card = _card_by_auth(db, serial, f"ApplePass {token}")
    return Response(
        content=render_pkpass(card, settings, signer),
        media_type=PKPASS_MIME,
        headers={"Content-Disposition": 'attachment; filename="bageatteria.pkpass"'},
    )
