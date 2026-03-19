"""Add notifications tables

Revision ID: 20250112_0008
Revises: 20231227_0007
Create Date: 2025-01-12
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20250112_0008"
down_revision = "20231227_0007"
branch_labels = None
depends_on = None

# Define enums
deviceplatform_enum = postgresql.ENUM('ios', 'android', name='deviceplatform', create_type=False)
notificationtype_enum = postgresql.ENUM('promo', 'order', 'system', 'bonus', name='notificationtype', create_type=False)


def upgrade() -> None:
    # Create enums
    deviceplatform_enum.create(op.get_bind(), checkfirst=True)
    notificationtype_enum.create(op.get_bind(), checkfirst=True)

    # Device tokens table
    op.create_table(
        "device_tokens",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("token", sa.String(512), nullable=False, unique=True, index=True),
        sa.Column("platform", deviceplatform_enum, nullable=False, server_default="ios"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.sql.expression.true()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # Notifications table
    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True, index=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("notification_type", notificationtype_enum, nullable=False, server_default="promo"),
        sa.Column("data_json", sa.Text(), nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.sql.expression.false()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # Push campaigns table
    op.create_table(
        "push_campaigns",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("notification_type", notificationtype_enum, nullable=False, server_default="promo"),
        sa.Column("sent_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("push_campaigns")
    op.drop_table("notifications")
    op.drop_table("device_tokens")

    # Drop enums
    sa.Enum(name="notificationtype").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="deviceplatform").drop(op.get_bind(), checkfirst=True)
