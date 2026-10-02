"""Add weight (grams) to modification_options

Revision ID: 0027_mod_option_weight
Revises: 0026_featured_mobile_image
Create Date: 2026-10-02

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0027_mod_option_weight'
down_revision: Union[str, None] = '0026_featured_mobile_image'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('modification_options', sa.Column('weight', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('modification_options', 'weight')
