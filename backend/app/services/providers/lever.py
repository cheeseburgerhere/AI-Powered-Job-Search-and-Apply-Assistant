import html
import re
from typing import Any

from app.services.helpers import http_get_json, infer_remote_type, to_int


def search_lever(
    query: str,
    company_slugs: list[str],
    location: str | None,
    remote_only: bool,
    per_page: int,
) -> list[dict[str, Any]]:
    """Fetch active jobs directly from Lever postings API."""
    results: list[dict[str, Any]] = []
    query_pattern = re.compile(re.escape(query), re.IGNORECASE) if query.strip() else None

    for slug in company_slugs:
        try:
            url = f"https://api.lever.co/v0/postings/{slug}"
            data = http_get_json(url, {"Accept": "application/json"})
            postings = data if isinstance(data, list) else []
            for item in postings:
                title = (item.get("text") or "").strip()
                description = item.get("descriptionPlain") or _clean_html(item.get("description") or "")
                categories = item.get("categories") or {}
                loc = categories.get("location") or ""
                workplace = (item.get("workplaceType") or "").lower()

                if query_pattern and not (query_pattern.search(title) or query_pattern.search(description)):
                    continue

                remote_type = "onsite"
                if workplace == "remote":
                    remote_type = "remote"
                elif workplace == "hybrid":
                    remote_type = "hybrid"
                else:
                    remote_type = infer_remote_type(
                        explicit_remote=None,
                        text_chunks=[title, description, loc],
                    )

                salary_range = item.get("salaryRange") or {}
                salary_min = to_int(salary_range.get("min"))
                salary_max = to_int(salary_range.get("max"))

                results.append({
                    "external_id": f"lever:{item.get('id', '')}",
                    "source": "lever",
                    "title": title,
                    "company": slug.replace("-", " ").replace("_", " ").title(),
                    "location": loc,
                    "remote_type": remote_type,
                    "salary_min": salary_min,
                    "salary_max": salary_max,
                    "description": description,
                    "url": item.get("hostedUrl") or f"https://jobs.lever.co/{slug}/{item.get('id', '')}",
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
