"""Link validation: classify job URLs as 'job', 'board', or 'expired'."""

import re
import urllib.error
import urllib.request
import urllib.parse


def check_link_type(url: str) -> str:
    """Fetch a job page and classify it as 'job', 'board', or 'expired'."""
    # Use path-based rules first for common ATS domains. They are more reliable
    # than content heuristics and avoid mislabeling valid job pages as boards.
    path_based = _classify_known_ats_path(url)
    if path_based:
        return path_based

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


def _classify_known_ats_path(url: str) -> str | None:
    """Classify known ATS URLs from their path shape."""
    try:
        parsed = urllib.parse.urlparse(url)
    except Exception:
        return None

    host = (parsed.netloc or "").lower()
    path_parts = [p for p in (parsed.path or "").strip("/").split("/") if p]

    if not host or not path_parts:
        return None

    if "boards.greenhouse.io" in host:
        # /{company}/jobs/{id} is a single posting; /{company} is a board listing.
        if len(path_parts) >= 3 and path_parts[1].lower() == "jobs":
            return "job"
        return "board"

    if "jobs.lever.co" in host:
        # /{company}/{jobId} is a single posting; /{company} is a board listing.
        if len(path_parts) >= 2:
            return "job"
        return "board"

    if "jobs.ashbyhq.com" in host:
        # /{company}/jobs/{slug} is a single posting; /{company}/jobs is a board.
        if len(path_parts) >= 3 and path_parts[1].lower() == "jobs":
            return "job"
        if len(path_parts) >= 2 and path_parts[1].lower() == "jobs":
            return "board"
        return "board"

    return None


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
