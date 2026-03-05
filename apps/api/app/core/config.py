from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    APP_NAME: str = "Turion Network API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    DATABASE_URL: str = "postgresql://turion:turion123@localhost:5432/turion_db"

    SECRET_KEY: str = "changeme"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

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

    # AI keys — router picks the best available
    ANTHROPIC_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    XAI_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    GOOGLE_API_KEY: str = ""

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
