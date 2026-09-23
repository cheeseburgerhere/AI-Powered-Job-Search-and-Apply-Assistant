from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.cover_letter import LETTER_SOURCES
from app.models.job import Job
from app.models.tracker import TrackerEvent
from app.schemas.job import JobCreate, JobUpdate, JobResponse, JobSearchRequest
from app.services.resume_parser import profile_to_text
from app.services.ai_service import get_ai_service
from app.services.job_search import JobSearchService
from app.services.agent_workflows import (
    SearchProviderError,
    apply_fit_result,
    search_and_persist_jobs,
    set_job_status,
)
from app.models.profile import Profile

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


def _letter_source(value: str | None) -> str:
    source = (value or "").strip().lower()
    if source not in LETTER_SOURCES:
        raise HTTPException(status_code=400, detail="cover_letter_source must be agent, server or manual")
    return source


@router.get("", response_model=list[JobResponse])
def list_jobs(status: str | None = None, db: Session = Depends(get_db)):
    query = db.query(Job)
    if status:
        query = query.filter(Job.status == status)
    return query.order_by(Job.created_at.desc()).all()


@router.post("", response_model=JobResponse)
def create_job(job_data: JobCreate, db: Session = Depends(get_db)):
    letter_source = _letter_source(job_data.cover_letter_source)
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
        status=job_data.status or "interested",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Create initial tracker event
    event = TrackerEvent(job_id=job.id, from_status="", to_status=job.status)
    db.add(event)
    db.commit()

    # Save cover letter if provided
    if job_data.cover_letter:
        from app.models.cover_letter import CoverLetter
        letter = CoverLetter(
            job_id=job.id,
            version=1,
            content=job_data.cover_letter,
            status="draft",
            source=letter_source,
        )
        db.add(letter)
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
    try:
        jobs, _ = search_and_persist_jobs(db, req)
        return jobs
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except SearchProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


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

    update_data = update.model_dump(exclude_unset=True)

    cover_letter_text = update_data.pop("cover_letter", None)
    letter_source = _letter_source(update_data.pop("cover_letter_source", None))
    new_status = update_data.pop("status", None)

    for key, value in update_data.items():
        setattr(job, key, value)

    if new_status:
        try:
            set_job_status(db, job, new_status)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    if cover_letter_text:
        from app.models.cover_letter import CoverLetter

        latest_letter = (
            db.query(CoverLetter)
            .filter(CoverLetter.job_id == job.id)
            .order_by(CoverLetter.version.desc())
            .first()
        )
        next_version = (latest_letter.version + 1) if latest_letter else 1
        letter = CoverLetter(
            job_id=job.id,
            version=next_version,
            content=cover_letter_text,
            status="draft",
            source=letter_source,
        )
        db.add(letter)

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
    apply_fit_result(job, ai.score_fit(profile_text, job.description))
    db.commit()
    db.refresh(job)
    return job
