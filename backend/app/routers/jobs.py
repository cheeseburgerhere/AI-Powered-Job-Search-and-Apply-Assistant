from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone

from app.database import get_db
from app.models.job import Job
from app.models.tracker import TrackerEvent
from app.schemas.job import JobCreate, JobUpdate, JobResponse
from app.services.resume_parser import profile_to_text
from app.services.ai_service import get_ai_service
from app.models.profile import Profile

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


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
