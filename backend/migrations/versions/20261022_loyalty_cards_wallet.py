"""Loyalty cards (iikoCard track) and Apple Wallet device registrations

Revision ID: 0028_loyalty_cards_wallet
Revises: 0027_mod_option_weight
Create Date: 2026-10-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0028_loyalty_cards_wallet'
down_revision: Union[str, None] = '0027_mod_option_weight'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'loyalty_cards',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('serial_number', sa.String(64), nullable=False, unique=True),
        sa.Column('card_number', sa.String(32), nullable=False, unique=True),
        sa.Column('card_track', sa.String(64), nullable=False, unique=True),
        sa.Column('auth_token', sa.String(64), nullable=False),
        sa.Column('phone', sa.String(20), nullable=False, unique=True),
        sa.Column('iiko_customer_id', sa.String(64), nullable=True, unique=True),
        sa.Column('balance', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('balance_checked_at', sa.DateTime(), nullable=True),
        sa.Column('pd_consent_at', sa.DateTime(), nullable=False),
        sa.Column('ads_consent_at', sa.DateTime(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        'wallet_devices',
        sa.Column('device_library_id', sa.String(128), primary_key=True),
        sa.Column('push_token', sa.String(256), nullable=False),
        sa.Column('platform', sa.String(16), nullable=False, server_default='apple'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        'wallet_registrations',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column(
            'device_library_id',
            sa.String(128),
            sa.ForeignKey('wallet_devices.device_library_id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column('card_id', sa.Integer(), sa.ForeignKey('loyalty_cards.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('device_library_id', 'card_id', name='uq_wallet_reg_device_card'),
    )
    op.create_index('ix_wallet_registrations_device_library_id', 'wallet_registrations', ['device_library_id'])
    op.create_index('ix_wallet_registrations_card_id', 'wallet_registrations', ['card_id'])


def downgrade() -> None:
    op.drop_index('ix_wallet_registrations_card_id', table_name='wallet_registrations')
    op.drop_index('ix_wallet_registrations_device_library_id', table_name='wallet_registrations')
    op.drop_table('wallet_registrations')
    op.drop_table('wallet_devices')
    op.drop_table('loyalty_cards')
