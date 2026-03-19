"""Enable polygon delivery zones
Revision ID: 20231223_0004
Revises: 20231222_0003
Create Date: 2025-12-23
"""
from alembic import op
import sqlalchemy as sa

revision = "20231223_0004"
down_revision = "20231222_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("delivery_zones", sa.Column("polygon", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("delivery_zones", "polygon")









