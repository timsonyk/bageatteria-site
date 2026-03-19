"""Add store_locations table

Revision ID: 20231227_0007
Revises: 20231225_0006
Create Date: 2023-12-27

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20231227_0007'
down_revision = '20231225_0006'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'store_locations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('city', sa.String(length=100), nullable=False),
        sa.Column('address_text', sa.Text(), nullable=False),
        sa.Column('lat', sa.Float(), nullable=True),
        sa.Column('lng', sa.Float(), nullable=True),
        sa.Column('phone', sa.String(length=20), nullable=True),
        sa.Column('working_hours', sa.String(length=255), nullable=True),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade():
    op.drop_table('store_locations')

