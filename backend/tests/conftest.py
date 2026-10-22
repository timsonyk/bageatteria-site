import os
from datetime import datetime, timedelta, timezone

import pytest
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID

# Настройки для импорта app.* без реального .env и без базы.
os.environ.setdefault("SECRET_KEY", "test")
os.environ.setdefault("ADMIN_COOKIE_SECRET", "test")
os.environ.setdefault("POSTGRES_USER", "test")
os.environ.setdefault("POSTGRES_PASSWORD", "test")
os.environ.setdefault("POSTGRES_DB", "test")
os.environ.setdefault("APP_ENV", "local")


def _cert(subject: str, key, issuer_name=None, issuer_key=None, ca=False):
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, subject)])
    now = datetime.now(timezone.utc)
    return (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(issuer_name or name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(days=1))
        .not_valid_after(now + timedelta(days=30))
        .add_extension(x509.BasicConstraints(ca=ca, path_length=None), critical=True)
        .sign(issuer_key or key, hashes.SHA256())
    )


@pytest.fixture(scope="session")
def fake_apple_certs(tmp_path_factory):
    """Самоподписанные «WWDR» и «Pass Type ID» — только для тестов, Apple их не примет."""
    d = tmp_path_factory.mktemp("certs")
    ca_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    ca = _cert("Fake Apple WWDR", ca_key, ca=True)
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    cert = _cert("Pass Type ID: pass.test.bageatteria", key, ca.subject, ca_key)
    paths = {
        "cert": d / "pass.pem",
        "key": d / "pass.key",
        "wwdr": d / "wwdr.pem",
    }
    paths["cert"].write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    paths["wwdr"].write_bytes(ca.public_bytes(serialization.Encoding.PEM))
    paths["key"].write_bytes(
        key.private_bytes(
            serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()
        )
    )
    return {k: str(v) for k, v in paths.items()}
