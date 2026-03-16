from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime, timedelta, timezone

from app.database import get_db
from app.models.job import Job
from app.models.tracker import TrackerEvent
from app.schemas.job import JobCreate, JobUpdate, JobResponse, JobSearchRequest
from app.services.resume_parser import profile_to_text
from app.services.ai_service import get_ai_service
from app.services.job_search import JobSearchService
from app.models.profile import Profile

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


def _format_fit_reasoning(result: dict) -> str:
    top_reasons = result.get("top_reasons", []) or []
    gaps = result.get("gaps", []) or []
    summary = result.get("summary", "") or ""
    return (
        f"Match reasons: {', '.join(top_reasons)}\n"
        f"Gaps: {', '.join(gaps)}\n"
        f"{summary}"
    )


def _find_existing_discovery_job(db: Session, source: str, external_id: str | None, title: str, company: str, url: str | None) -> Job | None:
    if external_id:
        existing = (
            db.query(Job)
            .filter(and_(Job.source == source, Job.external_id == external_id))
            .first()
        )
        if existing:
            return existing

    if title and company:
        query = db.query(Job).filter(and_(Job.title == title, Job.company == company))
        if url:
            query = query.filter(Job.url == url)
        return query.first()

    return None


@router.get("", response_model=list[JobResponse])
def list_jobs(status: str | None = None, db: Session = Depends(get_db)):
    query = db.query(Job)
    if status:
        query = query.filter(Job.status == status)
    return query.order_by(Job.created_at.desc()).all()


@router.post("", response_model=JobResponse)
def create_job(job_data: JobCreate, db: Session = Depends(get_db)):
    job = Job(
        title=job_data.title,
        company=job_data.company,
        description=job_data.description,
        url=job_data.url,
        location=job_data.location or "",
        remote_type=job_data.remote_type or "",
        salary_min=job_data.salary_min,
        salary_max=job_data.salary_max,
        source="manual",
        status="interested",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Create initial tracker event
    event = TrackerEvent(job_id=job.id, from_status="", to_status="interested")
    db.add(event)
    db.commit()
    return job


@router.get("/nudges", response_model=list[JobResponse])
def get_nudges(db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    jobs = (
        db.query(Job)
        .filter(Job.status == "applied", Job.next_follow_up <= now)
        .order_by(Job.next_follow_up.asc())
        .all()
    )
    return jobs


@router.get("/providers/health")
def job_provider_health(query: str = "software engineer", country: str = "us"):
    """Quick diagnostic endpoint to confirm external job providers are reachable and returning data."""
    service = JobSearchService()
    configured = set(service.configured_sources())

    checks = {}
    for source in ["jsearch", "adzuna", "brave_scrape", "greenhouse", "lever", "ashby"]:
        if source not in configured:
            checks[source] = {
                "status": "not_configured",
                "sample_count": 0,
                "error": None,
            }
            continue

        result = service.search_jobs(
            query=query,
            location=None,
            remote_only=False,
            salary_min=None,
            salary_max=None,
            page=1,
            per_page=5,
            sources=[source],
            country=country,
        )
        errors = result.get("errors", [])
        checks[source] = {
            "status": "ok" if not errors else "error",
            "sample_count": len(result.get("jobs", [])),
            "error": errors[0] if errors else None,
        }

    return {
        "query": query,
        "country": country,
        "checks": checks,
    }


@router.post("/search", response_model=list[JobResponse])
def search_jobs(req: JobSearchRequest, db: Session = Depends(get_db)):
    profile = db.query(Profile).first()
    prefs = (profile.preferences or {}) if profile else {}

    pref_roles = prefs.get("roles") or []
    pref_locations = prefs.get("locations") or []

    explicit_query = bool((req.query or "").strip())

    query = (req.query or "").strip() or (pref_roles[0].strip() if pref_roles else "")
    if not query:
        raise HTTPException(
            status_code=400,
            detail="Missing search query. Provide query in request or set profile.preferences.roles.",
        )

    if explicit_query:
        # If caller provides a query, do not silently apply restrictive profile defaults.
        location = (req.location or "").strip() or None
        remote_only = bool(req.remote_only) if req.remote_only is not None else False
        salary_min = req.salary_min
        salary_max = req.salary_max
    else:
        # Profile-driven search mode (query comes from preferences).
        location = (req.location or "").strip() or (pref_locations[0].strip() if pref_locations else None)
        remote_only = req.remote_only if req.remote_only is not None else bool(prefs.get("remote", False))
        salary_min = req.salary_min if req.salary_min is not None else prefs.get("salary_min")
        salary_max = req.salary_max if req.salary_max is not None else prefs.get("salary_max")

    search_service = JobSearchService()
    search_result = search_service.search_jobs(
        query=query,
        location=location,
        remote_only=remote_only,
        salary_min=salary_min,
        salary_max=salary_max,
        page=max(1, req.page),
        per_page=max(1, min(req.per_page, 100)),
        sources=req.sources,
        country=req.country,
        scrape_sites=req.scrape_sites,
    )

    discovered_jobs = search_result.get("jobs", [])
    errors = search_result.get("errors", [])

    if not discovered_jobs:
        if errors:
            raise HTTPException(status_code=502, detail="; ".join(errors))
        return []

    ai = get_ai_service() if (req.score_results and profile) else None
    profile_text = profile_to_text(profile) if (req.score_results and profile) else ""
    max_scored = max(0, req.max_scored_jobs)
    scored_count = 0

    persisted: list[Job] = []
    for item in discovered_jobs:
        source = (item.get("source") or "").strip() or "unknown"
        external_id = item.get("external_id")
        title = (item.get("title") or "").strip()
        company = (item.get("company") or "").strip()
        url = item.get("url")

        existing = _find_existing_discovery_job(db, source, external_id, title, company, url)
        if existing:
            job = existing
            job.title = title or job.title
            job.company = company or job.company
            job.location = item.get("location") or job.location
            job.remote_type = item.get("remote_type") or job.remote_type
            job.salary_min = item.get("salary_min") if item.get("salary_min") is not None else job.salary_min
            job.salary_max = item.get("salary_max") if item.get("salary_max") is not None else job.salary_max
            job.description = item.get("description") or job.description
            job.url = url or job.url
            job.external_id = external_id or job.external_id
            job.source = source or job.source
            job.link_type = item.get("link_type") or job.link_type
            if not job.status:
                job.status = "discovered"
        else:
            job = Job(
                external_id=external_id,
                source=source,
                title=title,
                company=company,
                location=item.get("location") or "",
                remote_type=item.get("remote_type") or "",
                salary_min=item.get("salary_min"),
                salary_max=item.get("salary_max"),
                description=item.get("description") or "",
                url=url,
                link_type=item.get("link_type"),
                status="discovered",
            )
            db.add(job)

        if ai and scored_count < max_scored and (job.description or "").strip():
            try:
                score_result = ai.score_fit(profile_text, job.description)
                job.fit_score = float(score_result.get("score", 0))
                job.fit_reasoning = _format_fit_reasoning(score_result)
                scored_count += 1
            except Exception as exc:
                if not job.fit_reasoning:
                    job.fit_reasoning = f"Scoring failed: {exc}"

        persisted.append(job)

    db.commit()
    for job in persisted:
        db.refresh(job)

    if req.min_fit_score is not None:
        scored_jobs = [j for j in persisted if j.fit_score is not None]
        # Only enforce min fit when scoring was actually produced.
        if scored_jobs:
            persisted = [j for j in scored_jobs if j.fit_score >= req.min_fit_score]

    persisted.sort(key=lambda j: (j.fit_score is not None, j.fit_score if j.fit_score is not None else -1), reverse=True)
    return persisted[: max(1, min(req.per_page, 100))]


@router.get("/{job_id}", response_model=JobResponse)
def get_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.put("/{job_id}", response_model=JobResponse)
def update_job(job_id: int, update: JobUpdate, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    old_status = job.status
    update_data = update.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        setattr(job, key, value)

    # Track status change
    new_status = update_data.get("status")
    if new_status and new_status != old_status:
        event = TrackerEvent(job_id=job.id, from_status=old_status, to_status=new_status)
        db.add(event)

        # Auto-set date_applied and follow-up
        if new_status == "applied" and not job.date_applied:
            job.date_applied = datetime.now(timezone.utc)
            if not job.next_follow_up:
                job.next_follow_up = datetime.now(timezone.utc) + timedelta(days=14)

    db.commit()
    db.refresh(job)
    return job


@router.delete("/{job_id}")
def delete_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    db.delete(job)
    db.commit()
    return {"ok": True}


@router.post("/{job_id}/score", response_model=JobResponse)
def score_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    profile = db.query(Profile).first()
    if not profile:
        raise HTTPException(status_code=400, detail="Create a profile first")

    profile_text = profile_to_text(profile)
    ai = get_ai_service()
    result = ai.score_fit(profile_text, job.description)

    job.fit_score = result.get("score", 0)
    job.fit_reasoning = (
        f"Match reasons: {', '.join(result.get('top_reasons', []))}\n"
        f"Gaps: {', '.join(result.get('gaps', []))}\n"
        f"{result.get('summary', '')}"
    )
    db.commit()
    db.refresh(job)
    return job
