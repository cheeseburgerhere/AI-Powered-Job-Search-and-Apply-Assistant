"""Report which optional server-side features are configured."""

from app.config import get_settings
from app.services.helpers import is_real_secret
from app.services.job_search import JobSearchService


def server_ai_provider() -> str:
    return (get_settings().ai_provider or "anthropic").strip().lower()


def server_ai_configured() -> bool:
    """True when the configured AI provider has a usable API key."""
    settings = get_settings()
    provider_key = {
        "anthropic": settings.anthropic_api_key,
        "gemini": settings.gemini_api_key,
        "qwen": settings.qwen_api_key,
    }.get(server_ai_provider(), "")
    return is_real_secret(provider_key)


def get_capabilities() -> dict:
    return {
        "server_ai": server_ai_configured(),
        "ai_provider": server_ai_provider(),
        "search_sources": JobSearchService().configured_sources(),
    }
