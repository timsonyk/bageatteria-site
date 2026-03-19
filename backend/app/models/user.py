from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, Float
from sqlalchemy.orm import relationship

from app.db.session import Base


class CityEnum(str):
    MOSCOW = "moscow"
    SPB = "spb"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    guest_code = Column(Integer, unique=True, nullable=True, index=True)  # Уникальный код гостя для iiko
    phone = Column(String(20), unique=True, nullable=False, index=True)
    telegram_id = Column(BigInteger, unique=True, nullable=True, index=True)
    legacy_client_id = Column(String(50), nullable=True, index=True)
    name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    city = Column(String(50), nullable=True)
    birthday = Column(Date, nullable=True)
    first_order_date = Column(Date, nullable=True)
    orders_count = Column(Integer, default=0, nullable=False)
    orders_sum = Column(Numeric(12, 2), default=0, nullable=False)
    monthly_spent = Column(Numeric(12, 2), default=0, nullable=False)  # Траты за текущий месяц
    visits_count = Column(Integer, default=0, nullable=False)  # Количество визитов
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    loyalty_account = relationship("LoyaltyAccount", back_populates="user", uselist=False)
    addresses = relationship("Address", back_populates="user")
    orders = relationship("Order", back_populates="user")
    loyalty_transactions = relationship("LoyaltyTransaction", back_populates="user")


class AuthCode(Base):
    __tablename__ = "auth_codes"

    id = Column(Integer, primary_key=True)
    phone = Column(String(20), nullable=False, index=True)
    code = Column(String(10), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    consumed = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Address(Base):
    __tablename__ = "addresses"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    label = Column(String(255), nullable=True)
    address_text = Column(Text, nullable=False)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    city = Column(String(50), nullable=True)
    entrance = Column(String(50), nullable=True)
    comment = Column(Text, nullable=True)
    is_default = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="addresses")

