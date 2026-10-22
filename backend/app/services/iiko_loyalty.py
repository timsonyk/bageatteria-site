"""
Тонкий клиент iikoCloud API, раздел «Лояльность» (iikoCard).

Документация: https://api-ru.iiko.services/docs (OpenAPI внутри /api-docs/docs).
Баллы живут в iikoCard — касса iiko списывает/начисляет их сама; мы только
создаём гостя с картой (трек = то, что зашито в QR) и читаем баланс.

Авторизация:
- v2 (рекомендуется iiko): appId + clientSecret из https://public-api.iikoweb.ru/portal
  + apiKey из iikoWeb → «Интеграции» → «API-ключи». Токен живёт 1 час.
- v1 (устарело, но ещё работает): apiLogin из iikoWeb.
"""
import time
from dataclasses import dataclass, field

import httpx

DEFAULT_BASE_URL = "https://api-ru.iiko.services"
BONUS_WALLET_TYPE = 1  # GuestBalanceInfo.type: 1 — бонусная программа
TOKEN_TTL_SECONDS = 50 * 60  # токен живёт час, обновляем заранее


class IikoError(RuntimeError):
    pass


@dataclass
class IikoCredentials:
    api_key: str = ""
    app_id: str = ""
    client_secret: str = ""
    api_login: str = ""  # v1, если v2 ещё не выдали

    def token_request(self) -> tuple[str, dict]:
        if self.api_key and self.app_id and self.client_secret:
            return "/api/v2/access_token", {
                "apiKey": self.api_key,
                "appId": self.app_id,
                "clientSecret": self.client_secret,
            }
        if self.api_login:
            return "/api/1/access_token", {"apiLogin": self.api_login}
        raise IikoError("Не заданы ключи iikoCloud (IIKO_API_KEY+IIKO_APP_ID+IIKO_CLIENT_SECRET или IIKO_API_LOGIN)")


@dataclass
class IikoLoyaltyClient:
    credentials: IikoCredentials
    organization_id: str
    base_url: str = DEFAULT_BASE_URL
    http: httpx.Client = field(default_factory=lambda: httpx.Client(timeout=20.0))
    _token: str = ""
    _token_until: float = 0.0

    def _get_token(self) -> str:
        if self._token and time.monotonic() < self._token_until:
            return self._token
        path, body = self.credentials.token_request()
        resp = self.http.post(self.base_url + path, json=body)
        if resp.status_code != 200:
            raise IikoError(f"iiko auth {resp.status_code}: {resp.text[:200]}")
        self._token = resp.json()["token"]
        self._token_until = time.monotonic() + TOKEN_TTL_SECONDS
        return self._token

    def _post(self, path: str, body: dict) -> dict:
        body = {"organizationId": self.organization_id, **body}
        resp = self.http.post(
            self.base_url + path,
            json=body,
            headers={"Authorization": f"Bearer {self._get_token()}"},
        )
        if resp.status_code == 401:
            # Токен могли отозвать раньше срока — пробуем один раз с новым.
            self._token = ""
            resp = self.http.post(
                self.base_url + path,
                json=body,
                headers={"Authorization": f"Bearer {self._get_token()}"},
            )
        if resp.status_code != 200:
            raise IikoError(f"iiko {path} {resp.status_code}: {resp.text[:200]}")
        return resp.json()

    # --- гости ---

    def find_customer_by_phone(self, phone: str) -> dict | None:
        try:
            return self._post("/api/1/loyalty/iiko/customer/info", {"type": "phone", "phone": phone})
        except IikoError as e:
            # iiko отвечает 400, если гостя нет; отличаем по тексту ошибки нельзя надёжно,
            # поэтому «не найден» = любая 400 на поиске.
            if " 400:" in str(e):
                return None
            raise

    def get_customer(self, customer_id: str) -> dict:
        return self._post("/api/1/loyalty/iiko/customer/info", {"type": "id", "id": customer_id})

    def create_or_update_customer(
        self,
        *,
        phone: str,
        card_track: str | None = None,
        card_number: str | None = None,
        consent_given: bool = True,
        receive_promo: bool = False,
    ) -> str:
        body = {
            "phone": phone,
            "consentStatus": 1 if consent_given else 0,
            # Рассылки только по отдельному согласию (38-ФЗ), по умолчанию iiko ставит true.
            "shouldReceivePromoActionsInfo": receive_promo,
        }
        if card_track and card_number:
            body["cardTrack"] = card_track
            body["cardNumber"] = card_number
        return self._post("/api/1/loyalty/iiko/customer/create_or_update", body)["id"]

    def add_card(self, customer_id: str, card_track: str, card_number: str) -> None:
        self._post(
            "/api/1/loyalty/iiko/customer/card/add",
            {"customerId": customer_id, "cardTrack": card_track, "cardNumber": card_number},
        )

    def add_to_program(self, customer_id: str, program_id: str) -> None:
        self._post(
            "/api/1/loyalty/iiko/customer/program/add",
            {"customerId": customer_id, "programId": program_id},
        )


def bonus_balance(customer_info: dict) -> int:
    """Сумма бонусных кошельков гостя, округлённая вниз до целых баллов."""
    total = sum(
        w.get("balance") or 0
        for w in customer_info.get("walletBalances") or []
        if w.get("type") == BONUS_WALLET_TYPE
    )
    return int(total)
