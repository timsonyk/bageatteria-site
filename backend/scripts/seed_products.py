"""Seed products script for Bageatteria"""
import sys
sys.path.insert(0, '/Users/timofey/Projects/bageatteria_сайт/backend')

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.catalog import Category, Product
import json

DATABASE_URL = "postgresql+psycopg://bageatteria:bageatteria@localhost:5432/bageatteria"

engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
session = Session()

# Get uploaded images
import os
uploads_dir = "/Users/timofey/Projects/bageatteria_сайт/backend/uploads"
images = sorted([f for f in os.listdir(uploads_dir) if f.endswith(('.jpg', '.png', '.PNG', '.jpeg'))])

print(f"Found {len(images)} images")

# Clear existing data
session.query(Product).delete()
session.query(Category).delete()
session.commit()

# Create categories
categories_data = [
    {"name": "Кофе", "sort_order": 0},
    {"name": "Чай", "sort_order": 10},
    {"name": "Лимонады", "sort_order": 20},
    {"name": "Какао", "sort_order": 30},
]

categories = {}
for cat_data in categories_data:
    cat = Category(name=cat_data["name"], sort_order=cat_data["sort_order"], is_active=True)
    session.add(cat)
    session.flush()
    categories[cat_data["name"]] = cat.id
    print(f"Created category: {cat_data['name']} (id={cat.id})")

session.commit()

# Products data
products_data = [
    # Кофе
    {"name": "Эспрессо", "description": "Классический итальянский эспрессо", "base_price": 150, "category": "Кофе"},
    {"name": "Американо", "description": "Эспрессо с горячей водой", "base_price": 180, "category": "Кофе"},
    {"name": "Капучино", "description": "Эспрессо с молочной пенкой", "base_price": 250, "category": "Кофе"},
    {"name": "Латте", "description": "Эспрессо с большим количеством молока", "base_price": 280, "category": "Кофе"},
    {"name": "Флэт Уайт", "description": "Двойной эспрессо с молоком", "base_price": 290, "category": "Кофе"},
    {"name": "Раф", "description": "Кофе со сливками и ванильным сахаром", "base_price": 320, "category": "Кофе"},
    {"name": "Моккачино", "description": "Кофе с шоколадом и молоком", "base_price": 310, "category": "Кофе"},
    {"name": "Капучино карамельный", "description": "Капучино с карамельным сиропом", "base_price": 290, "category": "Кофе"},
    {"name": "Латте ванильный", "description": "Латте с ванильным сиропом", "base_price": 310, "category": "Кофе"},
    {"name": "Айс Латте", "description": "Холодный латте со льдом", "base_price": 290, "category": "Кофе"},
    {"name": "Айс Американо", "description": "Холодный американо со льдом", "base_price": 200, "category": "Кофе"},
    {"name": "Бамбл", "description": "Эспрессо с апельсиновым соком", "base_price": 280, "category": "Кофе"},

    # Чай
    {"name": "Чай чёрный", "description": "Классический чёрный чай", "base_price": 150, "category": "Чай"},
    {"name": "Чай зелёный", "description": "Классический зелёный чай", "base_price": 150, "category": "Чай"},
    {"name": "Чай с облепихой", "description": "Чай с облепихой и мёдом", "base_price": 220, "category": "Чай"},
    {"name": "Чай с имбирём", "description": "Согревающий чай с имбирём и лимоном", "base_price": 220, "category": "Чай"},
    {"name": "Чай ягодный", "description": "Чай с лесными ягодами", "base_price": 220, "category": "Чай"},
    {"name": "Матча Латте", "description": "Японский зелёный чай матча с молоком", "base_price": 320, "category": "Чай"},

    # Лимонады
    {"name": "Лимонад классический", "description": "Освежающий лимонад с лимоном и мятой", "base_price": 220, "category": "Лимонады"},
    {"name": "Лимонад клубничный", "description": "Лимонад с клубникой и базиликом", "base_price": 250, "category": "Лимонады"},
    {"name": "Лимонад манго-маракуйя", "description": "Тропический лимонад", "base_price": 260, "category": "Лимонады"},
    {"name": "Лимонад апельсиновый", "description": "Лимонад со свежим апельсином", "base_price": 240, "category": "Лимонады"},
    {"name": "Мохито безалкогольный", "description": "Освежающий мохито с мятой и лаймом", "base_price": 250, "category": "Лимонады"},

    # Какао
    {"name": "Какао классическое", "description": "Горячий какао на молоке", "base_price": 220, "category": "Какао"},
    {"name": "Какао с маршмеллоу", "description": "Какао с воздушным маршмеллоу", "base_price": 260, "category": "Какао"},
    {"name": "Горячий шоколад", "description": "Густой горячий шоколад", "base_price": 280, "category": "Какао"},
]

# Assign images to products
for i, product_data in enumerate(products_data):
    image_idx = i % len(images)  # Cycle through images if not enough
    image_filename = images[image_idx]

    product = Product(
        name=product_data["name"],
        description=product_data["description"],
        base_price=product_data["base_price"],
        category_id=categories[product_data["category"]],
        is_active=True,
        sort_order=i * 10,
        media=[{"url": f"/uploads/{image_filename}"}]
    )
    session.add(product)
    print(f"Created product: {product_data['name']} - {product_data['base_price']}₽ (image: {image_filename})")

session.commit()
print(f"\nDone! Created {len(categories)} categories and {len(products_data)} products")
session.close()
