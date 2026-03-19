"""
Seed pickup points for Bageatteria.

Usage:
    docker-compose exec backend python -m scripts.seed_pickup_points
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import get_settings
from app.models.catalog import StoreLocation


def seed_pickup_points():
    """Add Bageatteria pickup points: Депо and Смоленская."""
    settings = get_settings()
    engine = create_engine(settings.database_url)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    pickup_points = [
        {
            "name": "Депо",
            "city": "Москва",
            "address_text": "Лесная ул., 20с6",  # Депо Москва
            "lat": 55.7808,
            "lng": 37.5889,
            "phone": "+7 (999) 123-45-67",
            "working_hours": "08:00 - 22:00",
            "sort_order": 1,
            "is_active": True,
        },
        {
            "name": "Смоленская",
            "city": "Москва",
            "address_text": "Смоленская пл., 3",
            "lat": 55.7473,
            "lng": 37.5839,
            "phone": "+7 (999) 123-45-68",
            "working_hours": "08:00 - 22:00",
            "sort_order": 2,
            "is_active": True,
        },
    ]

    try:
        for point_data in pickup_points:
            # Check if already exists
            existing = db.query(StoreLocation).filter(
                StoreLocation.name == point_data["name"]
            ).first()

            if existing:
                print(f"Updating existing pickup point: {point_data['name']}")
                for key, value in point_data.items():
                    setattr(existing, key, value)
            else:
                print(f"Creating pickup point: {point_data['name']}")
                point = StoreLocation(**point_data)
                db.add(point)

        db.commit()
        print("Pickup points seeded successfully!")

    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_pickup_points()
