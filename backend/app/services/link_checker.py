"""Link validation: classify job URLs as 'job', 'board', or 'expired'."""

import re
import urllib.error
import urllib.request


def check_link_type(url: str) -> str:
    """Fetch a job page and classify it as 'job', 'board', or 'expired'."""
    try:
        body = _http_get_text(url)
    except Exception:
        return "expired"

    lower = body.lower()

    # Check for expired / filled indicators
    expired_phrases = [
        "position has been filled",
        "no longer accepting",
        "no longer available",
        "this job is no longer",
        "job not found",
        "posting has been closed",
        "role has been filled",
        "this position is closed",
    ]
    if any(phrase in lower for phrase in expired_phrases):
        return "expired"

    # Check for board / multiple-listings indicators
    apply_count = len(re.findall(r"apply\s*(now|here|for this)", lower))
    job_card_count = lower.count('class="job') + lower.count("class='job") + lower.count("data-job-id")
    if apply_count >= 3 or job_card_count >= 3:
        return "board"

    return "job"


def _http_get_text(url: str) -> str:
    """Fetch a URL and return the response body as text."""
    request = urllib.request.Request(
        url=url,
        headers={"User-Agent": "Mozilla/5.0 (compatible; JobAssistant/1.0)"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return response.read().decode("utf-8", errors="ignore")
    except urllib.error.HTTPError as exc:
        if exc.code in (404, 410):
            raise
        return exc.read().decode("utf-8", errors="ignore")
