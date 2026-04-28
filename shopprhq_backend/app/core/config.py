from pydantic_settings import BaseSettings
from pydantic import field_validator


class Settings(BaseSettings):
    # Core
    PROJECT_NAME: str = "ShopprHQ"
    API_V1_STR: str = "/api/v1"

    # Database
    DATABASE_URL: str

    # Redis (REQUIRED)
    REDIS_URL: str

    # Paystack
    PAYSTACK_SECRET_KEY: str = ""
    PAYSTACK_WEBHOOK_SECRET: str = ""
    PAYSTACK_REDIRECT_URL: str = ""

    # Auth / JWT
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def fix_database_url(cls, v: str) -> str:
        if not v:
            raise ValueError("DATABASE_URL missing")

        if v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql+asyncpg://", 1)

        if v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+asyncpg://", 1)

        return v

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()

# Crash at startup if the default secret key is used outside of local dev.
# Set DEBUG=true only for local development — never in any hosted environment.
if settings.SECRET_KEY == "change-me-in-production":
    import os as _os
    _debug = _os.getenv("DEBUG", "").lower() in ("1", "true", "yes")
    if not _debug:
        raise RuntimeError(
            "SECRET_KEY is still the default value. "
            "Set a secure SECRET_KEY in your environment variables before deploying."
        )