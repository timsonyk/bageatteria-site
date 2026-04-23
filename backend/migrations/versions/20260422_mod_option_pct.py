"""Add percent-delta fields to modification_options

Revision ID: 0022_mod_option_pct
Revises: 0021_kbju_sizes_mods
Create Date: 2026-04-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0022_mod_option_pct'
down_revision: Union[str, None] = '0021_kbju_sizes_mods'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for col in ("calories_pct", "proteins_pct", "fats_pct", "carbs_pct"):
        op.add_column("modification_options", sa.Column(col, sa.Float(), nullable=True))


def downgrade() -> None:
    for col in ("carbs_pct", "fats_pct", "proteins_pct", "calories_pct"):
        op.drop_column("modification_options", col)
