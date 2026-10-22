from functools import lru_cache
from pydantic import AnyUrl, Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Bageatteria API"
    app_env: str = Field("local", alias="APP_ENV")
    secret_key: str = Field(..., alias="SECRET_KEY")
    # Refresh token TTL (минуты). 14 дней — стандартная практика для длинной сессии.
    refresh_token_expire_minutes: int = Field(60 * 24 * 14, alias="REFRESH_TOKEN_EXPIRE_MINUTES")
    jwt_algorithm: str = Field("HS256", alias="JWT_ALGORITHM")
    admin_cookie_secret: str = Field(..., alias="ADMIN_COOKIE_SECRET")
    admin_username: str = Field("admin", alias="ADMIN_USERNAME")
    # Plaintext password (legacy, для локального dev).
    admin_password: str = Field("", alias="ADMIN_PASSWORD")
    # bcrypt-хэш пароля админа. Если задан — используется он, не plaintext.
    admin_password_hash: str = Field("", alias="ADMIN_PASSWORD_HASH")
    # CORS allowed origins (CSV). В production пустое значение приведёт к ошибке.
    cors_origins: str = Field("", alias="CORS_ORIGINS")

    postgres_user: str = Field(..., alias="POSTGRES_USER")
    postgres_password: str = Field(..., alias="POSTGRES_PASSWORD")
    postgres_db: str = Field(..., alias="POSTGRES_DB")
    db_host: str = Field("localhost", alias="DB_HOST")
    db_port: int = Field(5432, alias="DB_PORT")

    base_url: AnyUrl = Field("http://localhost:8000", alias="BASE_URL")
    upload_dir: str = Field("uploads", alias="UPLOAD_DIR")

    # Карта лояльности (Apple Wallet + iikoCard). Пока не задано — эндпоинты /wallet отвечают 503.
    wallet_enabled: bool = Field(False, alias="WALLET_ENABLED")
    apple_pass_type_id: str = Field("", alias="APPLE_PASS_TYPE_ID")  # pass.com.bageatteria.loyalty
    apple_team_id: str = Field("", alias="APPLE_TEAM_ID")
    apple_pass_cert_path: str = Field("", alias="APPLE_PASS_CERT_PATH")  # PEM сертификата Pass Type ID
    apple_pass_key_path: str = Field("", alias="APPLE_PASS_KEY_PATH")  # PEM приватного ключа
    apple_pass_key_password: str = Field("", alias="APPLE_PASS_KEY_PASSWORD")
    apple_wwdr_cert_path: str = Field("", alias="APPLE_WWDR_CERT_PATH")  # промежуточный сертификат Apple WWDR G4
    wallet_web_service_url: str = Field("", alias="WALLET_WEB_SERVICE_URL")  # https://api.bageatteria.com/wallet

    iiko_api_key: str = Field("", alias="IIKO_API_KEY")
    iiko_app_id: str = Field("", alias="IIKO_APP_ID")
    iiko_client_secret: str = Field("", alias="IIKO_CLIENT_SECRET")
    iiko_api_login: str = Field("", alias="IIKO_API_LOGIN")
    iiko_organization_id: str = Field("", alias="IIKO_ORGANIZATION_ID")
    iiko_bonus_program_id: str = Field("", alias="IIKO_BONUS_PROGRAM_ID")
    # Пароль подписки на вебхуки в iikoCard (Настройки → Webhook-уведомления).
    iiko_webhook_secret: str = Field("", alias="IIKO_WEBHOOK_SECRET")
    # Необязательный ключ WalletPasses (Android): без него лимит 5 push/с.
    walletpasses_api_key: str = Field("", alias="WALLETPASSES_API_KEY")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        populate_by_name = True
        extra = "ignore"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.db_host}:{self.db_port}/{self.postgres_db}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()

