"""Синхронизация баланса с iikoCard и вебхук iiko (SQLite в памяти, iiko подменён)."""
from datetime import datetime, timedelta

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_db
from app.api.routes import wallet
from app.core.config import get_settings
from app.core.rate_limit import limiter
from app.models.loyalty import LoyaltyCard, WalletDevice, WalletRegistration
from app.services import loyalty_sync
from app.services.iiko_loyalty import IikoCredentials, IikoLoyaltyClient


@pytest.fixture
def Session():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    LoyaltyCard.metadata.create_all(
        engine, tables=[LoyaltyCard.__table__, WalletDevice.__table__, WalletRegistration.__table__]
    )
    S = sessionmaker(bind=engine)
    with S() as db:
        for i, (phone, cust) in enumerate([("+79990000001", "cust-1"), ("+79990000002", "cust-2")], start=1):
            db.add(
                LoyaltyCard(
                    serial_number=f"s{i}",
                    card_number=f"10000{i}",
                    card_track=f"TRACK{i}",
                    auth_token="t" * 32,
                    phone=phone,
                    iiko_customer_id=cust,
                    balance=10,
                    pd_consent_at=datetime(2026, 10, 1),
                    updated_at=datetime(2026, 10, 1),
                )
            )
        db.add_all(
            [
                WalletDevice(device_library_id="iphone", push_token="apns-1", platform="apple"),
                WalletDevice(device_library_id="android", push_token="wp-1", platform="android"),
            ]
        )
        db.flush()
        db.add_all(
            [
                WalletRegistration(device_library_id="iphone", card_id=1),
                WalletRegistration(device_library_id="android", card_id=1),
                WalletRegistration(device_library_id="iphone", card_id=2),
            ]
        )
        db.commit()
    return S


def iiko_client(balances: dict[str, float]) -> IikoLoyaltyClient:
    def handler(req: httpx.Request):
        if req.url.path.endswith("access_token"):
            return httpx.Response(200, json={"token": "T"})
        import json

        cid = json.loads(req.content)["id"]
        return httpx.Response(200, json={"id": cid, "walletBalances": [{"type": 1, "balance": balances[cid]}]})

    return IikoLoyaltyClient(
        credentials=IikoCredentials(api_login="L"),
        organization_id="org",
        base_url="https://iiko.test",
        http=httpx.Client(transport=httpx.MockTransport(handler)),
    )


def test_extract_identifiers_any_depth():
    payload = {
        "event": "balance",
        "data": {"Guest": {"CustomerId": "cust-1", "Phone": "8 (999) 000-00-02"}, "cards": [{"Number": "100001"}]},
    }
    ids = loyalty_sync.extract_identifiers(payload)
    assert ids == {"id": {"cust-1"}, "phone": {"+79990000002"}, "card": {"100001"}}
    assert loyalty_sync.extract_identifiers("not a dict") == {"id": set(), "phone": set(), "card": set()}


@pytest.mark.parametrize(
    "raw,expected",
    [("+7 999 000-00-01", "+79990000001"), ("89990000001", "+79990000001"), ("9990000001", "+79990000001"), ("123", "")],
)
def test_normalize_phone(raw, expected):
    assert loyalty_sync.normalize_phone(raw) == expected


def test_sync_updates_only_changed_and_pushes_by_platform(Session):
    sent = []
    with Session() as db:
        cards = db.query(LoyaltyCard).order_by(LoyaltyCard.id).all()
        changed = loyalty_sync.sync_cards(db, cards, iiko_client({"cust-1": 150.9, "cust-2": 10}), sent.append)
        assert changed == 1
        c1, c2 = db.query(LoyaltyCard).order_by(LoyaltyCard.id).all()
        assert c1.balance == 150 and c1.updated_at > datetime(2026, 10, 1)
        assert c2.balance == 10 and c2.updated_at == datetime(2026, 10, 1)
        assert c1.balance_checked_at and c2.balance_checked_at
    assert len(sent) == 1
    assert sorted(sent[0]["apple"]) == ["apns-1"] and sent[0]["android"] == ["wp-1"]


def test_sync_survives_iiko_error(Session):
    def handler(req):
        if req.url.path.endswith("access_token"):
            return httpx.Response(200, json={"token": "T"})
        return httpx.Response(500, text="down")

    client = IikoLoyaltyClient(
        credentials=IikoCredentials(api_login="L"),
        organization_id="org",
        base_url="https://iiko.test",
        http=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    with Session() as db:
        assert loyalty_sync.sync_cards(db, db.query(LoyaltyCard).all(), client, lambda t: None) == 0


def test_stale_cards_order_and_filter(Session):
    with Session() as db:
        c1, c2 = db.query(LoyaltyCard).order_by(LoyaltyCard.id).all()
        c1.balance_checked_at = datetime.utcnow()
        c2.balance_checked_at = datetime.utcnow() - timedelta(hours=3)
        db.commit()
        stale = loyalty_sync.stale_cards(db, datetime.utcnow() - timedelta(hours=1), 10)
        assert [c.serial_number for c in stale] == ["s2"]


def test_iiko_hook_endpoint(Session, monkeypatch, fake_apple_certs):
    for k, v in {
        "WALLET_ENABLED": "true",
        "APPLE_PASS_TYPE_ID": "pass.test",
        "APPLE_PASS_CERT_PATH": fake_apple_certs["cert"],
        "IIKO_WEBHOOK_SECRET": "hook-secret",
    }.items():
        monkeypatch.setenv(k, v)
    get_settings.cache_clear()
    scheduled = []
    monkeypatch.setattr(wallet, "_sync_in_background", lambda ids: scheduled.append(ids))

    def _db():
        with Session() as s:
            yield s

    app = FastAPI()
    app.state.limiter = limiter
    app.include_router(wallet.router)
    app.dependency_overrides[get_db] = _db
    c = TestClient(app)

    assert c.post("/wallet/iiko-hook", json={"customerId": "cust-1"}).status_code == 401
    assert c.post("/wallet/iiko-hook?token=wrong", json={"customerId": "cust-1"}).status_code == 401
    r = c.post("/wallet/iiko-hook?token=hook-secret", json={"customerId": "cust-1"})
    assert r.status_code == 200 and r.json()["cards"] == 1
    r = c.post("/wallet/iiko-hook", json={"phone": "+79990000002"}, headers={"Authorization": "Bearer hook-secret"})
    assert r.json()["cards"] == 1
    r = c.post("/wallet/iiko-hook?token=hook-secret", content=b"not json", headers={"Content-Type": "text/plain"})
    assert r.status_code == 200 and r.json()["cards"] == 0
    assert scheduled == [[1], [2]]
    get_settings.cache_clear()
