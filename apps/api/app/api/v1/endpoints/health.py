import os
from fastapi import APIRouter
from app.core.config import settings

router = APIRouter(tags=["System"])


@router.get("/health")
def health_check():
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }


@router.get("/models")
def models_status():
    """Returns which AI providers are configured and active."""
    def active(key: str) -> bool:
        return bool(os.getenv(key, "").strip())

    providers = {
        "xai_grok":    {"name": "xAI Grok 3",           "active": active("XAI_API_KEY"),       "models": ["grok-3", "grok-3-mini"],           "tier": ["high", "medium", "low"]},
        "openai":      {"name": "OpenAI GPT-4o",         "active": active("OPENAI_API_KEY"),    "models": ["gpt-4o", "gpt-4o-mini"],           "tier": ["high", "medium", "low"]},
        "anthropic":   {"name": "Anthropic Claude",      "active": active("ANTHROPIC_API_KEY"), "models": ["claude-sonnet-4-6", "claude-haiku-4-5"], "tier": ["high", "medium"]},
        "groq":        {"name": "Groq (Llama / Qwen)",   "active": active("GROQ_API_KEY"),      "models": ["llama-4-scout", "qwen-2.5-coder"], "tier": ["low"]},
        "google":      {"name": "Google Gemini",         "active": active("GOOGLE_API_KEY"),    "models": ["gemini-2.5-pro", "gemini-2.0-flash"], "tier": ["high", "medium"]},
    }

    active_count = sum(1 for p in providers.values() if p["active"])

    return {
        "providers": providers,
        "active_count": active_count,
        "routing": {
            "high":   "grok-3 → gpt-4o → claude-sonnet-4-6",
            "medium": "gpt-4o → grok-3 → gpt-4o-mini",
            "low":    "gpt-4o-mini → grok-3-mini",
        }
    }
