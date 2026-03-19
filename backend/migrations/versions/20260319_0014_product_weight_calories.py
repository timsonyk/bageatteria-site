"""Add weight and calories to products

Revision ID: 0014_product_weight_calories
Revises: 0013_product_size_volume
Create Date: 2026-03-19
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0014_product_weight_calories'
down_revision = '0013_product_size_volume'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('products', sa.Column('weight', sa.String(50), nullable=True))
    op.add_column('products', sa.Column('calories', sa.Integer(), nullable=True))


def downgrade():
    op.drop_column('products', 'calories')
    op.drop_column('products', 'weight')
