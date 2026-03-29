"""Shared helpers used by job search providers."""

import json
import urllib.error
import urllib.request
from typing import Any


def http_get_json(url: str, headers: dict[str, str] | None = None) -> Any:
    """Fetch a URL and parse the JSON response."""
    request = urllib.request.Request(url=url, headers=headers or {}, method="GET")
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            body = response.read().decode("utf-8")
            return json.loads(body)
    except urllib.error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="ignore")
        try:
            err_json = json.loads(details)
            msg = (
                err_json.get("error", {}).get("message")
                or err_json.get("message")
                or err_json.get("error")
            )
            if msg:
                raise RuntimeError(f"HTTP {exc.code}: {msg}") from exc
        except (json.JSONDecodeError, AttributeError):
            pass
        raise RuntimeError(f"HTTP {exc.code}: {details[:200]}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Network error: {exc.reason}") from exc


def infer_remote_type(explicit_remote: Any, text_chunks: list[Any]) -> str:
    """Infer remote/hybrid/onsite from explicit flag or text content."""
    if explicit_remote is True:
        return "remote"

    haystack = " ".join([str(chunk) for chunk in text_chunks if chunk]).lower()

    if "hybrid" in haystack:
        return "hybrid"
    if "fully remote" in haystack or "100% remote" in haystack or "work from home" in haystack:
        return "remote"
    if "remote" in haystack:
        return "remote"
    if "on-site" in haystack or "onsite" in haystack or "on site" in haystack:
        return "onsite"
    return "onsite"


def to_int(value: Any) -> int | None:
    """Safely convert a value to int, returning None on failure."""
    if value is None:
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def http_get_html(url: str, timeout: int = 60) -> str:
    """Fetch a URL and return the raw HTML as a string.

    Uses a browser-like User-Agent to avoid simple bot blocks.
    Returns an empty string on any failure so callers can fall back gracefully.
    """
    request = urllib.request.Request(
        url=url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.read().decode("utf-8", errors="ignore")
    except Exception:
        return ""


def is_real_secret(value: str | None) -> bool:
    """Check if a string looks like a real API key (not a placeholder)."""
    if not value:
        return False
    raw = value.strip()
    if not raw:
        return False
    lowered = raw.lower()
    placeholder_markers = [
        "your-", "your_", "xxxxx", "example", "replace-me", "changeme",
    ]
    return not any(marker in lowered for marker in placeholder_markers)
