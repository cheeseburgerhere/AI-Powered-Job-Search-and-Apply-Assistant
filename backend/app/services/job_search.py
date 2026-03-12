import json
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from app.config import get_settings


class JobSearchService:
    """Fetch and normalize jobs from external providers."""

    SUPPORTED_SOURCES = {"jsearch", "adzuna"}

    def __init__(self):
        self.settings = get_settings()

    def configured_sources(self) -> list[str]:
        sources: list[str] = []
        if self._is_real_secret(self.settings.jsearch_api_key):
            sources.append("jsearch")
        if self._is_real_secret(self.settings.adzuna_app_id) and self._is_real_secret(self.settings.adzuna_api_key):
            sources.append("adzuna")
        return sources

    def search_jobs(
        self,
        query: str,
        location: str | None,
        remote_only: bool,
        salary_min: int | None,
        salary_max: int | None,
        page: int,
        per_page: int,
        sources: list[str] | None,
        country: str | None,
    ) -> dict[str, Any]:
        requested_sources = [s.lower().strip() for s in (sources or self.configured_sources()) if s]
        requested_sources = [s for s in requested_sources if s in self.SUPPORTED_SOURCES]

        if not requested_sources:
            return {
                "jobs": [],
                "errors": ["No job provider configured. Set JSEARCH_API_KEY and/or ADZUNA_APP_ID + ADZUNA_API_KEY."],
                "sources": [],
            }

        all_jobs: list[dict[str, Any]] = []
        errors: list[str] = []

        if "jsearch" in requested_sources:
            try:
                all_jobs.extend(self._search_jsearch(query, location, remote_only, page))
            except Exception as exc:
                errors.append(f"jsearch: {exc}")

        if "adzuna" in requested_sources:
            try:
                all_jobs.extend(self._search_adzuna(query, location, remote_only, salary_min, salary_max, page, per_page, country))
            except Exception as exc:
                errors.append(f"adzuna: {exc}")

        filtered = self._apply_filters(all_jobs, remote_only=remote_only, salary_min=salary_min, salary_max=salary_max)
        deduped = self._dedupe(filtered)

        return {
            "jobs": deduped[: max(1, per_page)],
            "errors": errors,
            "sources": requested_sources,
        }

    def _search_jsearch(self, query: str, location: str | None, remote_only: bool, page: int) -> list[dict[str, Any]]:
        if not self._is_real_secret(self.settings.jsearch_api_key):
            raise RuntimeError("JSEARCH_API_KEY is not configured")

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
            "X-RapidAPI-Key": self.settings.jsearch_api_key,
            "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
        }

        payload = self._http_get_json(url, headers)
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
                    "remote_type": self._infer_remote_type(
                        explicit_remote=item.get("job_is_remote"),
                        text_chunks=[item.get("job_title"), description, location_text],
                    ),
                    "salary_min": self._to_int(item.get("job_min_salary")),
                    "salary_max": self._to_int(item.get("job_max_salary")),
                    "description": description,
                    "url": item.get("job_apply_link"),
                }
            )

        return normalized

    def _search_adzuna(
        self,
        query: str,
        location: str | None,
        remote_only: bool,
        salary_min: int | None,
        salary_max: int | None,
        page: int,
        per_page: int,
        country: str | None,
    ) -> list[dict[str, Any]]:
        if not (self._is_real_secret(self.settings.adzuna_app_id) and self._is_real_secret(self.settings.adzuna_api_key)):
            raise RuntimeError("ADZUNA_APP_ID / ADZUNA_API_KEY are not configured")

        adzuna_country = (country or "us").lower().strip()
        what = query.strip()
        if remote_only:
            what = f"{what} remote"

        params = {
            "app_id": self.settings.adzuna_app_id,
            "app_key": self.settings.adzuna_api_key,
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

        payload = self._http_get_json(url)
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
                    "remote_type": self._infer_remote_type(
                        explicit_remote=None,
                        text_chunks=[item.get("title"), description, location_text],
                    ),
                    "salary_min": self._to_int(item.get("salary_min")),
                    "salary_max": self._to_int(item.get("salary_max")),
                    "description": description,
                    "url": item.get("redirect_url"),
                }
            )

        return normalized

    def _apply_filters(
        self,
        jobs: list[dict[str, Any]],
        remote_only: bool,
        salary_min: int | None,
        salary_max: int | None,
    ) -> list[dict[str, Any]]:
        filtered: list[dict[str, Any]] = []

        for job in jobs:
            if remote_only and job.get("remote_type") != "remote":
                continue

            job_min = job.get("salary_min")
            job_max = job.get("salary_max")

            # Drop listings clearly below requested range.
            if salary_min is not None and job_max is not None and job_max < salary_min:
                continue
            if salary_max is not None and job_min is not None and job_min > salary_max:
                continue

            if not job.get("title") or not job.get("company"):
                continue

            filtered.append(job)

        return filtered

    def _dedupe(self, jobs: list[dict[str, Any]]) -> list[dict[str, Any]]:
        deduped: dict[str, dict[str, Any]] = {}

        for job in jobs:
            external_id = (job.get("external_id") or "").strip().lower()
            source = (job.get("source") or "").strip().lower()
            title = (job.get("title") or "").strip().lower()
            company = (job.get("company") or "").strip().lower()
            location = (job.get("location") or "").strip().lower()

            if external_id and source:
                key = f"{source}:{external_id}"
            else:
                key = f"{title}|{company}|{location}"

            existing = deduped.get(key)
            if not existing:
                deduped[key] = job
                continue

            # Keep the richer record when duplicates occur.
            existing_desc_len = len(existing.get("description") or "")
            new_desc_len = len(job.get("description") or "")
            existing_has_salary = existing.get("salary_min") is not None or existing.get("salary_max") is not None
            new_has_salary = job.get("salary_min") is not None or job.get("salary_max") is not None

            if (new_desc_len > existing_desc_len) or (new_has_salary and not existing_has_salary):
                deduped[key] = job

        return list(deduped.values())

    def _infer_remote_type(self, explicit_remote: Any, text_chunks: list[Any]) -> str:
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

    def _http_get_json(self, url: str, headers: dict[str, str] | None = None) -> dict[str, Any]:
        request = urllib.request.Request(url=url, headers=headers or {}, method="GET")
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                body = response.read().decode("utf-8")
                return json.loads(body)
        except urllib.error.HTTPError as exc:
            details = exc.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"HTTP {exc.code}: {details[:300]}") from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Network error: {exc.reason}") from exc

    def _to_int(self, value: Any) -> int | None:
        if value is None:
            return None
        try:
            return int(float(value))
        except (TypeError, ValueError):
            return None

    def _is_real_secret(self, value: str | None) -> bool:
        if not value:
            return False
        raw = value.strip()
        if not raw:
            return False
        lowered = raw.lower()
        placeholder_markers = [
            "your-",
            "your_",
            "xxxxx",
            "example",
            "replace-me",
            "changeme",
        ]
        return not any(marker in lowered for marker in placeholder_markers)
