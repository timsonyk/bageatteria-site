from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.promo import PromoValidateRequest, PromoValidateResponse
from app.services.pricing import calculate_totals


router = APIRouter(prefix="/promo", tags=["promo"])


@router.post("/validate", response_model=PromoValidateResponse)
def validate_promo(payload: PromoValidateRequest, db: Session = Depends(get_db)):
    try:
        totals = calculate_totals(
            db,
            items_payload=[item.model_dump() for item in payload.items],
            promo_code=payload.code,
            city=payload.city,
        )
    except Exception as exc:
        return PromoValidateResponse(valid=False, discount=0, reason=str(exc))
    return PromoValidateResponse(valid=True, discount=totals["discount"])

