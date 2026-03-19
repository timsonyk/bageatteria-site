import enum
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Enum, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db.session import Base


class LoyaltyTransactionType(str, enum.Enum):
    EARN = "earn"
    SPEND = "spend"
    ADMIN_ADJUST = "admin_adjust"


class LoyaltyAccount(Base):
    __tablename__ = "loyalty_accounts"

    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    balance = Column(Float, default=0.0, nullable=False)  # points_available
    points_spent = Column(Float, default=0.0, nullable=False)
    cashback_percent = Column(Float, default=5.0, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="loyalty_account")


class LoyaltyTransaction(Base):
    __tablename__ = "loyalty_transactions"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    amount = Column(Float, nullable=False)  # positive = earn, negative = spend
    type = Column(
        Enum(LoyaltyTransactionType, values_callable=lambda obj: [e.value for e in LoyaltyTransactionType]),
        nullable=False,
    )
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    description = Column(String(255), nullable=True)
    admin_user = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="loyalty_transactions")


class Referral(Base):
    __tablename__ = "referrals"

    id = Column(Integer, primary_key=True)
    inviter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    invitee_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    bonus_given = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

