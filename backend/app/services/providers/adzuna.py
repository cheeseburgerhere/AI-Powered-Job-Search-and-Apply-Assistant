import urllib.parse
from typing import Any

from app.services.helpers import http_get_json, infer_remote_type, to_int

# European country codes supported by Adzuna
EUROPE_COUNTRIES = ["gb", "de", "fr", "nl", "pl", "it", "es", "at", "be", "ch"]


def search_adzuna(
    query: str,
    location: str | None,
    remote_only: bool,
    salary_min: int | None,
    salary_max: int | None,
    page: int,
    per_page: int,
    country: str | None,
    app_id: str,
    api_key: str,
) -> list[dict[str, Any]]:
    """Fetch jobs from Adzuna. Fans out across Europe when country='europe'."""
    adzuna_country = (country or "europe").lower().strip()

    if adzuna_country == "europe":
        all_results: list[dict[str, Any]] = []
        per_country = max(1, per_page // len(EUROPE_COUNTRIES))
        for code in EUROPE_COUNTRIES:
            try:
                all_results.extend(
                    _search_single(
                        query, location, remote_only, salary_min, salary_max,
                        page, per_country, code, app_id, api_key,
                    )
                )
            except Exception:
                pass  # skip countries that error
        return all_results

    return _search_single(
        query, location, remote_only, salary_min, salary_max,
        page, per_page, adzuna_country, app_id, api_key,
    )


def _search_single(
    query: str,
    location: str | None,
    remote_only: bool,
    salary_min: int | None,
    salary_max: int | None,
    page: int,
    per_page: int,
    adzuna_country: str,
    app_id: str,
    api_key: str,
) -> list[dict[str, Any]]:
    what = query.strip()
    if remote_only:
        what = f"{what} remote"

    params = {
        "app_id": app_id,
        "app_key": api_key,
        "results_per_page": max(1, per_page),
        "what": what,
        "content-type": "application/json",
    }
    if location:
        params["where"] = location.strip()
    if salary_min is not None:
        params["salary_min"] = salary_min
    if salary_max is not None:
        params["salary_max"] = salary_max

    url = (
        f"https://api.adzuna.com/v1/api/jobs/{adzuna_country}/search/{max(1, page)}?"
        f"{urllib.parse.urlencode(params)}"
    )

    payload = http_get_json(url)
    raw_jobs = payload.get("results") or []
    normalized: list[dict[str, Any]] = []

    for item in raw_jobs:
        location_text = ((item.get("location") or {}).get("display_name")) or ""
        description = item.get("description") or ""
        company = ((item.get("company") or {}).get("display_name")) or ""

        normalized.append(
            {
                "external_id": item.get("id"),
                "source": "adzuna",
                "title": (item.get("title") or "").strip(),
                "company": company.strip(),
                "location": location_text,
                "remote_type": infer_remote_type(
                    explicit_remote=None,
                    text_chunks=[item.get("title"), description, location_text],
                ),
                "salary_min": to_int(item.get("salary_min")),
                "salary_max": to_int(item.get("salary_max")),
                "description": description,
                "url": item.get("redirect_url"),
            }
        )

    return normalized
