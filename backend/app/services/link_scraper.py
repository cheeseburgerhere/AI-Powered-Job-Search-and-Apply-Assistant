"""Service to scrape job details from a URL.

Uses site-specific scrapers (YC, Greenhouse, Lever, Ashby, LinkedIn)
with a generic fallback. Also integrates Brave Search for additional context.
"""

import json
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from app.config import get_settings
from app.services.helpers import is_real_secret
from app.services.site_scrapers import scrape_url, ScrapeResult


async def fetch_page_html(url: str) -> str:
    """Fetch raw HTML content from a URL."""
    try:
        request = urllib.request.Request(
            url=url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
        )
        with urllib.request.urlopen(request, timeout=30) as response:
            html = response.read().decode("utf-8", errors="ignore")
            return html
    except Exception as exc:
        raise RuntimeError(f"Failed to fetch page: {exc}") from exc


def _use_brave_search_to_get_page_content(url: str, settings: Any) -> dict[str, Any]:
    """Use Brave Search API to fetch and parse the page content about a job URL."""
    if not is_real_secret(settings.brave_api_key):
        return {}

    try:
        # Search for content about this specific URL
        search_query = url
        params = {"q": search_query, "count": 1}
        headers = {
            "X-Subscription-Token": settings.brave_api_key,
            "Accept": "application/json",
        }

        url_str = f"https://api.search.brave.com/res/v1/web/search?{urllib.parse.urlencode(params)}"
        request = urllib.request.Request(url=url_str, headers=headers, method="GET")

        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read().decode("utf-8")
            data = json.loads(body)
            if data.get("web"):
                result = data["web"][0]
                return {
                    "title": result.get("title", ""),
                    "description": result.get("description", ""),
                    "snippet": result.get("snippet", ""),
                }
    except Exception:
        pass

    return {}


def _enrich_with_brave(result: ScrapeResult, brave_result: dict[str, Any]) -> ScrapeResult:
    """Enrich a scrape result with Brave Search data if our extraction is weak."""
    if not brave_result:
        return result

    # If we have no description, use Brave's
    if not result.description and brave_result.get("description"):
        result.description = brave_result["description"]
        result.confidence = max(result.confidence, 0.4)

    # If company is still generic, try Brave's title
    if result.company in ("Company", "") and brave_result.get("title"):
        brave_title = brave_result["title"]
        if " at " in brave_title:
            result.company = brave_title.rsplit(" at ", 1)[-1].split("|")[0].strip()[:80]

    # If title is still generic, try Brave's title
    if result.title in ("Job Opening", "") and brave_result.get("title"):
        brave_title = brave_result["title"]
        if " at " in brave_title:
            result.title = brave_title.split(" at ")[0].strip()[:150]
        else:
            result.title = brave_title.split("|")[0].strip()[:150]

    return result


async def scrape_job_from_url(url: str, profile_text: str) -> dict[str, Any]:
    """
    Scrape a job posting from a URL and extract details.

    Uses site-specific scrapers for known job boards and a generic
    fallback with BeautifulSoup.

    Returns dict with keys:
    - title: Job title
    - company: Company name
    - description: Job description (full, not truncated)
    - link: Original URL
    - company_info: Company background info (populated later)
    """
    settings = get_settings()

    # Fetch raw HTML
    html = await fetch_page_html(url)

    # Run site-specific scraper
    result = scrape_url(url, html)

    # Try Brave Search for additional context
    brave_result = _use_brave_search_to_get_page_content(url, settings)

    # Enrich weak extractions with Brave data
    result = _enrich_with_brave(result, brave_result)

    return {
        "title": result.title or "Job Opening",
        "company": result.company or "Company",
        "description": result.description or "",
        "link": url,
        "company_info": "",  # Will be populated by company info service
        "location": result.location,
        "salary": result.salary,
        "employment_type": result.employment_type,
        "extraction_method": result.extraction_method,
        "confidence": result.confidence,
        "raw_text": result.raw_text,
        "brave_result": brave_result,
        "html_length": len(html),
    }
