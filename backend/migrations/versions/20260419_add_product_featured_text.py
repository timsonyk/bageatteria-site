"""Add featured_text to products

Revision ID: 0020_product_featured_text
Revises: 0019_product_rec_flags
Create Date: 2026-04-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0020_product_featured_text'
down_revision: Union[str, None] = '0019_product_rec_flags'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('products', sa.Column('featured_text', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('products', 'featured_text')
