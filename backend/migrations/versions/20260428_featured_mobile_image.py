"""Add featured_mobile_image to products

Revision ID: 0026_featured_mobile_image
Revises: 0025_highlights_order
Create Date: 2026-04-28

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0026_featured_mobile_image'
down_revision: Union[str, None] = '0025_highlights_order'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('products', sa.Column('featured_mobile_image', sa.String(length=512), nullable=True))


def downgrade() -> None:
    op.drop_column('products', 'featured_mobile_image')
