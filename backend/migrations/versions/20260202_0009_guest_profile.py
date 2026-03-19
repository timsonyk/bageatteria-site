"""Add guest profile fields for Bageatteria loyalty program

Revision ID: 0009_guest_profile
Revises: 0008_notifications
Create Date: 2026-02-02
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0009_guest_profile'
down_revision = '20250112_0008'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add guest_code column - unique sequential code for iiko identification
    op.add_column('users', sa.Column('guest_code', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_users_guest_code'), 'users', ['guest_code'], unique=True)

    # Add monthly_spent column - spending in current month for discount calculation
    op.add_column('users', sa.Column('monthly_spent', sa.Numeric(12, 2), nullable=False, server_default='0'))

    # Add visits_count column - number of visits to coffee shop
    op.add_column('users', sa.Column('visits_count', sa.Integer(), nullable=False, server_default='0'))

    # Assign guest_code to existing users
    connection = op.get_bind()
    result = connection.execute(sa.text("SELECT id FROM users ORDER BY id"))
    users = result.fetchall()
    for i, (user_id,) in enumerate(users, start=1):
        connection.execute(
            sa.text("UPDATE users SET guest_code = :code WHERE id = :id"),
            {"code": i, "id": user_id}
        )


def downgrade() -> None:
    op.drop_index(op.f('ix_users_guest_code'), table_name='users')
    op.drop_column('users', 'guest_code')
    op.drop_column('users', 'monthly_spent')
    op.drop_column('users', 'visits_count')
