from functools import lru_cache
from pydantic import AnyUrl, Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Bageatteria API"
    app_env: str = Field("local", alias="APP_ENV")
    secret_key: str = Field(..., alias="SECRET_KEY")
    access_token_expire_minutes: int = Field(60 * 24 * 30, alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    jwt_algorithm: str = Field("HS256", alias="JWT_ALGORITHM")
    admin_cookie_secret: str = Field(..., alias="ADMIN_COOKIE_SECRET")
    admin_username: str = Field("admin", alias="ADMIN_USERNAME")
    admin_password: str = Field("admin", alias="ADMIN_PASSWORD")

    postgres_user: str = Field(..., alias="POSTGRES_USER")
    postgres_password: str = Field(..., alias="POSTGRES_PASSWORD")
    postgres_db: str = Field(..., alias="POSTGRES_DB")
    db_host: str = Field("localhost", alias="DB_HOST")
    db_port: int = Field(5432, alias="DB_PORT")

    telegram_bot_token: str = Field("", alias="TELEGRAM_BOT_TOKEN")
    telegram_chat_id: str = Field("", alias="TELEGRAM_CHAT_ID")

    # SMS (MTS Exolve)
    sms_exolve_api_key: str = Field("", alias="SMS_EXOLVE_API_KEY")
    sms_exolve_sender: str = Field("79926655394", alias="SMS_EXOLVE_SENDER")
    sms_code_expire_minutes: int = Field(5, alias="SMS_CODE_EXPIRE_MINUTES")
    sms_max_attempts: int = Field(3, alias="SMS_MAX_ATTEMPTS")
    sms_rate_limit_minutes: int = Field(1, alias="SMS_RATE_LIMIT_MINUTES")

    base_url: AnyUrl = Field("http://localhost:8000", alias="BASE_URL")
    upload_dir: str = Field("uploads", alias="UPLOAD_DIR")

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

