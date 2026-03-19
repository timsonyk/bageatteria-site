"""Remove radius/center columns from delivery zones

Revision ID: 20231224_0005
Revises: 20231223_0004
Create Date: 2025-12-24
"""
from alembic import op
import sqlalchemy as sa

revision = "20231224_0005"
down_revision = "20231223_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("delivery_zones", "center_lat")
    op.drop_column("delivery_zones", "center_lng")
    op.drop_column("delivery_zones", "radius_meters")


def downgrade() -> None:
    op.add_column("delivery_zones", sa.Column("radius_meters", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("delivery_zones", sa.Column("center_lng", sa.Float(), nullable=False, server_default="0"))
    op.add_column("delivery_zones", sa.Column("center_lat", sa.Float(), nullable=False, server_default="0"))








