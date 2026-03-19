from typing import Optional
import logging

from sqlalchemy.orm import Session

from app.models.order import Payment, PaymentProvider, PaymentStatus

logger = logging.getLogger(__name__)


def create_payment(db: Session, order_id: int, amount: float, user_id: int, card_token: Optional[str] = None) -> Payment:
    """
    Create payment record.
    TODO: Integrate with VTB Business payment gateway.
    """
    payment = Payment(
        order_id=order_id,
        amount=amount,
        status=PaymentStatus.PENDING,
        provider=PaymentProvider.STUB,
        redirect_url=None,
        payment_token=f"stub_order_{order_id}",
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


def update_payment_status(db: Session, payment_id: int, status: PaymentStatus) -> Payment:
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise ValueError("Payment not found")
    payment.status = status
    db.commit()
    db.refresh(payment)
    return payment
