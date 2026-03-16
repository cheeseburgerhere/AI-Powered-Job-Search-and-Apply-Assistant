import html
import re
from typing import Any

from app.services.helpers import http_get_json, infer_remote_type


def search_greenhouse(
    query: str,
    company_slugs: list[str],
    location: str | None,
    remote_only: bool,
    per_page: int,
) -> list[dict[str, Any]]:
    """Fetch active jobs directly from Greenhouse board API."""
    results: list[dict[str, Any]] = []
    query_pattern = re.compile(re.escape(query), re.IGNORECASE) if query.strip() else None

    for slug in company_slugs:
        try:
            url = f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true"
            data = http_get_json(url)
            for item in data.get("jobs", []):
                title = (item.get("title") or "").strip()
                content = item.get("content") or ""
                description = _clean_html(content)
                loc = (item.get("location") or {}).get("name") or ""

                if query_pattern and not (query_pattern.search(title) or query_pattern.search(description)):
                    continue

                results.append({
                    "external_id": f"greenhouse:{item.get('id', '')}",
                    "source": "greenhouse",
                    "title": title,
                    "company": slug.replace("-", " ").replace("_", " ").title(),
                    "location": loc,
                    "remote_type": infer_remote_type(
                        explicit_remote=None,
                        text_chunks=[title, description, loc],
                    ),
                    "salary_min": None,
                    "salary_max": None,
                    "description": description,
                    "url": item.get("absolute_url") or f"https://boards.greenhouse.io/{slug}/jobs/{item.get('id', '')}",
                    "link_type": "job",
                })
                if len(results) >= per_page:
                    return results
        except Exception:
            continue
    return results


def _clean_html(value: str) -> str:
    if not value:
        return ""
    text = html.unescape(str(value))
    text = re.sub(r"<[^>]+>", " ", text)
    text = text.replace("\u00a0", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text
