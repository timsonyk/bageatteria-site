"""
Страховочный опрос балансов (на случай, если вебхук iikoCard не пришёл).

Запуск по расписанию, например раз в 15 минут:
    python -m scripts.refresh_balances --older-than-min 60 --limit 200
Лимит iikoCard на GetCustomerInfo — 40 запросов в секунду на API-логин
(https://ru.iiko.help/articles/#!api-documentations/ogranichenie-i-limity); 200 карт за проход — с большим запасом.
"""
import argparse
import logging
import sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.config import get_settings  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.services import loyalty_sync  # noqa: E402
from app.services.iiko_loyalty import client_from_settings  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--older-than-min", type=int, default=60)
    parser.add_argument("--limit", type=int, default=200)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    settings = get_settings()
    if not settings.wallet_enabled:
        logging.info("WALLET_ENABLED=false — пропускаю")
        return
    with SessionLocal() as db:
        cards = loyalty_sync.stale_cards(db, datetime.utcnow() - timedelta(minutes=args.older_than_min), args.limit)
        changed = loyalty_sync.sync_cards(db, cards, client_from_settings(settings), loyalty_sync.make_notifier(settings))
    logging.info("Проверено карт: %d, изменилось: %d", len(cards), changed)


if __name__ == "__main__":
    main()
