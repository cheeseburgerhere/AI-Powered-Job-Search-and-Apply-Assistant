from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.job import Job
from app.models.tracker import TrackerEvent
from app.schemas.job import JobResponse
from app.schemas.tracker import TrackerEventResponse, TrackerBoardResponse, TrackerStatsResponse, TrackerRejectedBinResponse

router = APIRouter(prefix="/api/tracker", tags=["tracker"])

STATUSES = ["interested", "applied", "follow_up", "interview", "offer", "rejected"]

REJECTED_BIN_LABELS = {
    "interested": "Rejected from Interested",
    "applied": "Rejected after Applied",
    "follow_up": "Rejected after Follow Up",
    "interview": "Rejected after Interview",
    "offer": "Rejected after Offer",
    "unknown": "Rejected (Unknown Stage)",
}


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
    stats = {
        "total": db.query(Job).count(),
        "discovered": db.query(Job).filter(Job.status == "discovered").count(),
    }
    for status in STATUSES:
        stats[status] = db.query(Job).filter(Job.status == status).count()
    return stats


@router.get("/rejected-bins", response_model=list[TrackerRejectedBinResponse])
def get_rejected_bins(db: Session = Depends(get_db)):
    rejected_jobs = db.query(Job).filter(Job.status == "rejected").order_by(Job.updated_at.desc()).all()

    grouped: dict[str, list[JobResponse]] = {
        "interested": [],
        "applied": [],
        "follow_up": [],
        "interview": [],
        "offer": [],
        "unknown": [],
    }

    for job in rejected_jobs:
        latest_reject_event = (
            db.query(TrackerEvent)
            .filter(TrackerEvent.job_id == job.id, TrackerEvent.to_status == "rejected")
            .order_by(TrackerEvent.created_at.desc())
            .first()
        )

        from_status = (latest_reject_event.from_status if latest_reject_event else "") or "unknown"
        bin_key = from_status if from_status in grouped else "unknown"
        grouped[bin_key].append(JobResponse.model_validate(job))

    order = ["interested", "applied", "follow_up", "interview", "offer", "unknown"]
    return [
        TrackerRejectedBinResponse(
            key=key,
            label=REJECTED_BIN_LABELS[key],
            count=len(grouped[key]),
            jobs=grouped[key],
        )
        for key in order
    ]
