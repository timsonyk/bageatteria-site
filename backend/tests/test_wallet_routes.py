"""Протокол веб-сервиса Apple Wallet на SQLite в памяти (Postgres не нужен)."""
import io
import zipfile
from datetime import datetime, timedelta

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

PTID = "pass.test.bageatteria"
SERIAL = "serial-1"
TOKEN = "t" * 32
AUTH = {"Authorization": f"ApplePass {TOKEN}"}
DEV = "device-abc"


@pytest.fixture
def client(fake_apple_certs, monkeypatch):
    for k, v in {
        "WALLET_ENABLED": "true",
        "APPLE_PASS_TYPE_ID": PTID,
        "APPLE_TEAM_ID": "TEAM123456",
        "APPLE_PASS_CERT_PATH": fake_apple_certs["cert"],
        "APPLE_PASS_KEY_PATH": fake_apple_certs["key"],
        "APPLE_WWDR_CERT_PATH": fake_apple_certs["wwdr"],
        "WALLET_WEB_SERVICE_URL": "https://api.example.test/wallet",
    }.items():
        monkeypatch.setenv(k, v)
    get_settings.cache_clear()

    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    tables = [LoyaltyCard.__table__, WalletDevice.__table__, WalletRegistration.__table__]
    LoyaltyCard.metadata.create_all(engine, tables=tables)
    Session = sessionmaker(bind=engine)
    with Session() as db:
        db.add(
            LoyaltyCard(
                serial_number=SERIAL,
                card_number="100200300",
                card_track="TRACK-XYZ",
                auth_token=TOKEN,
                phone="+79990000000",
                balance=42,
                pd_consent_at=datetime.utcnow(),
                updated_at=datetime(2026, 10, 1, 12, 0, 0),
            )
        )
        db.commit()

    def _db():
        with Session() as s:
            yield s

    app = FastAPI()
    app.state.limiter = limiter
    app.include_router(wallet.router)
    app.dependency_overrides[get_db] = _db
    yield TestClient(app), Session
    get_settings.cache_clear()


def test_disabled_wallet_returns_503(monkeypatch):
    monkeypatch.setenv("WALLET_ENABLED", "false")
    get_settings.cache_clear()
    app = FastAPI()
    app.include_router(wallet.router)
    r = TestClient(app).get(f"/wallet/v1/devices/{DEV}/registrations/{PTID}")
    assert r.status_code == 503
    get_settings.cache_clear()


def test_full_wallet_cycle(client):
    c, Session = client
    url = f"/wallet/v1/devices/{DEV}/registrations/{PTID}/{SERIAL}"

    assert c.post(url, json={"pushToken": "push1"}).status_code == 401
    assert c.post(url, json={"pushToken": "push1"}, headers={"Authorization": "ApplePass wrong"}).status_code == 401
    assert c.post(url, json={"pushToken": "push1"}, headers=AUTH).status_code == 201
    assert c.post(url, json={"pushToken": "push2"}, headers=AUTH).status_code == 200
    with Session() as db:
        assert db.get(WalletDevice, DEV).push_token == "push2"

    r = c.get(f"/wallet/v1/devices/{DEV}/registrations/{PTID}")
    assert r.status_code == 200
    body = r.json()
    assert body["serialNumbers"] == [SERIAL]
    tag = body["lastUpdated"]

    # Ничего не менялось с прошлого раза — 204.
    assert c.get(f"/wallet/v1/devices/{DEV}/registrations/{PTID}", params={"passesUpdatedSince": tag}).status_code == 204

    # Баланс изменился — карта снова в списке.
    with Session() as db:
        card = db.query(LoyaltyCard).one()
        card.balance = 100
        card.updated_at = card.updated_at + timedelta(minutes=5)
        db.commit()
    r = c.get(f"/wallet/v1/devices/{DEV}/registrations/{PTID}", params={"passesUpdatedSince": tag})
    assert r.json()["serialNumbers"] == [SERIAL]

    r = c.get(f"/wallet/v1/passes/{PTID}/{SERIAL}", headers=AUTH)
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/vnd.apple.pkpass"
    assert '"value": 100' in zipfile.ZipFile(io.BytesIO(r.content)).read("pass.json").decode()

    r2 = c.get(f"/wallet/v1/passes/{PTID}/{SERIAL}", headers={**AUTH, "If-Modified-Since": r.headers["last-modified"]})
    assert r2.status_code == 304

    assert c.get(f"/wallet/v1/passes/other.type/{SERIAL}", headers=AUTH).status_code == 404

    assert c.delete(url, headers=AUTH).status_code == 200
    with Session() as db:
        assert db.query(WalletRegistration).count() == 0
        assert db.get(WalletDevice, DEV) is None
    assert c.get(f"/wallet/v1/devices/{DEV}/registrations/{PTID}").status_code == 204


def test_android_walletpasses_registration(client):
    c, Session = client
    url = f"/wallet/v1/devices/android-dev/registrations/{PTID}/{SERIAL}"
    r = c.post(url, json={"pushToken": "wp-token"}, headers={"Authorization": f"AndroidPass {TOKEN}"})
    assert r.status_code == 201
    with Session() as db:
        assert db.get(WalletDevice, "android-dev").platform == "android"
    r = c.get(f"/wallet/v1/passes/{PTID}/{SERIAL}", headers={"Authorization": f"AndroidPass {TOKEN}"})
    assert r.status_code == 200


def test_download_and_log(client):
    c, _ = client
    assert c.get(f"/wallet/download/{SERIAL}", params={"token": "bad"}).status_code == 401
    r = c.get(f"/wallet/download/{SERIAL}", params={"token": TOKEN})
    assert r.status_code == 200 and r.content[:2] == b"PK"
    assert c.post("/wallet/v1/log", json={"logs": ["something"]}).status_code == 200
