"""
Сборка карты лояльности для Apple Wallet (.pkpass).

.pkpass — это zip-архив: pass.json + картинки + manifest.json (SHA1 каждого файла)
+ signature (PKCS#7 detached подпись manifest.json сертификатом Pass Type ID).
Формат: https://developer.apple.com/documentation/walletpasses/building-a-pass

В карту НЕ кладём ФИО и телефон гостя (152-ФЗ): только номер карты и баланс.
"""
import hashlib
import io
import json
import zipfile
from dataclasses import dataclass
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.serialization import pkcs7

ASSETS_DIR = Path(__file__).resolve().parent.parent / "wallet_assets"

PKPASS_MIME = "application/vnd.apple.pkpass"


@dataclass(frozen=True)
class PassSigner:
    """Сертификат Pass Type ID + ключ + промежуточный сертификат Apple WWDR (всё в PEM)."""

    cert_pem: bytes
    key_pem: bytes
    wwdr_pem: bytes
    key_password: bytes | None = None

    @classmethod
    def from_files(cls, cert_path: str, key_path: str, wwdr_path: str, key_password: str = "") -> "PassSigner":
        return cls(
            cert_pem=Path(cert_path).read_bytes(),
            key_pem=Path(key_path).read_bytes(),
            wwdr_pem=Path(wwdr_path).read_bytes(),
            key_password=key_password.encode() if key_password else None,
        )

    def sign(self, data: bytes) -> bytes:
        cert = x509.load_pem_x509_certificate(self.cert_pem)
        key = serialization.load_pem_private_key(self.key_pem, password=self.key_password)
        wwdr = x509.load_pem_x509_certificate(self.wwdr_pem)
        return (
            pkcs7.PKCS7SignatureBuilder()
            .set_data(data)
            .add_signer(cert, key, hashes.SHA256())
            .add_certificate(wwdr)
            .sign(serialization.Encoding.DER, [pkcs7.PKCS7Options.DetachedSignature, pkcs7.PKCS7Options.Binary])
        )


@dataclass(frozen=True)
class LoyaltyCard:
    serial_number: str        # наш внутренний id карты (не телефон!)
    card_number: str          # короткий номер для кассира, печатается под QR
    barcode_message: str      # что зашито в QR = трек карты в iikoCard
    balance: int              # баллы
    auth_token: str           # секрет для веб-сервиса обновлений, >= 16 символов


def build_pass_json(
    card: LoyaltyCard,
    *,
    pass_type_id: str,
    team_id: str,
    web_service_url: str | None,
    organization_name: str = "Bageatteria",
) -> dict:
    data = {
        "formatVersion": 1,
        "passTypeIdentifier": pass_type_id,
        "teamIdentifier": team_id,
        "serialNumber": card.serial_number,
        "organizationName": organization_name,
        "description": "Карта гостя Bageatteria",
        "logoText": "Bageatteria",
        "foregroundColor": "rgb(255, 255, 255)",
        "backgroundColor": "rgb(60, 40, 30)",
        "labelColor": "rgb(230, 210, 180)",
        "sharingProhibited": True,
        "storeCard": {
            "primaryFields": [
                {
                    "key": "balance",
                    "label": "Баллы",
                    "value": card.balance,
                    # Текст уведомления на экране блокировки при изменении баланса.
                    "changeMessage": "Баланс: %@ баллов",
                }
            ],
            "secondaryFields": [{"key": "number", "label": "Карта", "value": card.card_number}],
            "backFields": [
                {
                    "key": "help",
                    "label": "Как пользоваться",
                    "value": "Покажите QR-код на кассе в любой Bageatteria — баллы начислятся и спишутся автоматически.",
                },
                {"key": "site", "label": "Сайт", "value": "https://bageatteria.com"},
            ],
        },
        "barcodes": [
            {
                "format": "PKBarcodeFormatQR",
                "message": card.barcode_message,
                "messageEncoding": "iso-8859-1",
                "altText": card.card_number,
            }
        ],
    }
    if web_service_url:
        data["webServiceURL"] = web_service_url
        data["authenticationToken"] = card.auth_token
    return data


def _asset_files() -> dict[str, bytes]:
    return {p.name: p.read_bytes() for p in sorted(ASSETS_DIR.glob("*.png"))}


def build_pkpass(pass_json: dict, signer: PassSigner, assets: dict[str, bytes] | None = None) -> bytes:
    files = dict(assets if assets is not None else _asset_files())
    if "icon.png" not in files:
        raise ValueError("icon.png обязателен для карты Apple Wallet")
    files["pass.json"] = json.dumps(pass_json, ensure_ascii=False, indent=2).encode("utf-8")

    manifest = {name: hashlib.sha1(content).hexdigest() for name, content in files.items()}
    manifest_bytes = json.dumps(manifest, indent=2).encode("utf-8")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, content in files.items():
            zf.writestr(name, content)
        zf.writestr("manifest.json", manifest_bytes)
        zf.writestr("signature", signer.sign(manifest_bytes))
    return buf.getvalue()
