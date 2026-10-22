import hashlib
import io
import json
import subprocess
import zipfile
import shutil

import pytest

from app.services.wallet_pass import LoyaltyCard, PassSigner, build_pass_json, build_pkpass

CARD = LoyaltyCard(
    serial_number="5f0c1d2e-0000-4000-8000-000000000001",
    card_number="1000 2000 3000",
    barcode_message="BGT7QX2M9KD4PZ8R",
    balance=150,
    auth_token="a" * 32,
)


def _pass_json(web_service_url="https://api.example.test/wallet"):
    return build_pass_json(CARD, pass_type_id="pass.test.bageatteria", team_id="TEAM123456", web_service_url=web_service_url)


def test_pass_json_has_required_keys_and_no_personal_data():
    data = _pass_json()
    for key in ("formatVersion", "passTypeIdentifier", "teamIdentifier", "serialNumber", "organizationName", "description"):
        assert data[key]
    assert data["barcodes"][0]["format"] == "PKBarcodeFormatQR"
    assert data["barcodes"][0]["message"] == CARD.barcode_message
    assert data["storeCard"]["primaryFields"][0]["value"] == 150
    assert data["authenticationToken"] == CARD.auth_token
    assert "+7" not in json.dumps(data, ensure_ascii=False)


def test_pass_without_web_service_has_no_token():
    data = _pass_json(web_service_url=None)
    assert "webServiceURL" not in data and "authenticationToken" not in data


def test_pkpass_bundle_manifest_and_signature(fake_apple_certs, tmp_path):
    signer = PassSigner.from_files(fake_apple_certs["cert"], fake_apple_certs["key"], fake_apple_certs["wwdr"])
    raw = build_pkpass(_pass_json(), signer)

    zf = zipfile.ZipFile(io.BytesIO(raw))
    names = set(zf.namelist())
    assert {"pass.json", "manifest.json", "signature", "icon.png"} <= names

    manifest = json.loads(zf.read("manifest.json"))
    assert set(manifest) == names - {"manifest.json", "signature"}
    for name, sha in manifest.items():
        assert hashlib.sha1(zf.read(name)).hexdigest() == sha

    if not shutil.which("openssl"):
        pytest.skip("openssl не установлен")
    (tmp_path / "manifest.json").write_bytes(zf.read("manifest.json"))
    (tmp_path / "signature").write_bytes(zf.read("signature"))
    res = subprocess.run(
        [
            "openssl", "smime", "-verify", "-binary", "-inform", "DER",
            "-in", str(tmp_path / "signature"), "-content", str(tmp_path / "manifest.json"),
            "-CAfile", fake_apple_certs["wwdr"], "-purpose", "any", "-out", "/dev/null",
        ],
        capture_output=True,
    )
    assert res.returncode == 0, res.stderr.decode()


def test_pkpass_requires_icon(fake_apple_certs):
    signer = PassSigner.from_files(fake_apple_certs["cert"], fake_apple_certs["key"], fake_apple_certs["wwdr"])
    with pytest.raises(ValueError):
        build_pkpass(_pass_json(), signer, assets={})
