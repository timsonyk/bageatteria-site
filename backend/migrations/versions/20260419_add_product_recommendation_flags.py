"""Add recommendation flags to products

Revision ID: 0019_product_rec_flags
Revises: 0018_category_unit
Create Date: 2026-04-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0019_product_rec_flags'
down_revision: Union[str, None] = '0018_category_unit'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'products',
        sa.Column('is_recommended_menu', sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        'products',
        sa.Column('is_recommended_favorites', sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        'products',
        sa.Column('is_featured_menu', sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column('products', 'is_featured_menu')
    op.drop_column('products', 'is_recommended_favorites')
    op.drop_column('products', 'is_recommended_menu')
