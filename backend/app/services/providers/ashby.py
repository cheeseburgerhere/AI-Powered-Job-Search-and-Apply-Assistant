import html
import re
from typing import Any

from app.services.helpers import http_get_json, infer_remote_type, to_int


def search_ashby(
    query: str,
    company_slugs: list[str],
    location: str | None,
    remote_only: bool,
    per_page: int,
) -> list[dict[str, Any]]:
    """Fetch active jobs directly from Ashby job board API."""
    results: list[dict[str, Any]] = []
    query_pattern = re.compile(re.escape(query), re.IGNORECASE) if query.strip() else None

    for slug in company_slugs:
        try:
            url = f"https://api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true"
            data = http_get_json(url)
            for item in data.get("jobs", []):
                title = (item.get("title") or "").strip()
                description = item.get("descriptionPlain") or _clean_html(item.get("descriptionHtml") or "")
                loc = item.get("location") or ""
                is_remote = item.get("isRemote", False)
                workplace = (item.get("workplaceType") or "").lower()

                if query_pattern and not (query_pattern.search(title) or query_pattern.search(description)):
                    continue

                if is_remote or workplace == "remote":
                    remote_type = "remote"
                elif workplace == "hybrid":
                    remote_type = "hybrid"
                else:
                    remote_type = infer_remote_type(
                        explicit_remote=None,
                        text_chunks=[title, description, loc],
                    )

                # Extract salary from compensation tiers
                salary_min = None
                salary_max = None
                comp = item.get("compensation") or {}
                for tier in (comp.get("compensationTiers") or []):
                    for component in (tier.get("components") or []):
                        if (component.get("compensationType") or "").lower() == "salary":
                            salary_min = to_int(component.get("minValue")) or salary_min
                            salary_max = to_int(component.get("maxValue")) or salary_max

                results.append({
                    "external_id": f"ashby:{item.get('id', '')}",
                    "source": "ashby",
                    "title": title,
                    "company": slug.replace("-", " ").replace("_", " ").title(),
                    "location": loc,
                    "remote_type": remote_type,
                    "salary_min": salary_min,
                    "salary_max": salary_max,
                    "description": description,
                    "url": item.get("jobUrl") or f"https://jobs.ashbyhq.com/{slug}/{item.get('id', '')}",
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
