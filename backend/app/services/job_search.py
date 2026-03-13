import hashlib
import json
import re
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from app.config import get_settings


class JobSearchService:
    """Fetch and normalize jobs from external providers."""

    SUPPORTED_SOURCES = {"jsearch", "adzuna", "google_scrape"}

    # Job board sites to search via Google scraping.
    # Each entry: (site domain for Google site: query, readable label, URL parser function name)
    DEFAULT_SCRAPE_SITES = [
        "boards.greenhouse.io",
        "jobs.lever.co",
        "jobs.ashbyhq.com",
    ]

    def __init__(self):
        self.settings = get_settings()

    def configured_sources(self) -> list[str]:
        sources: list[str] = []
        if self._is_real_secret(self.settings.jsearch_api_key):
            sources.append("jsearch")
        if self._is_real_secret(self.settings.adzuna_app_id) and self._is_real_secret(self.settings.adzuna_api_key):
            sources.append("adzuna")
        if self._is_real_secret(self.settings.google_api_key) and self._is_real_secret(self.settings.google_cse_id):
            sources.append("google_scrape")
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
        scrape_sites: list[str] | None = None,
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

        if "google_scrape" in requested_sources:
            try:
                all_jobs.extend(self._search_google_scrape(query, location, remote_only, per_page, scrape_sites))
            except Exception as exc:
                errors.append(f"google_scrape: {exc}")

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

    # European country codes supported by Adzuna
    EUROPE_COUNTRIES = ["gb", "de", "fr", "nl", "pl", "it", "es", "at", "be", "ch"]

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

        adzuna_country = (country or "europe").lower().strip()

        # Fan out across all European countries and merge
        if adzuna_country == "europe":
            all_results: list[dict[str, Any]] = []
            per_country = max(1, per_page // len(self.EUROPE_COUNTRIES))
            for code in self.EUROPE_COUNTRIES:
                try:
                    all_results.extend(
                        self._search_adzuna_single(
                            query, location, remote_only, salary_min, salary_max, page, per_country, code
                        )
                    )
                except Exception:
                    pass  # skip countries that error
            return all_results

        return self._search_adzuna_single(
            query, location, remote_only, salary_min, salary_max, page, per_page, adzuna_country
        )

    def _search_adzuna_single(
        self,
        query: str,
        location: str | None,
        remote_only: bool,
        salary_min: int | None,
        salary_max: int | None,
        page: int,
        per_page: int,
        adzuna_country: str,
    ) -> list[dict[str, Any]]:
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

    # ---- Google CSE-based search ----

    _CSE_ENDPOINT = "https://www.googleapis.com/customsearch/v1"

    def _search_google_scrape(
        self,
        query: str,
        location: str | None,
        remote_only: bool,
        per_page: int,
        sites: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        """Use Google Custom Search Engine API to find jobs on known ATS boards."""
        if not self._is_real_secret(self.settings.google_api_key) or not self._is_real_secret(self.settings.google_cse_id):
            raise RuntimeError(
                "Google CSE not configured. Set GOOGLE_API_KEY and GOOGLE_CSE_ID in .env."
            )

        target_sites = sites or self.DEFAULT_SCRAPE_SITES
        all_jobs: list[dict[str, Any]] = []
        seen_urls: set[str] = set()
        site_errors: list[str] = []

        for site in target_sites:
            try:
                items = self._cse_site_search(site, query, location, remote_only, min(per_page, 10))
                for item in items:
                    url = item.get("link", "")
                    if not url or url in seen_urls:
                        continue
                    seen_urls.add(url)
                    title = item.get("title", "")
                    snippet = item.get("snippet", "")
                    parsed = self._parse_job_board_url(url, site, snippet, cse_title=title)
                    if parsed:
                        all_jobs.append(parsed)
            except Exception as exc:
                site_errors.append(f"{site}: {exc}")

        if not all_jobs and site_errors:
            raise RuntimeError("; ".join(site_errors))

        return all_jobs

    def _cse_site_search(
        self,
        site: str,
        query: str,
        location: str | None,
        remote_only: bool,
        num: int,
    ) -> list[dict[str, Any]]:
        """Run a single Google CSE query and return raw result items."""
        search_query = f'site:{site} "{query}"'
        if location:
            search_query += f" {location}"
        if remote_only:
            search_query += " remote"

        params = {
            "key": self.settings.google_api_key,
            "cx": self.settings.google_cse_id,
            "q": search_query,
            "num": max(1, min(num, 10)),  # CSE hard limit: 10 per call
        }
        url = f"{self._CSE_ENDPOINT}?{urllib.parse.urlencode(params)}"
        data = self._http_get_json(url)
        return data.get("items", [])

    def _parse_job_board_url(
        self, url: str, site: str, snippet: str, cse_title: str = ""
    ) -> dict[str, Any] | None:
        """Parse a job board URL into a normalized job dict.

        Greenhouse: https://boards.greenhouse.io/{company}/jobs/{id}
        Lever:      https://jobs.lever.co/{company}/{id}
        Ashby:      https://jobs.ashbyhq.com/{company}/jobs/{slug}
        """
        parsed = urllib.parse.urlparse(url)
        path_parts = [p for p in parsed.path.strip("/").split("/") if p]

        if not path_parts:
            return None

        company = ""
        title = ""
        external_id = ""

        if site == "boards.greenhouse.io":
            company = path_parts[0] if len(path_parts) >= 1 else ""
            external_id = path_parts[2] if len(path_parts) >= 3 else ""
            title = cse_title or self._title_from_snippet(snippet, company)

        elif site == "jobs.lever.co":
            company = path_parts[0] if len(path_parts) >= 1 else ""
            external_id = path_parts[1] if len(path_parts) >= 2 else ""
            title = cse_title or self._title_from_snippet(snippet, company)

        elif site == "jobs.ashbyhq.com":
            company = path_parts[0] if len(path_parts) >= 1 else ""
            slug = path_parts[-1] if len(path_parts) >= 2 else ""
            external_id = slug
            title = cse_title or slug.replace("-", " ").title() or self._title_from_snippet(snippet, company)

        else:
            company = path_parts[0] if path_parts else ""
            external_id = path_parts[-1] if len(path_parts) >= 2 else ""
            title = cse_title or self._title_from_snippet(snippet, company)

        if not company and not title:
            return None

        display_company = company.replace("-", " ").replace("_", " ").title()

        if not external_id:
            external_id = hashlib.md5(url.encode()).hexdigest()[:12]

        return {
            "external_id": f"{site}:{external_id}",
            "source": "google_scrape",
            "title": title or "Open Position",
            "company": display_company,
            "location": "",
            "remote_type": self._infer_remote_type(
                explicit_remote=None,
                text_chunks=[title, snippet],
            ),
            "salary_min": None,
            "salary_max": None,
            "description": snippet,
            "url": url,
        }

    def _title_from_snippet(self, snippet: str, company: str) -> str:
        """Try to extract a job title from a Google snippet.

        Google snippets for job boards often start with the job title.
        Common patterns:
          - "Senior Engineer at Company - ..."
          - "Senior Engineer - Company"
          - "Company: Senior Engineer"
        """
        if not snippet:
            return ""

        text = snippet.strip()

        # Pattern: "Title at Company" or "Title - Company"
        # Try splitting on common separators
        for sep in [" at ", " - ", " | ", " — ", " – ", ": "]:
            if sep in text:
                parts = text.split(sep, 1)
                candidate = parts[0].strip()
                # If it's reasonably short and doesn't look like a URL, use it
                if 3 < len(candidate) < 100 and "http" not in candidate.lower():
                    return candidate

        # Fallback: use the first sentence-like chunk
        first_chunk = re.split(r"[.!?\n]", text)[0].strip()
        if 3 < len(first_chunk) < 100:
            return first_chunk

        return ""

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
            # Try to extract a clean message from JSON error bodies
            try:
                err_json = json.loads(details)
                msg = (
                    err_json.get("error", {}).get("message")
                    or err_json.get("message")
                    or err_json.get("error")
                )
                if msg:
                    raise RuntimeError(f"HTTP {exc.code}: {msg}") from exc
            except (json.JSONDecodeError, AttributeError):
                pass
            raise RuntimeError(f"HTTP {exc.code}: {details[:200]}") from exc
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
