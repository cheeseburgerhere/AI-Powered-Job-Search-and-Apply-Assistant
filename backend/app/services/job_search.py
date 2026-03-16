"""Orchestrator: delegates job search to individual provider modules."""

from typing import Any

from app.config import get_settings
from app.services.helpers import is_real_secret
from app.services.providers.jsearch import search_jsearch
from app.services.providers.adzuna import search_adzuna
from app.services.providers.brave import search_brave
from app.services.providers.greenhouse import search_greenhouse
from app.services.providers.lever import search_lever
from app.services.providers.ashby import search_ashby


class JobSearchService:
    """Fetch and normalize jobs from external providers."""

    SUPPORTED_SOURCES = {"jsearch", "adzuna", "brave_scrape", "greenhouse", "lever", "ashby"}

    def __init__(self):
        self.settings = get_settings()

    def configured_sources(self) -> list[str]:
        sources: list[str] = ["greenhouse", "lever", "ashby"]  # always available (no API keys)
        if is_real_secret(self.settings.jsearch_api_key):
            sources.append("jsearch")
        if is_real_secret(self.settings.adzuna_app_id) and is_real_secret(self.settings.adzuna_api_key):
            sources.append("adzuna")
        if is_real_secret(self.settings.brave_api_key):
            sources.append("brave_scrape")
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
        company_slugs: list[str] | None = None,
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

        # --- Aggregator APIs ---

        if "jsearch" in requested_sources:
            try:
                all_jobs.extend(
                    search_jsearch(query, location, remote_only, page, self.settings.jsearch_api_key)
                )
            except Exception as exc:
                errors.append(f"jsearch: {exc}")

        if "adzuna" in requested_sources:
            try:
                all_jobs.extend(
                    search_adzuna(
                        query, location, remote_only, salary_min, salary_max,
                        page, per_page, country,
                        self.settings.adzuna_app_id, self.settings.adzuna_api_key,
                    )
                )
            except Exception as exc:
                errors.append(f"adzuna: {exc}")

        # --- Brave web discovery ---

        if "brave_scrape" in requested_sources:
            try:
                all_jobs.extend(
                    search_brave(query, location, remote_only, per_page, self.settings.brave_api_key, scrape_sites)
                )
            except Exception as exc:
                errors.append(f"brave_scrape: {exc}")

        # --- Direct ATS board APIs ---

        if "greenhouse" in requested_sources and company_slugs:
            try:
                all_jobs.extend(search_greenhouse(query, company_slugs, location, remote_only, per_page))
            except Exception as exc:
                errors.append(f"greenhouse: {exc}")

        if "lever" in requested_sources and company_slugs:
            try:
                all_jobs.extend(search_lever(query, company_slugs, location, remote_only, per_page))
            except Exception as exc:
                errors.append(f"lever: {exc}")

        if "ashby" in requested_sources and company_slugs:
            try:
                all_jobs.extend(search_ashby(query, company_slugs, location, remote_only, per_page))
            except Exception as exc:
                errors.append(f"ashby: {exc}")

        filtered = self._apply_filters(all_jobs, remote_only=remote_only, salary_min=salary_min, salary_max=salary_max)
        deduped = self._dedupe(filtered)

        return {
            "jobs": deduped[: max(1, per_page)],
            "errors": errors,
            "sources": requested_sources,
        }

    # ---- Shared post-processing ----

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

            existing_desc_len = len(existing.get("description") or "")
            new_desc_len = len(job.get("description") or "")
            existing_has_salary = existing.get("salary_min") is not None or existing.get("salary_max") is not None
            new_has_salary = job.get("salary_min") is not None or job.get("salary_max") is not None

            if (new_desc_len > existing_desc_len) or (new_has_salary and not existing_has_salary):
                deduped[key] = job

        return list(deduped.values())
