"""Add per-flag sort order fields and featured desktop image

Revision ID: 0025_highlights_order
Revises: 0024_drop_pct
Create Date: 2026-04-28

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0025_highlights_order'
down_revision: Union[str, None] = '0024_drop_pct'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('products', sa.Column('recommended_menu_order', sa.Integer(), nullable=True))
    op.add_column('products', sa.Column('recommended_favorites_order', sa.Integer(), nullable=True))
    op.add_column('products', sa.Column('featured_menu_order', sa.Integer(), nullable=True))
    op.add_column('products', sa.Column('featured_desktop_image', sa.String(length=512), nullable=True))


def downgrade() -> None:
    op.drop_column('products', 'featured_desktop_image')
    op.drop_column('products', 'featured_menu_order')
    op.drop_column('products', 'recommended_favorites_order')
    op.drop_column('products', 'recommended_menu_order')
