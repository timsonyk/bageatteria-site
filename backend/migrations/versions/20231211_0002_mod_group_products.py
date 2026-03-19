"""add modification_group_products m2m

Revision ID: 20231211_0002
Revises: 20231210_0001
Create Date: 2025-12-11
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20231211_0002"
down_revision = "20231210_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "modification_group_products",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("group_id", sa.Integer(), sa.ForeignKey("modification_groups.id"), nullable=False, index=True),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id"), nullable=False, index=True),
    )


def downgrade() -> None:
    op.drop_table("modification_group_products")

