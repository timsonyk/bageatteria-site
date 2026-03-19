"""Add name field to store_locations for Bageatteria pickup points

Revision ID: 0010_store_location_name
Revises: 0009_guest_profile
Create Date: 2026-02-02
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0010_store_location_name'
down_revision = '0009_guest_profile'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add name column for pickup point name (Депо, Смоленская)
    op.add_column('store_locations', sa.Column('name', sa.String(100), nullable=False, server_default=''))

    # Set names for existing locations (if any)
    connection = op.get_bind()
    # Update based on address if needed
    connection.execute(sa.text("""
        UPDATE store_locations
        SET name = CASE
            WHEN address_text ILIKE '%депо%' THEN 'Депо'
            WHEN address_text ILIKE '%смоленск%' THEN 'Смоленская'
            ELSE 'Кофейня'
        END
        WHERE name = ''
    """))


def downgrade() -> None:
    op.drop_column('store_locations', 'name')
