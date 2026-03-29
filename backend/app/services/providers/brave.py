"""Brave Search provider – discovers job URLs via Brave API, then scrapes
each page with the BS4-based site scrapers for accurate extraction.

Falls back to parsing the Brave search snippet when a page fetch fails.
"""

import hashlib
import html
import logging
import re
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

from app.services.helpers import http_get_json, http_get_html, infer_remote_type
from app.services.link_checker import check_link_type
from app.services.site_scrapers import scrape_url, ScrapeResult

logger = logging.getLogger(__name__)

_BRAVE_ENDPOINT = "https://api.search.brave.com/res/v1/web/search"

DEFAULT_SCRAPE_SITES = [
    "boards.greenhouse.io",
    "jobs.lever.co",
    "jobs.ashbyhq.com",
]

# Minimum confidence from site_scrapers below which we prefer the Brave snippet
_MIN_SCRAPE_CONFIDENCE = 0.3

# Max concurrent page fetches
_MAX_WORKERS = 10


def search_brave(
    query: str,
    location: str | None,
    remote_only: bool,
    per_page: int,
    api_key: str,
    sites: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Use Brave Search API to discover job URLs, then scrape each page."""
    target_sites = sites or DEFAULT_SCRAPE_SITES
    seen_urls: set[str] = set()
    site_errors: list[str] = []

    # ---- Phase 1: Discover URLs via Brave Search ----
    # Collect (url, brave_item) pairs for all target sites
    discovered: list[tuple[str, dict[str, Any]]] = []

    for site in target_sites:
        try:
            items = _brave_site_search(
                site, query, location, remote_only,
                min(per_page, 20), api_key,
            )
            for item in items:
                url = item.get("url", "")
                if not url or url in seen_urls:
                    continue
                seen_urls.add(url)
                discovered.append((url, item))
        except Exception as exc:
            site_errors.append(f"{site}: {exc}")

    if not discovered and site_errors:
        raise RuntimeError("; ".join(site_errors))

    if not discovered:
        return []

    # ---- Phase 2: Concurrently fetch + scrape each page ----
    all_jobs: list[dict[str, Any]] = []

    # Map URL -> fetched HTML (empty string on failure)
    html_map: dict[str, str] = {}

    def _fetch(url: str) -> tuple[str, str]:
        return url, http_get_html(url)

    with ThreadPoolExecutor(max_workers=_MAX_WORKERS) as pool:
        futures = {pool.submit(_fetch, url): url for url, _ in discovered}
        for future in as_completed(futures):
            try:
                url, page_html = future.result()
                html_map[url] = page_html
            except Exception:
                html_map[futures[future]] = ""

    # ---- Phase 3: Extract structured data ----
    for url, brave_item in discovered:
        page_html = html_map.get(url, "")
        site = _site_from_url(url)

        job: dict[str, Any] | None = None

        # Try full BS4 scrape if we got HTML
        if page_html:
            try:
                result: ScrapeResult = scrape_url(url, page_html)
                if result.confidence >= _MIN_SCRAPE_CONFIDENCE:
                    job = _scrape_result_to_job(result, url, site)
            except Exception:
                logger.debug("BS4 scrape failed for %s, falling back", url)

        # Fallback: parse from Brave search snippet
        if job is None:
            snippet = brave_item.get("description", "")
            cse_title = brave_item.get("title", "")
            job = _parse_job_board_url(url, site, snippet, cse_title=cse_title)

        if job is not None:
            job["link_type"] = check_link_type(url)
            all_jobs.append(job)

    return all_jobs


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _site_from_url(url: str) -> str:
    """Extract the hostname from a URL."""
    return urllib.parse.urlparse(url).hostname or ""


def _scrape_result_to_job(result: ScrapeResult, url: str, site: str) -> dict[str, Any]:
    """Convert a ScrapeResult from site_scrapers into the normalized job dict."""
    external_id = _external_id_from_url(url, site)

    return {
        "external_id": f"{site}:{external_id}",
        "source": "brave_scrape",
        "title": result.title or "Open Position",
        "company": result.company or "",
        "location": result.location or "",
        "remote_type": infer_remote_type(
            explicit_remote=None,
            text_chunks=[result.title, result.description, result.location],
        ),
        "salary_min": None,
        "salary_max": None,
        "description": result.description or "",
        "url": url,
    }


def _external_id_from_url(url: str, site: str) -> str:
    """Derive a stable external ID from the URL path."""
    parsed = urllib.parse.urlparse(url)
    parts = [p for p in parsed.path.strip("/").split("/") if p]

    if "greenhouse.io" in site and len(parts) >= 3:
        return parts[2]
    elif "lever.co" in site and len(parts) >= 2:
        return parts[1]
    elif "ashbyhq.com" in site and len(parts) >= 2:
        return parts[-1]

    # Fallback: hash the URL
    return hashlib.md5(url.encode()).hexdigest()[:12]


# ---------------------------------------------------------------------------
# Brave API query
# ---------------------------------------------------------------------------

def _brave_site_search(
    site: str,
    query: str,
    location: str | None,
    remote_only: bool,
    num: int,
    api_key: str,
) -> list[dict[str, Any]]:
    """Run a single Brave Search query and return raw result items."""
    search_query = f"site:{site} {query}"
    if location:
        search_query += f" {location}"
    if remote_only:
        search_query += " remote"

    params = {
        "q": search_query,
        "count": max(1, min(num, 20)),
    }
    headers = {
        "X-Subscription-Token": api_key,
        "Accept": "application/json",
    }
    url = f"{_BRAVE_ENDPOINT}?{urllib.parse.urlencode(params)}"
    data = http_get_json(url, headers)
    return data.get("web", {}).get("results", [])


# ---------------------------------------------------------------------------
# Fallback: parse from Brave search snippet (original logic)
# ---------------------------------------------------------------------------

def _parse_job_board_url(
    url: str, site: str, snippet: str, cse_title: str = ""
) -> dict[str, Any] | None:
    """Parse a job board URL into a normalized job dict using Brave snippet data.

    Used as a fallback when BS4 page scraping fails.
    """
    parsed = urllib.parse.urlparse(url)
    path_parts = [p for p in parsed.path.strip("/").split("/") if p]

    if not path_parts:
        return None

    company = ""
    title = ""
    external_id = ""
    cleaned_title = _clean_search_title(cse_title)
    cleaned_snippet = _clean_search_snippet(snippet)

    if "greenhouse.io" in site:
        company = path_parts[0] if len(path_parts) >= 1 else ""
        external_id = path_parts[2] if len(path_parts) >= 3 else ""
        title = cleaned_title or _title_from_snippet(cleaned_snippet, company)

    elif "lever.co" in site:
        company = path_parts[0] if len(path_parts) >= 1 else ""
        external_id = path_parts[1] if len(path_parts) >= 2 else ""
        title = cleaned_title or _title_from_snippet(cleaned_snippet, company)

    elif "ashbyhq.com" in site:
        company = path_parts[0] if len(path_parts) >= 1 else ""
        slug = path_parts[-1] if len(path_parts) >= 2 else ""
        external_id = slug
        title = (
            cleaned_title
            or slug.replace("-", " ").title()
            or _title_from_snippet(cleaned_snippet, company)
        )

    else:
        company = path_parts[0] if path_parts else ""
        external_id = path_parts[-1] if len(path_parts) >= 2 else ""
        title = cleaned_title or _title_from_snippet(cleaned_snippet, company)

    if not company and not title:
        return None

    display_company = company.replace("-", " ").replace("_", " ").title()

    if not external_id:
        external_id = hashlib.md5(url.encode()).hexdigest()[:12]

    return {
        "external_id": f"{site}:{external_id}",
        "source": "brave_scrape",
        "title": title or "Open Position",
        "company": display_company,
        "location": "",
        "remote_type": infer_remote_type(
            explicit_remote=None,
            text_chunks=[title, cleaned_snippet],
        ),
        "salary_min": None,
        "salary_max": None,
        "description": cleaned_snippet,
        "url": url,
    }


# ---- Text cleaning helpers for Brave results ----


def _clean_search_text(value: str) -> str:
    """Strip HTML/markup and normalize whitespace from search text."""
    if not value:
        return ""
    text = html.unescape(str(value))
    text = re.sub(r"<[^>]+>", " ", text)
    text = text.replace("\u00a0", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _clean_search_title(value: str) -> str:
    """Normalize search result titles and drop generic placeholders."""
    title = _clean_search_text(value)
    if not title:
        return ""

    for sep in [" | ", " - ", " — ", " – "]:
        if sep in title:
            head = title.split(sep, 1)[0].strip()
            if head and len(head) >= 3:
                title = head
                break

    lowered = title.lower()
    generic_titles = {
        "embed", "job", "jobs", "careers", "career",
        "greenhouse", "lever", "ashby", "open positions",
    }

    if lowered in generic_titles:
        return ""
    if lowered.startswith("embed "):
        return ""
    if lowered.startswith("jobs at ") or lowered.startswith("careers at "):
        return ""

    return title


def _clean_search_snippet(value: str) -> str:
    """Remove common board noise from snippets while preserving useful details."""
    text = _clean_search_text(value)
    if not text:
        return ""

    noise_terms = [
        "current job openings", "open positions",
        "view all jobs", "all jobs", "job board",
    ]
    for term in noise_terms:
        text = re.sub(rf"\b{re.escape(term)}\b", " ", text, flags=re.IGNORECASE)

    text = re.sub(r"\s+([|\-·•])\s+", " · ", text)
    text = re.sub(r"\s+", " ", text).strip(" ·-|")
    return text


def _title_from_snippet(snippet: str, company: str) -> str:
    """Try to extract a job title from a search snippet."""
    if not snippet:
        return ""

    text = _clean_search_snippet(snippet)

    if company:
        normalized_company = company.replace("-", " ").replace("_", " ").strip().lower()
        segments = [seg.strip() for seg in re.split(r"\s+·\s+", text) if seg.strip()]
        if segments:
            for seg in segments:
                lowered = seg.lower()
                if lowered == normalized_company or normalized_company in lowered:
                    continue
                if "job openings" in lowered:
                    continue
                if _looks_like_job_title(seg):
                    return seg

    for sep in [" at ", " - ", " | ", " — ", " – ", ": "]:
        if sep in text:
            parts = text.split(sep, 1)
            candidate = parts[0].strip()
            if 3 < len(candidate) < 100 and "http" not in candidate.lower():
                return candidate

    first_chunk = re.split(r"[.!?\n]", text)[0].strip()
    if 3 < len(first_chunk) < 100:
        return first_chunk

    return ""


def _looks_like_job_title(value: str) -> bool:
    lowered = value.lower().strip()
    if not lowered or len(lowered) < 4:
        return False

    title_tokens = [
        "engineer", "developer", "designer", "manager", "analyst",
        "scientist", "intern", "specialist", "lead", "director",
        "architect", "operator", "consultant", "coordinator",
        "product", "software", "data", "ai", "ml",
    ]
    return any(token in lowered for token in title_tokens)
