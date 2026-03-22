"""Add product_store_availability table

Revision ID: 0015_product_store_availability
Revises: 0014_product_weight_calories
Create Date: 2026-03-19
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0015_product_store_availability'
down_revision = '0014_product_weight_calories'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'product_store_availability',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('product_id', sa.Integer(), sa.ForeignKey('products.id', ondelete='CASCADE'), nullable=False),
        sa.Column('store_location_id', sa.Integer(), sa.ForeignKey('store_locations.id', ondelete='CASCADE'), nullable=False),
    )
    op.create_index('ix_product_store_availability_product_id', 'product_store_availability', ['product_id'])
    op.create_index('ix_product_store_availability_store_location_id', 'product_store_availability', ['store_location_id'])
    op.create_unique_constraint('uq_product_store', 'product_store_availability', ['product_id', 'store_location_id'])


def downgrade():
    op.drop_constraint('uq_product_store', 'product_store_availability', type_='unique')
    op.drop_index('ix_product_store_availability_store_location_id', 'product_store_availability')
    op.drop_index('ix_product_store_availability_product_id', 'product_store_availability')
    op.drop_table('product_store_availability')
