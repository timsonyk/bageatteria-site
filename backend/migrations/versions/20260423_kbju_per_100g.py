"""KBJU per-100g: product, modification option; volume_ml on product_size

Revision ID: 0023_kbju_per_100g
Revises: 0022_mod_option_pct
Create Date: 2026-04-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0023_kbju_per_100g'
down_revision: Union[str, None] = '0022_mod_option_pct'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for table in ("products", "modification_options"):
        op.add_column(table, sa.Column("calories_per_100g", sa.Integer(), nullable=True))
        op.add_column(table, sa.Column("proteins_per_100g", sa.Float(), nullable=True))
        op.add_column(table, sa.Column("fats_per_100g", sa.Float(), nullable=True))
        op.add_column(table, sa.Column("carbs_per_100g", sa.Float(), nullable=True))
    op.add_column("product_sizes", sa.Column("volume_ml", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("product_sizes", "volume_ml")
    for table in ("products", "modification_options"):
        op.drop_column(table, "carbs_per_100g")
        op.drop_column(table, "fats_per_100g")
        op.drop_column(table, "proteins_per_100g")
        op.drop_column(table, "calories_per_100g")
