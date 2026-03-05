from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Turion Network API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "postgresql://turion:turion123@localhost:5432/turion_db"

    # JWT
    SECRET_KEY: str = "changeme-generate-with-openssl-rand-hex-32"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # CORS — domains allowed to call the API
    ALLOWED_ORIGINS: List[str] = [
        "https://turion.network",
        "https://www.turion.network",
        "http://localhost:3000",
    ]

    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRICE_PRO_GBP: str = ""
    STRIPE_PRICE_PRO_BRL: str = ""
    STRIPE_PRICE_TEAM_GBP: str = ""
    STRIPE_PRICE_TEAM_BRL: str = ""

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
