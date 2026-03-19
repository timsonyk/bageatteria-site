"""Add volume column to product_sizes

Revision ID: 0013_product_size_volume
Revises: 0012_category_recommendations
Create Date: 2026-02-17
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = '0013_product_size_volume'
down_revision = '0012_category_recommendations'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('product_sizes', sa.Column('volume', sa.String(50), nullable=True))


def downgrade():
    op.drop_column('product_sizes', 'volume')
