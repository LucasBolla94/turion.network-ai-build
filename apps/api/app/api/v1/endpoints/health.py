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
        "xai": {
            "name": "xAI Grok",
            "active": active("XAI_API_KEY"),
            "models": ["grok-4-fast-non-reasoning", "grok-code-fast-1", "grok-3", "grok-3-mini"],
            "tier": ["high", "medium", "low"],
        },
        "openai": {
            "name": "OpenAI",
            "active": active("OPENAI_API_KEY"),
            "models": ["gpt-4o", "gpt-4o-mini"],
            "tier": ["high", "medium", "low"],
        },
        "anthropic": {
            "name": "Anthropic Claude",
            "active": active("ANTHROPIC_API_KEY"),
            "models": ["claude-sonnet-4-6", "claude-haiku-4-5"],
            "tier": ["high", "medium"],
        },
        "zhipu_zai": {
            "name": "Z.ai / Zhipu GLM",
            "active": active("ZAI_API_KEY"),
            "models": ["glm-5-code", "glm-4.7", "glm-4.7-flash (FREE)", "glm-4.5-flash (FREE)", "glm-4.7-flashx"],
            "tier": ["high", "medium", "low", "free"],
        },
        "groq": {
            "name": "Groq",
            "active": active("GROQ_API_KEY"),
            "models": ["llama-4-scout", "qwen-qwq-32b"],
            "tier": ["low"],
        },
        "google": {
            "name": "Google Gemini",
            "active": active("GOOGLE_API_KEY"),
            "models": ["gemini-2.5-pro", "gemini-2.0-flash"],
            "tier": ["high", "medium"],
        },
    }

    active_count = sum(1 for p in providers.values() if p["active"])

    return {
        "providers": providers,
        "active_count": active_count,
        "routing": {
            "high":   "grok-4-fast → grok-code-fast-1 → glm-5-code → gpt-4o → claude-sonnet-4-6 → grok-3",
            "medium": "grok-4-fast → gpt-4o-mini → glm-4.7 → claude-haiku-4-5 → gpt-4o",
            "low":    "glm-4.7-flash (FREE) → gpt-4o-mini → grok-3-mini → glm-4.7-flashx",
            "free_plan": "glm-4.7-flash (FREE) → glm-4.5-flash (FREE) [all tiers]",
        }
    }
