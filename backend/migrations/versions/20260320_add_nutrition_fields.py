"""Add nutrition fields to products

Revision ID: 20260320_nutrition
Revises: 20260319_0015_product_store_availability
Create Date: 2026-03-20

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0016_nutrition_fields'
down_revision: Union[str, None] = '0015_product_store_availability'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('products', sa.Column('proteins', sa.Float(), nullable=True))
    op.add_column('products', sa.Column('fats', sa.Float(), nullable=True))
    op.add_column('products', sa.Column('carbs', sa.Float(), nullable=True))
    op.add_column('products', sa.Column('ingredients', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('products', 'ingredients')
    op.drop_column('products', 'carbs')
    op.drop_column('products', 'fats')
    op.drop_column('products', 'proteins')
