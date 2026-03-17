from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.cover_letter import CoverLetter
from app.models.job import Job
from app.models.profile import Profile
from app.schemas.apply import ApplyPlanResponse
from app.services.apply_planner import build_apply_plan

router = APIRouter(prefix="/api/apply", tags=["apply"])


@router.post("/plan/{job_id}", response_model=ApplyPlanResponse)
def generate_apply_plan(job_id: int, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    profile = db.query(Profile).first()
    cover_letter = (
        db.query(CoverLetter)
        .filter(CoverLetter.job_id == job.id)
        .order_by(CoverLetter.updated_at.desc())
        .first()
    )

    return build_apply_plan(job=job, profile=profile, cover_letter=cover_letter)
