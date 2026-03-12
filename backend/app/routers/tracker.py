from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.job import Job
from app.models.tracker import TrackerEvent
from app.schemas.job import JobResponse
from app.schemas.tracker import TrackerEventResponse, TrackerBoardResponse, TrackerStatsResponse

router = APIRouter(prefix="/api/tracker", tags=["tracker"])

STATUSES = ["interested", "applied", "follow_up", "interview", "offer", "rejected"]


@router.get("/board", response_model=TrackerBoardResponse)
def get_board(db: Session = Depends(get_db)):
    board = {}
    for status in STATUSES:
        jobs = db.query(Job).filter(Job.status == status).order_by(Job.updated_at.desc()).all()
        board[status] = [JobResponse.model_validate(j) for j in jobs]
    return board


@router.get("/events", response_model=list[TrackerEventResponse])
def get_events(job_id: int, db: Session = Depends(get_db)):
    events = (
        db.query(TrackerEvent)
        .filter(TrackerEvent.job_id == job_id)
        .order_by(TrackerEvent.created_at.asc())
        .all()
    )
    return events


@router.get("/stats", response_model=TrackerStatsResponse)
def get_stats(db: Session = Depends(get_db)):
    stats = {"total": db.query(Job).count()}
    for status in STATUSES:
        stats[status] = db.query(Job).filter(Job.status == status).count()
    return stats
