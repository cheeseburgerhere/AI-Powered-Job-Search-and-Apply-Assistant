import urllib.parse
from typing import Any

from app.services.helpers import http_get_json, infer_remote_type, to_int


def search_jsearch(
    query: str,
    location: str | None,
    remote_only: bool,
    page: int,
    api_key: str,
) -> list[dict[str, Any]]:
    """Fetch jobs from JSearch (RapidAPI)."""
    query_text = query.strip()
    if location:
        query_text = f"{query_text} in {location.strip()}"
    if remote_only:
        query_text = f"{query_text} remote"

    params = {
        "query": query_text,
        "page": max(1, page),
        "num_pages": 1,
        "date_posted": "all",
    }
    url = f"https://jsearch.p.rapidapi.com/search?{urllib.parse.urlencode(params)}"
    headers = {
        "X-RapidAPI-Key": api_key,
        "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
    }

    payload = http_get_json(url, headers)
    raw_jobs = payload.get("data") or []
    normalized: list[dict[str, Any]] = []

    for item in raw_jobs:
        city = item.get("job_city")
        state = item.get("job_state")
        country = item.get("job_country")
        location_text = ", ".join([part for part in [city, state, country] if part])
        description = item.get("job_description") or ""

        normalized.append(
            {
                "external_id": item.get("job_id"),
                "source": "jsearch",
                "title": (item.get("job_title") or "").strip(),
                "company": (item.get("employer_name") or "").strip(),
                "location": location_text,
                "remote_type": infer_remote_type(
                    explicit_remote=item.get("job_is_remote"),
                    text_chunks=[item.get("job_title"), description, location_text],
                ),
                "salary_min": to_int(item.get("job_min_salary")),
                "salary_max": to_int(item.get("job_max_salary")),
                "description": description,
                "url": item.get("job_apply_link"),
            }
        )

    return normalized
