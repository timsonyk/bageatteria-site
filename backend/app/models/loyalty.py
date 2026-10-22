"""
Карта гостя Bageatteria и регистрации карт Apple Wallet на устройствах.

Баллы — в iikoCard (источник правды), здесь только кэш баланса для карты в Wallet.
Таблицы названы loyalty_cards / wallet_*, чтобы не пересекаться со старыми
users / loyalty_accounts из шаблона Very Berry Lab, которые могут лежать в боевой базе.
"""
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, UniqueConstraint

from app.db.session import Base


class LoyaltyCard(Base):
    __tablename__ = "loyalty_cards"

    id = Column(Integer, primary_key=True)
    serial_number = Column(String(64), nullable=False, unique=True)  # serialNumber карты Wallet
    card_number = Column(String(32), nullable=False, unique=True)  # короткий номер для кассира
    card_track = Column(String(64), nullable=False, unique=True)  # содержимое QR = трек в iikoCard
    auth_token = Column(String(64), nullable=False)  # authenticationToken для веб-сервиса Wallet
    phone = Column(String(20), nullable=False, unique=True)  # +7XXXXXXXXXX, в карту не попадает
    iiko_customer_id = Column(String(64), nullable=True, unique=True)
    balance = Column(Integer, default=0, nullable=False)  # кэш баланса из iikoCard
    balance_checked_at = Column(DateTime, nullable=True)
    pd_consent_at = Column(DateTime, nullable=False)  # согласие на обработку ПД (152-ФЗ)
    ads_consent_at = Column(DateTime, nullable=True)  # отдельное согласие на рассылки (38-ФЗ)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    # Время последнего изменения содержимого карты — по нему Wallet спрашивает «что обновилось».
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class WalletDevice(Base):
    __tablename__ = "wallet_devices"

    device_library_id = Column(String(128), primary_key=True)
    push_token = Column(String(256), nullable=False)
    platform = Column(String(16), default="apple", nullable=False)  # apple | android (WalletPasses)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class WalletRegistration(Base):
    __tablename__ = "wallet_registrations"
    __table_args__ = (UniqueConstraint("device_library_id", "card_id", name="uq_wallet_reg_device_card"),)

    id = Column(Integer, primary_key=True)
    device_library_id = Column(
        String(128), ForeignKey("wallet_devices.device_library_id", ondelete="CASCADE"), nullable=False, index=True
    )
    card_id = Column(Integer, ForeignKey("loyalty_cards.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
