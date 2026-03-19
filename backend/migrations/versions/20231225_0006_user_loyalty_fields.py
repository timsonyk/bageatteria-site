"""Add user loyalty fields and loyalty_transactions table

Revision ID: 20231225_0006
Revises: 20231224_0005
Create Date: 2024-12-22

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20231225_0006'
down_revision = '20231224_0005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new columns to users table
    op.add_column('users', sa.Column('telegram_id', sa.BigInteger(), nullable=True))
    op.add_column('users', sa.Column('legacy_client_id', sa.String(50), nullable=True))
    op.add_column('users', sa.Column('first_order_date', sa.Date(), nullable=True))
    op.add_column('users', sa.Column('orders_count', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('orders_sum', sa.Numeric(12, 2), nullable=False, server_default='0'))
    
    # Create indexes
    op.create_index('ix_users_telegram_id', 'users', ['telegram_id'], unique=True)
    op.create_index('ix_users_legacy_client_id', 'users', ['legacy_client_id'], unique=False)
    
    # Add points_spent to loyalty_accounts
    op.add_column('loyalty_accounts', sa.Column('points_spent', sa.Float(), nullable=False, server_default='0'))
    
    # Create loyalty_transactions table
    op.create_table(
        'loyalty_transactions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('type', sa.Enum('earn', 'spend', 'admin_adjust', name='loyaltytransactiontype'), nullable=False),
        sa.Column('order_id', sa.Integer(), sa.ForeignKey('orders.id'), nullable=True),
        sa.Column('description', sa.String(255), nullable=True),
        sa.Column('admin_user', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    # Drop loyalty_transactions table
    op.drop_table('loyalty_transactions')
    op.execute("DROP TYPE IF EXISTS loyaltytransactiontype")
    
    # Remove points_spent from loyalty_accounts
    op.drop_column('loyalty_accounts', 'points_spent')
    
    # Remove indexes and columns from users
    op.drop_index('ix_users_legacy_client_id', 'users')
    op.drop_index('ix_users_telegram_id', 'users')
    op.drop_column('users', 'orders_sum')
    op.drop_column('users', 'orders_count')
    op.drop_column('users', 'first_order_date')
    op.drop_column('users', 'legacy_client_id')
    op.drop_column('users', 'telegram_id')


