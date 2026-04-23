"""Add KBJU (calories/proteins/fats/carbs) to product_sizes and modification_options

Revision ID: 0021_kbju_sizes_mods
Revises: 0020_product_featured_text
Create Date: 2026-04-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0021_kbju_sizes_mods'
down_revision: Union[str, None] = '0020_product_featured_text'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for table in ("product_sizes", "modification_options"):
        op.add_column(table, sa.Column("calories", sa.Integer(), nullable=True))
        op.add_column(table, sa.Column("proteins", sa.Float(), nullable=True))
        op.add_column(table, sa.Column("fats", sa.Float(), nullable=True))
        op.add_column(table, sa.Column("carbs", sa.Float(), nullable=True))


def downgrade() -> None:
    for table in ("product_sizes", "modification_options"):
        op.drop_column(table, "carbs")
        op.drop_column(table, "fats")
        op.drop_column(table, "proteins")
        op.drop_column(table, "calories")
