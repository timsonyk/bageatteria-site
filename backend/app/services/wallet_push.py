"""
Push «карта обновилась».

iPhone: пустой JSON {} через APNs, topic = Pass Type ID, клиентский сертификат —
тот же, которым подписана карта. Работает только в боевом APNs.
https://developer.apple.com/documentation/walletpasses/adding-a-web-service-to-update-passes

Android (приложение WalletPasses): POST на их сервер со списком push-токенов.
https://walletpasses.io/developer/
"""
import logging
import ssl

import httpx

logger = logging.getLogger(__name__)

APNS_HOST = "https://api.push.apple.com"
WALLETPASSES_PUSH_URL = "https://walletpasses.appspot.com/api/v1/push"
WALLETPASSES_BATCH = 300  # без ключа сервис принимает до 300 токенов за запрос


def make_apns_client(cert_path: str, key_path: str, key_password: str = "") -> httpx.Client:
    ctx = ssl.create_default_context()
    ctx.load_cert_chain(cert_path, key_path, password=key_password or None)
    return httpx.Client(http2=True, verify=ctx, timeout=10.0)


def send_pass_updates(client: httpx.Client, pass_type_id: str, push_tokens: list[str]) -> list[str]:
    """Шлёт push на каждый iPhone. Возвращает токены, которые APNs признал недействительными."""
    dead: list[str] = []
    for token in push_tokens:
        resp = client.post(
            f"{APNS_HOST}/3/device/{token}",
            content=b"{}",
            headers={"apns-topic": pass_type_id, "apns-push-type": "background", "apns-priority": "5"},
        )
        if resp.status_code == 410 or (resp.status_code == 400 and "BadDeviceToken" in resp.text):
            dead.append(token)
        elif resp.status_code != 200:
            logger.warning("APNs %s: %s", resp.status_code, resp.text[:200])
    return dead


def send_android_updates(client: httpx.Client, pass_type_id: str, push_tokens: list[str], api_key: str = "") -> None:
    """Push для карт в приложении WalletPasses (Android)."""
    headers = {"Authorization": api_key} if api_key else {}
    for i in range(0, len(push_tokens), WALLETPASSES_BATCH):
        resp = client.post(
            WALLETPASSES_PUSH_URL,
            json={"passTypeIdentifier": pass_type_id, "pushTokens": push_tokens[i : i + WALLETPASSES_BATCH]},
            headers=headers,
        )
        if resp.status_code != 200:
            logger.warning("WalletPasses push %s: %s", resp.status_code, resp.text[:200])
