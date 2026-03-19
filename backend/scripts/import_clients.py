"""
Import customers from CSV file.

Expected CSV format (Russian column names):
"ID","Имя клиента","Телефон","Дата первого заказа","Сумма заказов","Всего заказов","RFM","Score","R - давность","F - частота","M - средний чек","Баллов","Потрачено баллов"

Usage:
    python -m scripts.import_clients --csv clients.csv --dry-run
    python -m scripts.import_clients --csv clients.csv
"""
import argparse
import csv
import logging
import re
import sys
from datetime import datetime
from decimal import Decimal
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import get_settings
from app.models.user import User
from app.models.loyalty import LoyaltyAccount

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('import_errors.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


def normalize_phone(phone: str) -> str:
    """
    Normalize phone number to +7XXXXXXXXXX format.
    
    Args:
        phone: Raw phone number
        
    Returns:
        Normalized phone number
        
    Raises:
        ValueError: If phone is invalid
    """
    # Remove all non-digit characters
    digits = re.sub(r'\D', '', phone)
    
    # Handle different formats
    if digits.startswith('8') and len(digits) == 11:
        digits = '7' + digits[1:]
    elif digits.startswith('7') and len(digits) == 11:
        pass
    elif len(digits) == 10:
        digits = '7' + digits
    else:
        raise ValueError(f"Invalid phone format: {phone}")
    
    if len(digits) != 11:
        raise ValueError(f"Invalid phone length: {phone}")
    
    return '+' + digits


def parse_date(date_str: str) -> datetime.date:
    """
    Parse date string in various formats.

    Handles dates with time: DD.MM.YYYY, HH:MM
    """
    if not date_str or date_str.strip() == '':
        return None

    date_str = date_str.strip()

    # Remove time part if present (e.g., "11.02.2025, 20:44" -> "11.02.2025")
    if ',' in date_str:
        date_str = date_str.split(',')[0].strip()

    # Try different formats
    formats = [
        '%Y-%m-%d',
        '%d.%m.%Y',
        '%d/%m/%Y',
        '%Y/%m/%d',
        '%d-%m-%Y',
    ]

    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt).date()
        except ValueError:
            continue

    raise ValueError(f"Unable to parse date: {date_str}")


def import_clients(csv_path: str, dry_run: bool = False):
    """
    Import clients from CSV file.
    
    Expected CSV columns:
    - phone: Phone number
    - client_id: Legacy client ID from old system
    - first_order_date: Date of first order (optional)
    - orders_sum: Total sum of orders
    - orders_count: Number of orders
    - points_total: Total points earned
    - points_spent: Points spent
    
    Args:
        csv_path: Path to CSV file
        dry_run: If True, don't actually import, just validate
    """
    settings = get_settings()
    engine = create_engine(settings.database_url)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    
    stats = {
        'total_rows': 0,
        'successful': 0,
        'updated': 0,
        'created': 0,
        'errors': 0,
        'duplicates': 0,
    }
    
    logger.info(f"Starting import from {csv_path} (dry_run={dry_run})")
    
    try:
        # Detect encoding
        encodings = ['utf-8', 'utf-8-sig', 'cp1251', 'windows-1251']
        content = None
        used_encoding = None
        
        for encoding in encodings:
            try:
                with open(csv_path, 'r', encoding=encoding) as f:
                    content = f.read()
                    used_encoding = encoding
                    break
            except UnicodeDecodeError:
                continue
        
        if content is None:
            raise ValueError("Unable to detect CSV encoding")
        
        logger.info(f"Using encoding: {used_encoding}")
        
        # Parse CSV
        lines = content.splitlines()
        reader = csv.DictReader(lines)

        # Validate required columns (using Russian column names)
        required_cols_map = {
            'ID': 'client_id',
            'Телефон': 'phone',
            'Сумма заказов': 'orders_sum',
            'Всего заказов': 'orders_count',
            'Баллов': 'points_total',
            'Потрачено баллов': 'points_spent'
        }

        # Check if all required columns exist
        missing_cols = []
        for csv_col, db_col in required_cols_map.items():
            if csv_col not in reader.fieldnames:
                missing_cols.append(csv_col)

        if missing_cols:
            raise ValueError(f"CSV missing required columns: {missing_cols}. Found: {reader.fieldnames}")

        logger.info(f"CSV columns: {reader.fieldnames}")

        # Track phone duplicates in CSV
        phone_records = {}

        # First pass: collect all records and handle duplicates
        for row in reader:
            stats['total_rows'] += 1
            
            try:
                # Skip rows with empty phones
                phone_raw = row.get('Телефон', '').strip()
                if not phone_raw:
                    stats['errors'] += 1
                    logger.warning(f"Skipping row {stats['total_rows']}: empty phone")
                    continue

                # Normalize phone (using Russian column name)
                phone = normalize_phone(phone_raw)

                # Parse data (using Russian column names)
                record = {
                    'phone': phone,
                    'legacy_client_id': row['ID'].strip() if row.get('ID') else None,
                    'name': row.get('Имя клиента', '').strip() if row.get('Имя клиента') else None,
                    'first_order_date': parse_date(row.get('Дата первого заказа', '')),
                    'orders_sum': Decimal(row['Сумма заказов']) if row.get('Сумма заказов') and row['Сумма заказов'].strip() else Decimal('0'),
                    'orders_count': int(row['Всего заказов']) if row.get('Всего заказов') and row['Всего заказов'].strip() else 0,
                    'points_total': float(row['Баллов']) if row.get('Баллов') and row['Баллов'].strip() else 0.0,
                    'points_spent': float(row['Потрачено баллов']) if row.get('Потрачено баллов') and row['Потрачено баллов'].strip() else 0.0,
                }
                
                # Handle duplicates in CSV: keep record with higher orders_sum
                if phone in phone_records:
                    stats['duplicates'] += 1
                    logger.warning(f"Duplicate phone in CSV: {phone}. Comparing orders_sum...")
                    if record['orders_sum'] > phone_records[phone]['orders_sum']:
                        logger.info(f"Replacing with record with higher orders_sum: {record['orders_sum']} > {phone_records[phone]['orders_sum']}")
                        phone_records[phone] = record
                else:
                    phone_records[phone] = record
                    
            except Exception as e:
                stats['errors'] += 1
                logger.error(f"Error processing row {stats['total_rows']}: {row}. Error: {e}")
        
        logger.info(f"Processed {stats['total_rows']} rows, found {len(phone_records)} unique phones, {stats['duplicates']} duplicates")
        
        if dry_run:
            logger.info("DRY RUN: No changes will be made to database")
            db.close()
            return stats
        
        # Second pass: import to database
        for phone, record in phone_records.items():
            try:
                # Check if user exists
                user = db.query(User).filter(User.phone == phone).first()
                
                if user:
                    # Update existing user
                    stats['updated'] += 1
                    logger.info(f"Updating existing user: {phone}")

                    user.legacy_client_id = record['legacy_client_id']
                    user.name = record['name'] if record['name'] else user.name  # Don't overwrite existing name
                    user.first_order_date = record['first_order_date']
                    user.orders_sum = record['orders_sum']
                    user.orders_count = record['orders_count']
                else:
                    # Create new user
                    stats['created'] += 1
                    logger.info(f"Creating new user: {phone}")

                    user = User(
                        phone=phone,
                        legacy_client_id=record['legacy_client_id'],
                        name=record['name'],
                        first_order_date=record['first_order_date'],
                        orders_sum=record['orders_sum'],
                        orders_count=record['orders_count'],
                    )
                    db.add(user)
                    db.flush()  # Get user.id
                
                # Create or update loyalty account
                loyalty = db.query(LoyaltyAccount).filter(LoyaltyAccount.user_id == user.id).first()
                
                points_available = record['points_total'] - record['points_spent']
                
                if loyalty:
                    logger.info(f"Updating loyalty account for user {user.id}")
                    loyalty.balance = points_available
                    loyalty.points_spent = record['points_spent']
                else:
                    logger.info(f"Creating loyalty account for user {user.id}")
                    loyalty = LoyaltyAccount(
                        user_id=user.id,
                        balance=points_available,
                        points_spent=record['points_spent'],
                        cashback_percent=5.0,
                    )
                    db.add(loyalty)
                
                stats['successful'] += 1
                
                # Commit in batches of 100
                if stats['successful'] % 100 == 0:
                    db.commit()
                    logger.info(f"Progress: {stats['successful']}/{len(phone_records)} records imported")
                    
            except Exception as e:
                stats['errors'] += 1
                logger.error(f"Error importing record for phone {phone}: {e}")
                db.rollback()
        
        # Final commit
        db.commit()
        logger.info("Import completed successfully")
        
    except Exception as e:
        logger.error(f"Fatal error during import: {e}")
        db.rollback()
        raise
    finally:
        db.close()
    
    # Print summary
    logger.info("\n" + "="*60)
    logger.info("IMPORT SUMMARY")
    logger.info("="*60)
    logger.info(f"Total rows in CSV:       {stats['total_rows']}")
    logger.info(f"Unique phones:           {len(phone_records) if 'phone_records' in locals() else 0}")
    logger.info(f"Duplicates in CSV:       {stats['duplicates']}")
    logger.info(f"Successfully imported:   {stats['successful']}")
    logger.info(f"  - Created:             {stats['created']}")
    logger.info(f"  - Updated:             {stats['updated']}")
    logger.info(f"Errors:                  {stats['errors']}")
    logger.info("="*60)
    
    if stats['errors'] > 0:
        logger.warning(f"Check import_errors.log for details")
    
    return stats


def main():
    parser = argparse.ArgumentParser(description='Import customers from CSV file')
    parser.add_argument('--csv', required=True, help='Path to CSV file')
    parser.add_argument('--dry-run', action='store_true', help='Validate CSV without importing')
    
    args = parser.parse_args()
    
    if not Path(args.csv).exists():
        logger.error(f"File not found: {args.csv}")
        sys.exit(1)
    
    try:
        stats = import_clients(args.csv, dry_run=args.dry_run)
        
        if stats['errors'] > 0:
            sys.exit(1)
        else:
            sys.exit(0)
            
    except Exception as e:
        logger.error(f"Import failed: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()

