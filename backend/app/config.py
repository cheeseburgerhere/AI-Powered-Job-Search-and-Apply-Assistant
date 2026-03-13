from pydantic_settings import BaseSettings
from functools import lru_cache
import os


class Settings(BaseSettings):
    ai_provider: str = "anthropic"
    ai_model_general: str = ""
    ai_model_fast: str = ""

    anthropic_api_key: str = ""
    gemini_api_key: str = ""
    qwen_api_key: str = ""
    qwen_api_base: str = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"

    jsearch_api_key: str = ""
    adzuna_app_id: str = ""
    adzuna_api_key: str = ""
    google_api_key: str = ""   # Google Cloud API key (Custom Search)
    google_cse_id: str = ""    # Google Custom Search Engine ID (cx)
    database_url: str = "sqlite:///./data/app.db"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
