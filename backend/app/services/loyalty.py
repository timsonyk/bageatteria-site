"""
Loyalty service for managing points and cashback.
"""
from datetime import datetime
from decimal import Decimal
from sqlalchemy.orm import Session

from app.models.loyalty import LoyaltyAccount, LoyaltyTransaction, LoyaltyTransactionType
from app.models.user import User
from app.models.order import Order


def award_cashback_for_order(db: Session, order: Order) -> float:
    """
    Award cashback points for a completed/paid order.
    
    Calculates 5% cashback on the amount paid with money (not with points).
    Updates user's loyalty account and creates a transaction record.
    Also updates user's orders_count and orders_sum.
    
    Args:
        db: Database session
        order: The order to award cashback for
        
    Returns:
        float: The amount of points awarded
    """
    # Get user
    user = db.query(User).filter(User.id == order.user_id).first()
    if not user:
        raise ValueError(f"User {order.user_id} not found")
    
    # Get or create loyalty account
    loyalty_account = db.query(LoyaltyAccount).filter(LoyaltyAccount.user_id == user.id).first()
    if not loyalty_account:
        loyalty_account = LoyaltyAccount(
            user_id=user.id,
            balance=0.0,
            points_spent=0.0,
            cashback_percent=5.0,
        )
        db.add(loyalty_account)
        db.flush()
    
    # Calculate cashback: 5% of the total minus any loyalty points already earned
    # The loyalty_earned field in the order should already be calculated in pricing.py
    points_to_award = float(order.loyalty_earned) if order.loyalty_earned else 0.0
    
    if points_to_award <= 0:
        return 0.0
    
    # Update loyalty account balance
    loyalty_account.balance += points_to_award
    loyalty_account.updated_at = datetime.utcnow()
    
    # Create transaction record
    transaction = LoyaltyTransaction(
        user_id=user.id,
        amount=points_to_award,
        type=LoyaltyTransactionType.EARN,
        order_id=order.id,
        description=f"Cashback for order #{order.id}",
    )
    db.add(transaction)
    
    # Update user statistics
    user.orders_count += 1
    user.orders_sum = (user.orders_sum or Decimal('0')) + order.total
    
    # Set first order date if not set
    if not user.first_order_date:
        user.first_order_date = datetime.utcnow().date()
    
    db.commit()
    
    return points_to_award


def spend_loyalty_points(db: Session, user_id: int, amount: float, order_id: int = None, description: str = None) -> None:
    """
    Spend loyalty points from user's account.
    
    Args:
        db: Database session
        user_id: User ID
        amount: Amount of points to spend
        order_id: Optional order ID if spending on an order
        description: Optional description
    """
    loyalty_account = db.query(LoyaltyAccount).filter(LoyaltyAccount.user_id == user_id).first()
    if not loyalty_account:
        raise ValueError(f"Loyalty account not found for user {user_id}")
    
    if loyalty_account.balance < amount:
        raise ValueError(f"Insufficient balance: {loyalty_account.balance} < {amount}")
    
    # Deduct from balance
    loyalty_account.balance -= amount
    loyalty_account.points_spent += amount
    loyalty_account.updated_at = datetime.utcnow()
    
    # Create transaction record
    transaction = LoyaltyTransaction(
        user_id=user_id,
        amount=-amount,  # Negative for spending
        type=LoyaltyTransactionType.SPEND,
        order_id=order_id,
        description=description or f"Points spent on order #{order_id}" if order_id else "Points spent",
    )
    db.add(transaction)
    db.commit()

