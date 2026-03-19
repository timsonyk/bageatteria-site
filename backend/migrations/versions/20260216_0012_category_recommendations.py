"""Add category_recommendations table

Revision ID: 0012_category_recommendations
Revises: 0011_stock_management
Create Date: 2026-02-16

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0012_category_recommendations'
down_revision = '0011_stock_management'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'category_recommendations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('category_id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('sort_order', sa.Integer(), server_default='0', nullable=False),
        sa.ForeignKeyConstraint(['category_id'], ['categories.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_category_recommendations_category_id', 'category_recommendations', ['category_id'])
    op.create_index('ix_category_recommendations_product_id', 'category_recommendations', ['product_id'])


def downgrade():
    op.drop_index('ix_category_recommendations_product_id', table_name='category_recommendations')
    op.drop_index('ix_category_recommendations_category_id', table_name='category_recommendations')
    op.drop_table('category_recommendations')
