from pydantic_settings import BaseSettings
from functools import lru_cache
from pathlib import Path
import os
import sys
import shutil

# ---------------------------------------------------------------------------
# Resolve the user-level config directory (~/.ai-job-assistant/)
# ---------------------------------------------------------------------------
APP_CONFIG_DIR = Path.home() / ".ai-job-assistant"
APP_ENV_FILE = APP_CONFIG_DIR / ".env"


def _bundled_resource(filename: str) -> Path:
    """Return the path to a resource bundled with PyInstaller, or fall back
    to the project root during normal development."""
    if getattr(sys, "frozen", False):
        # Running inside a PyInstaller bundle
        base = Path(sys._MEIPASS)  # type: ignore[attr-defined]
    else:
        # Running from source – project root is two levels up from this file
        base = Path(__file__).resolve().parent.parent
    return base / filename


def bootstrap_env() -> None:
    """Ensure ~/.ai-job-assistant/.env exists.  If it does not, copy the
    bundled .env.example so the user has a template to fill in."""
    APP_CONFIG_DIR.mkdir(parents=True, exist_ok=True)

    if not APP_ENV_FILE.exists():
        example = _bundled_resource(".env.example")
        if example.exists():
            shutil.copy2(example, APP_ENV_FILE)
            print(
                f"[ai-job-assistant] Created config file at {APP_ENV_FILE}\n"
                f"  → Edit this file to add your API keys."
            )
        else:
            # Create an empty .env so pydantic doesn't error
            APP_ENV_FILE.touch()
            print(
                f"[ai-job-assistant] Created empty config at {APP_ENV_FILE}\n"
                f"  → Add your API keys to this file."
            )

    # Also ensure a data directory exists for the SQLite database
    data_dir = APP_CONFIG_DIR / "data"
    data_dir.mkdir(parents=True, exist_ok=True)


# Run the bootstrap immediately when config is first imported
bootstrap_env()


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------
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
    brave_api_key: str = ""   # Brave Search API key
    database_url: str = f"sqlite:///{APP_CONFIG_DIR / 'data' / 'app.db'}"

    # Server port – can be overridden by Electron via CLI arg --port
    server_port: int = 8000

    model_config = {
        "env_file": str(APP_ENV_FILE),
        "env_file_encoding": "utf-8",
    }


@lru_cache
def get_settings() -> Settings:
    return Settings()
