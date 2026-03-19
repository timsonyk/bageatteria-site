"""Stock management system

Revision ID: 0011_stock_management
Revises: 0010_store_location_name
Create Date: 2026-02-12

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0011_stock_management'
down_revision = '0010_store_location_name'
branch_labels = None
depends_on = None


def upgrade():
    # Stock categories (Кондитерка, Хлебобулочные, Кофе, etc.)
    op.create_table(
        'stock_categories',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('unit', sa.String(20), server_default='pieces', nullable=False),
        sa.Column('tolerance', sa.Float(), server_default='0', nullable=False),
        sa.Column('tolerance_is_percent', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('sort_order', sa.Integer(), server_default='0', nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    # Stock items (individual products tracked for stock)
    op.create_table(
        'stock_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=True),
        sa.Column('stock_category_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('iiko_sku', sa.String(100), nullable=True),
        sa.Column('unit', sa.String(20), nullable=True),
        sa.Column('tolerance', sa.Float(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('sort_order', sa.Integer(), server_default='0', nullable=False),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['stock_category_id'], ['stock_categories.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_stock_items_product_id', 'stock_items', ['product_id'])
    op.create_index('ix_stock_items_stock_category_id', 'stock_items', ['stock_category_id'])
    op.create_index('ix_stock_items_iiko_sku', 'stock_items', ['iiko_sku'])

    # Current stock levels per item per location
    op.create_table(
        'current_stocks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('stock_item_id', sa.Integer(), nullable=False),
        sa.Column('store_location_id', sa.Integer(), nullable=False),
        sa.Column('quantity', sa.Float(), server_default='0', nullable=False),
        sa.Column('last_updated', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['stock_item_id'], ['stock_items.id']),
        sa.ForeignKeyConstraint(['store_location_id'], ['store_locations.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('stock_item_id', 'store_location_id', name='uq_current_stock_item_location'),
    )
    op.create_index('ix_current_stocks_stock_item_id', 'current_stocks', ['stock_item_id'])
    op.create_index('ix_current_stocks_store_location_id', 'current_stocks', ['store_location_id'])

    # Deliveries (Приёмки)
    op.create_table(
        'deliveries',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('store_location_id', sa.Integer(), nullable=False),
        sa.Column('delivery_number', sa.String(50), nullable=True),
        sa.Column('supplier_name', sa.String(255), nullable=True),
        sa.Column('expected_date', sa.DateTime(), nullable=True),
        sa.Column('actual_date', sa.DateTime(), nullable=True),
        sa.Column('status', sa.String(20), server_default='pending', nullable=False),
        sa.Column('received_by_telegram_id', sa.BigInteger(), nullable=True),
        sa.Column('received_by_name', sa.String(255), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('iiko_document_id', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['store_location_id'], ['store_locations.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_deliveries_store_location_id', 'deliveries', ['store_location_id'])
    op.create_index('ix_deliveries_delivery_number', 'deliveries', ['delivery_number'])
    op.create_index('ix_deliveries_status', 'deliveries', ['status'])
    op.create_index('ix_deliveries_iiko_document_id', 'deliveries', ['iiko_document_id'])

    # Delivery lines (items in delivery)
    op.create_table(
        'delivery_lines',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('delivery_id', sa.Integer(), nullable=False),
        sa.Column('stock_item_id', sa.Integer(), nullable=False),
        sa.Column('expected_quantity', sa.Float(), nullable=False),
        sa.Column('actual_quantity', sa.Float(), nullable=True),
        sa.Column('discrepancy_reason', sa.String(50), nullable=True),
        sa.Column('discrepancy_notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['delivery_id'], ['deliveries.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['stock_item_id'], ['stock_items.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_delivery_lines_delivery_id', 'delivery_lines', ['delivery_id'])
    op.create_index('ix_delivery_lines_stock_item_id', 'delivery_lines', ['stock_item_id'])

    # Delivery photos
    op.create_table(
        'delivery_photos',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('delivery_id', sa.Integer(), nullable=False),
        sa.Column('photo_url', sa.String(500), nullable=False),
        sa.Column('thumbnail_url', sa.String(500), nullable=True),
        sa.Column('uploaded_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['delivery_id'], ['deliveries.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_delivery_photos_delivery_id', 'delivery_photos', ['delivery_id'])

    # Inventories (Инвентаризации)
    op.create_table(
        'inventories',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('store_location_id', sa.Integer(), nullable=False),
        sa.Column('date', sa.DateTime(), nullable=False),
        sa.Column('status', sa.String(20), server_default='draft', nullable=False),
        sa.Column('conducted_by_telegram_id', sa.BigInteger(), nullable=True),
        sa.Column('conducted_by_name', sa.String(255), nullable=True),
        sa.Column('reviewed_by_admin_id', sa.Integer(), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('review_notes', sa.Text(), nullable=True),
        sa.Column('has_discrepancies', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('discrepancies_within_tolerance', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['store_location_id'], ['store_locations.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_inventories_store_location_id', 'inventories', ['store_location_id'])
    op.create_index('ix_inventories_status', 'inventories', ['status'])

    # Inventory lines
    op.create_table(
        'inventory_lines',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('inventory_id', sa.Integer(), nullable=False),
        sa.Column('stock_item_id', sa.Integer(), nullable=False),
        sa.Column('expected_quantity', sa.Float(), nullable=False),
        sa.Column('actual_quantity', sa.Float(), nullable=True),
        sa.Column('discrepancy', sa.Float(), nullable=True),
        sa.Column('tolerance', sa.Float(), nullable=False),
        sa.Column('within_tolerance', sa.Boolean(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['inventory_id'], ['inventories.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['stock_item_id'], ['stock_items.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_inventory_lines_inventory_id', 'inventory_lines', ['inventory_id'])
    op.create_index('ix_inventory_lines_stock_item_id', 'inventory_lines', ['stock_item_id'])

    # Stock movements (audit log)
    op.create_table(
        'stock_movements',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('stock_item_id', sa.Integer(), nullable=False),
        sa.Column('store_location_id', sa.Integer(), nullable=False),
        sa.Column('movement_type', sa.String(50), nullable=False),
        sa.Column('quantity', sa.Float(), nullable=False),
        sa.Column('quantity_before', sa.Float(), nullable=False),
        sa.Column('quantity_after', sa.Float(), nullable=False),
        sa.Column('reference_type', sa.String(50), nullable=True),
        sa.Column('reference_id', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('performed_by', sa.String(255), nullable=True),
        sa.Column('iiko_transaction_id', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['stock_item_id'], ['stock_items.id']),
        sa.ForeignKeyConstraint(['store_location_id'], ['store_locations.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_stock_movements_stock_item_id', 'stock_movements', ['stock_item_id'])
    op.create_index('ix_stock_movements_store_location_id', 'stock_movements', ['store_location_id'])
    op.create_index('ix_stock_movements_movement_type', 'stock_movements', ['movement_type'])


def downgrade():
    op.drop_table('stock_movements')
    op.drop_table('inventory_lines')
    op.drop_table('inventories')
    op.drop_table('delivery_photos')
    op.drop_table('delivery_lines')
    op.drop_table('deliveries')
    op.drop_table('current_stocks')
    op.drop_table('stock_items')
    op.drop_table('stock_categories')
