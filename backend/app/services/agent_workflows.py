from datetime import datetime, timedelta, timezone

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.models.cover_letter import CoverLetter
from app.models.job import Job
from app.models.profile import Profile
from app.models.tracker import TrackerEvent
from app.schemas.job import JobSearchRequest
from app.services.ai_service import get_ai_service
from app.services.job_search import JobSearchService
from app.services.resume_parser import profile_to_text


ALLOWED_JOB_STATUSES = {
    "discovered",
    "interested",
    "applied",
    "follow_up",
    "interview",
    "offer",
    "rejected",
}
ALLOWED_PRIORITIES = {"", "low", "medium", "high", "top"}


class SearchProviderError(RuntimeError):
    pass


def _format_fit_reasoning(result: dict) -> str:
    return (
        f"Match reasons: {', '.join(result.get('top_reasons', []) or [])}\n"
        f"Gaps: {', '.join(result.get('gaps', []) or [])}\n"
        f"{result.get('summary', '') or ''}"
    ).strip()


def apply_fit_result(job: Job, result: dict) -> None:
    """Store a fit result as structured analysis plus the legacy reasoning text."""
    reasons = [str(item).strip() for item in (result.get("top_reasons") or []) if str(item).strip()]
    gaps = [str(item).strip() for item in (result.get("gaps") or []) if str(item).strip()]
    summary = str(result.get("summary") or "").strip()
    job.fit_score = float(result.get("score", 0))
    job.fit_analysis = {"reasons": reasons, "gaps": gaps, "summary": summary}
    job.fit_reasoning = _format_fit_reasoning({"top_reasons": reasons, "gaps": gaps, "summary": summary})


def _find_existing_job(db: Session, item: dict) -> Job | None:
    source = (item.get("source") or "").strip() or "unknown"
    external_id = item.get("external_id")
    if external_id:
        existing = db.query(Job).filter(and_(Job.source == source, Job.external_id == external_id)).first()
        if existing:
            return existing

    title = (item.get("title") or "").strip()
    company = (item.get("company") or "").strip()
    if title and company:
        query = db.query(Job).filter(and_(Job.title == title, Job.company == company))
        if item.get("url"):
            query = query.filter(Job.url == item["url"])
        return query.first()
    return None


def search_and_persist_jobs(
    db: Session,
    request: JobSearchRequest,
    *,
    allow_server_ai: bool = True,
) -> tuple[list[Job], list[str]]:
    """Search providers and persist normalized jobs for both HTTP and MCP callers."""
    profile = db.query(Profile).first()
    preferences = (profile.preferences or {}) if profile else {}
    preferred_roles = preferences.get("roles") or []
    preferred_locations = preferences.get("locations") or []

    explicit_query = bool((request.query or "").strip())
    query = (request.query or "").strip() or (preferred_roles[0].strip() if preferred_roles else "")
    if not query:
        raise ValueError("Provide a search query or set profile.preferences.roles.")

    if explicit_query:
        location = (request.location or "").strip() or None
        remote_only = bool(request.remote_only) if request.remote_only is not None else False
        salary_min = request.salary_min
        salary_max = request.salary_max
    else:
        location = (request.location or "").strip() or (
            preferred_locations[0].strip() if preferred_locations else None
        )
        remote_only = request.remote_only if request.remote_only is not None else bool(preferences.get("remote", False))
        salary_min = request.salary_min if request.salary_min is not None else preferences.get("salary_min")
        salary_max = request.salary_max if request.salary_max is not None else preferences.get("salary_max")

    result = JobSearchService().search_jobs(
        query=query,
        location=location,
        remote_only=remote_only,
        salary_min=salary_min,
        salary_max=salary_max,
        page=max(1, request.page),
        per_page=max(1, min(request.per_page, 100)),
        sources=request.sources,
        country=request.country,
        scrape_sites=request.scrape_sites,
        company_slugs=request.company_slugs,
    )
    discovered = result.get("jobs", [])
    errors = result.get("errors", [])
    if not discovered:
        if errors:
            raise SearchProviderError("; ".join(errors))
        return [], []

    ai = get_ai_service() if allow_server_ai and request.score_results and profile else None
    profile_text = profile_to_text(profile) if ai and profile else ""
    scored_count = 0
    jobs: list[Job] = []

    for item in discovered:
        job = _find_existing_job(db, item)
        if job is None:
            job = Job(status="discovered")
            db.add(job)

        for field in (
            "external_id",
            "title",
            "company",
            "location",
            "remote_type",
            "salary_min",
            "salary_max",
            "description",
            "url",
            "link_type",
        ):
            value = item.get(field)
            if value is not None and (not isinstance(value, str) or value.strip()):
                setattr(job, field, value.strip() if isinstance(value, str) else value)
        job.source = (item.get("source") or "").strip() or job.source or "unknown"

        if ai and scored_count < max(0, request.max_scored_jobs) and (job.description or "").strip():
            try:
                apply_fit_result(job, ai.score_fit(profile_text, job.description))
                scored_count += 1
            except Exception as exc:
                if not job.fit_reasoning:
                    job.fit_reasoning = f"Scoring failed: {exc}"
        jobs.append(job)

    db.commit()
    for job in jobs:
        db.refresh(job)

    if request.min_fit_score is not None and any(job.fit_score is not None for job in jobs):
        jobs = [job for job in jobs if job.fit_score is not None and job.fit_score >= request.min_fit_score]
    jobs.sort(
        key=lambda job: (job.fit_score is not None, job.fit_score if job.fit_score is not None else -1),
        reverse=True,
    )
    return jobs[: max(1, min(request.per_page, 100))], errors


def record_job_analysis(
    db: Session,
    job_id: int,
    *,
    fit_score: float,
    category: str,
    priority: str,
    match_reasons: list[str],
    gaps: list[str],
    summary: str,
) -> Job:
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise LookupError("Job not found")
    if not 0 <= fit_score <= 10:
        raise ValueError("fit_score must be between 0 and 10")

    normalized_priority = priority.strip().lower()
    if normalized_priority not in ALLOWED_PRIORITIES:
        raise ValueError("priority must be low, medium, high, or top")

    apply_fit_result(job, {"score": fit_score, "top_reasons": match_reasons, "gaps": gaps, "summary": summary})
    job.category = category.strip()
    job.priority = normalized_priority
    db.commit()
    db.refresh(job)
    return job


def set_job_status(db: Session, job: Job, status: str) -> Job:
    normalized = status.strip().lower()
    if normalized not in ALLOWED_JOB_STATUSES:
        raise ValueError(f"status must be one of: {', '.join(sorted(ALLOWED_JOB_STATUSES))}")
    if normalized == job.status:
        return job

    previous = job.status or ""
    job.status = normalized
    db.add(TrackerEvent(job_id=job.id, from_status=previous, to_status=normalized))
    if normalized == "applied" and not job.date_applied:
        job.date_applied = datetime.now(timezone.utc)
        if not job.next_follow_up:
            job.next_follow_up = datetime.now(timezone.utc) + timedelta(days=14)
    return job


def save_cover_letter_version(
    db: Session,
    job_id: int,
    content: str,
    *,
    feedback: str = "Agent-authored draft",
    status: str = "draft",
) -> CoverLetter:
    if not db.query(Job).filter(Job.id == job_id).first():
        raise LookupError("Job not found")
    if not content.strip():
        raise ValueError("Cover letter content cannot be empty")
    if status not in {"draft", "ready"}:
        raise ValueError("status must be draft or ready")

    latest = (
        db.query(CoverLetter)
        .filter(CoverLetter.job_id == job_id)
        .order_by(CoverLetter.version.desc())
        .first()
    )
    letter = CoverLetter(
        job_id=job_id,
        version=(latest.version + 1) if latest else 1,
        content=content.strip(),
        feedback=feedback.strip() or None,
        status=status,
    )
    db.add(letter)
    db.commit()
    db.refresh(letter)
    return letter
