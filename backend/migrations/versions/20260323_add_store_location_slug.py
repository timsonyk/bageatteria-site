"""Add slug field to store_locations

Revision ID: 0017_store_location_slug
Revises: 0016_nutrition_fields
Create Date: 2026-03-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0017_store_location_slug'
down_revision: Union[str, None] = '0016_nutrition_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add slug column as nullable first
    op.add_column('store_locations', sa.Column('slug', sa.String(50), nullable=True))

    # Fill existing rows with slugs based on name
    op.execute("UPDATE store_locations SET slug = 'depo' WHERE id = 1")
    op.execute("UPDATE store_locations SET slug = 'smolenskaya' WHERE id = 2")
    op.execute("UPDATE store_locations SET slug = 'patriki' WHERE id = 3")
    op.execute("UPDATE store_locations SET slug = 'privoz' WHERE id = 4")
    # Fallback for any other rows
    op.execute("UPDATE store_locations SET slug = 'location_' || id WHERE slug IS NULL")

    # Make column NOT NULL and add unique constraint
    op.alter_column('store_locations', 'slug', nullable=False)
    op.create_unique_constraint('uq_store_locations_slug', 'store_locations', ['slug'])


def downgrade() -> None:
    op.drop_constraint('uq_store_locations_slug', 'store_locations', type_='unique')
    op.drop_column('store_locations', 'slug')
