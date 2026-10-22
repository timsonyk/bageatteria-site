import json

import httpx
import pytest

from app.services.iiko_loyalty import IikoCredentials, IikoError, IikoLoyaltyClient, bonus_balance

ORG = "11111111-1111-1111-1111-111111111111"


def make_client(handler, **creds):
    creds = creds or {"api_key": "k", "app_id": "a", "client_secret": "s"}
    return IikoLoyaltyClient(
        credentials=IikoCredentials(**creds),
        organization_id=ORG,
        base_url="https://iiko.test",
        http=httpx.Client(transport=httpx.MockTransport(handler)),
    )


def test_v2_auth_then_create_customer_with_card():
    calls = []

    def handler(req: httpx.Request):
        body = json.loads(req.content)
        calls.append((req.url.path, body, req.headers.get("authorization")))
        if req.url.path == "/api/v2/access_token":
            return httpx.Response(200, json={"token": "T1"})
        return httpx.Response(200, json={"id": "cust-1"})

    client = make_client(handler)
    cid = client.create_or_update_customer(phone="+79990000000", card_track="TRACK1", card_number="100")
    assert cid == "cust-1"
    assert calls[0][0] == "/api/v2/access_token"
    assert calls[0][1] == {"apiKey": "k", "appId": "a", "clientSecret": "s"}
    path, body, auth = calls[1]
    assert path == "/api/1/loyalty/iiko/customer/create_or_update"
    assert auth == "Bearer T1"
    assert body["organizationId"] == ORG
    assert body["cardTrack"] == "TRACK1" and body["cardNumber"] == "100"
    assert body["shouldReceivePromoActionsInfo"] is False  # рассылки — только по отдельному согласию


def test_token_is_cached_and_v1_fallback():
    token_calls = 0

    def handler(req: httpx.Request):
        nonlocal token_calls
        if req.url.path == "/api/1/access_token":
            token_calls += 1
            assert json.loads(req.content) == {"apiLogin": "LOGIN"}
            return httpx.Response(200, json={"token": "T"})
        return httpx.Response(200, json={"id": "x", "walletBalances": []})

    client = make_client(handler, api_login="LOGIN")
    client.get_customer("x")
    client.get_customer("x")
    assert token_calls == 1


def test_not_found_by_phone_returns_none():
    def handler(req: httpx.Request):
        if req.url.path.endswith("access_token"):
            return httpx.Response(200, json={"token": "T"})
        return httpx.Response(400, json={"errorDescription": "Customer not found"})

    assert make_client(handler).find_customer_by_phone("+79990000000") is None


def test_server_error_raises():
    def handler(req: httpx.Request):
        if req.url.path.endswith("access_token"):
            return httpx.Response(200, json={"token": "T"})
        return httpx.Response(500, text="boom")

    with pytest.raises(IikoError):
        make_client(handler).get_customer("x")


def test_no_credentials():
    with pytest.raises(IikoError):
        IikoCredentials().token_request()


def test_bonus_balance_sums_only_bonus_wallets():
    info = {
        "walletBalances": [
            {"id": "1", "type": 1, "balance": 120.7},
            {"id": "2", "type": 0, "balance": 5000},  # депозит — не баллы
            {"id": "3", "type": 1, "balance": 30},
        ]
    }
    assert bonus_balance(info) == 150
    assert bonus_balance({}) == 0
