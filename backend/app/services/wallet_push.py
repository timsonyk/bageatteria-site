"""
Push «карта обновилась» через APNs.

Пустой JSON {} на push-токен устройства, topic = Pass Type ID, клиентский сертификат —
тот же, которым подписана карта. Работает только в боевом APNs.
https://developer.apple.com/documentation/walletpasses/adding-a-web-service-to-update-passes
"""
import logging
import ssl

import httpx

logger = logging.getLogger(__name__)

APNS_HOST = "https://api.push.apple.com"


def make_apns_client(cert_path: str, key_path: str, key_password: str = "") -> httpx.Client:
    ctx = ssl.create_default_context()
    ctx.load_cert_chain(cert_path, key_path, password=key_password or None)
    return httpx.Client(http2=True, verify=ctx, timeout=10.0)


def send_pass_updates(client: httpx.Client, pass_type_id: str, push_tokens: list[str]) -> list[str]:
    """Шлёт push на каждое устройство. Возвращает токены, которые APNs признал недействительными."""
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
