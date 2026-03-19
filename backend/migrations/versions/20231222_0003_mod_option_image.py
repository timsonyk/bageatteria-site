"""Add image_url to modification_options

Revision ID: 20231222_0003
Revises: 20231211_0002
Create Date: 2024-12-22
"""
from alembic import op
import sqlalchemy as sa

revision = "20231222_0003"
down_revision = "20231211_0002"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("modification_options", sa.Column("image_url", sa.String(500), nullable=True))


def downgrade():
    op.drop_column("modification_options", "image_url")









