from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api.deps import get_current_user, get_db
from app.models.loyalty import LoyaltyAccount, Referral
from app.models.user import Address, User
from app.schemas.user import (
    AddressCreate, AddressOut, LoyaltyOut, UserOut, UserUpdate,
    GuestCodeOut, GuestStatsOut, GuestStatusOut, GuestDiscountOut, GuestStatus
)

router = APIRouter(prefix="/me", tags=["profile"])


# Настройки статусной системы Bageatteria
STATUS_THRESHOLDS = [
    {"level": 1, "name": "Новичок", "min_spent": 0, "privileges": []},
    {"level": 2, "name": "Постоянный гость", "min_spent": 5000, "privileges": ["Приоритетное обслуживание"]},
    {"level": 3, "name": "VIP", "min_spent": 15000, "privileges": ["Приоритетное обслуживание", "Приглашения на дегустации", "Ранний доступ к новинкам"]},
]

# Настройки скидок (зависят от трат за месяц)
DISCOUNT_THRESHOLDS = [
    {"min_monthly": 0, "discount": 0},
    {"min_monthly": 3000, "discount": 5},
    {"min_monthly": 7000, "discount": 10},
    {"min_monthly": 15000, "discount": 15},
]


def get_status_for_spent(total_spent: float) -> tuple[dict, dict | None]:
    """Определяет статус гостя по общей сумме трат"""
    current = STATUS_THRESHOLDS[0]
    next_status = STATUS_THRESHOLDS[1] if len(STATUS_THRESHOLDS) > 1 else None

    for i, threshold in enumerate(STATUS_THRESHOLDS):
        if total_spent >= threshold["min_spent"]:
            current = threshold
            next_status = STATUS_THRESHOLDS[i + 1] if i + 1 < len(STATUS_THRESHOLDS) else None

    return current, next_status


def get_discount_for_monthly(monthly_spent: float) -> tuple[int, int | None, float | None]:
    """Определяет скидку по тратам за месяц"""
    current_discount = 0
    next_discount = None
    next_threshold = None

    for i, threshold in enumerate(DISCOUNT_THRESHOLDS):
        if monthly_spent >= threshold["min_monthly"]:
            current_discount = threshold["discount"]
            if i + 1 < len(DISCOUNT_THRESHOLDS):
                next_discount = DISCOUNT_THRESHOLDS[i + 1]["discount"]
                next_threshold = DISCOUNT_THRESHOLDS[i + 1]["min_monthly"]

    return current_discount, next_discount, next_threshold


@router.get("", response_model=UserOut)
def get_me(user=Depends(get_current_user)):
    return user


@router.patch("", response_model=UserOut)
def update_me(payload: UserUpdate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/addresses", response_model=list[AddressOut])
def list_addresses(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(Address).filter(Address.user_id == user.id).all()


@router.post("/addresses", response_model=AddressOut)
def create_address(payload: AddressCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    address = Address(user_id=user.id, **payload.model_dump())
    db.add(address)
    db.commit()
    db.refresh(address)
    return address


@router.delete("/addresses/{address_id}", response_model=dict)
def delete_address(address_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    address = db.query(Address).filter(Address.id == address_id, Address.user_id == user.id).first()
    if not address:
        raise HTTPException(status_code=404, detail="Address not found")
    db.delete(address)
    db.commit()
    return {"deleted": True}


@router.get("/loyalty", response_model=LoyaltyOut)
def get_loyalty(db: Session = Depends(get_db), user=Depends(get_current_user)):
    # Get or create loyalty account
    account = db.query(LoyaltyAccount).filter(LoyaltyAccount.user_id == user.id).first()
    if not account:
        account = LoyaltyAccount(user_id=user.id)
        db.add(account)
        db.commit()
        db.refresh(account)
    
    # Get user data with orders info
    user_data = db.query(User).filter(User.id == user.id).first()
    
    return LoyaltyOut(
        points_available=account.balance,
        points_spent=account.points_spent,
        cashback_percent=account.cashback_percent,
        orders_count=user_data.orders_count,
        orders_sum=float(user_data.orders_sum) if user_data.orders_sum else 0.0,
        first_order_date=user_data.first_order_date,
    )


@router.get("/cards", response_model=dict)
def list_cards():
    # Stub: would show saved tokens from provider
    return {"cards": []}


@router.get("/referrals", response_model=dict)
def list_referrals(db: Session = Depends(get_db), user=Depends(get_current_user)):
    refs = db.query(Referral).filter(Referral.inviter_id == user.id).all()
    return {"count": len(refs), "referrals": [{"invitee_id": r.invitee_id, "bonus_given": r.bonus_given} for r in refs]}


# ========== Bageatteria: Гостевой профиль ==========

@router.get("/guest-code", response_model=GuestCodeOut)
def get_guest_code(user=Depends(get_current_user)):
    """Получить числовой код гостя и содержимое для QR-кода"""
    if not user.guest_code:
        raise HTTPException(status_code=404, detail="Guest code not assigned")

    return GuestCodeOut(
        guest_code=user.guest_code,
        qr_content=f"bageatteria://guest/{user.guest_code}"
    )


@router.get("/stats", response_model=GuestStatsOut)
def get_guest_stats(user=Depends(get_current_user)):
    """Получить статистику гостя"""
    return GuestStatsOut(
        guest_code=user.guest_code or 0,
        total_spent=float(user.orders_sum) if user.orders_sum else 0.0,
        monthly_spent=float(user.monthly_spent) if user.monthly_spent else 0.0,
        visits_count=user.visits_count or 0,
        orders_count=user.orders_count or 0,
    )


@router.get("/status", response_model=GuestStatusOut)
def get_guest_status(user=Depends(get_current_user)):
    """Получить статус гостя в программе лояльности"""
    total_spent = float(user.orders_sum) if user.orders_sum else 0.0
    current, next_status = get_status_for_spent(total_spent)

    # Расчет прогресса до следующего статуса
    progress = 0.0
    next_threshold = None
    if next_status:
        next_threshold = next_status["min_spent"]
        current_min = current["min_spent"]
        if next_threshold > current_min:
            progress = min(100, ((total_spent - current_min) / (next_threshold - current_min)) * 100)

    return GuestStatusOut(
        status=GuestStatus(
            name=current["name"],
            level=current["level"],
            privileges=current["privileges"]
        ),
        progress_percent=progress,
        next_status_threshold=next_threshold
    )


@router.get("/discount", response_model=GuestDiscountOut)
def get_guest_discount(user=Depends(get_current_user)):
    """Получить персональную скидку гостя"""
    monthly_spent = float(user.monthly_spent) if user.monthly_spent else 0.0
    discount, next_discount, next_threshold = get_discount_for_monthly(monthly_spent)

    return GuestDiscountOut(
        discount_percent=discount,
        monthly_spent=monthly_spent,
        next_discount_percent=next_discount,
        next_discount_threshold=next_threshold
    )

