from datetime import datetime, timezone
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.job import Job
from app.models.job_board import JobBoard
from app.models.profile import Profile
from app.schemas.job import JobResponse
from app.schemas.job_board import JobBoardCreate, JobBoardResponse, JobBoardRunResponse, JobBoardUpdate
from app.services.agent_workflows import apply_fit_result
from app.services.ai_service import get_ai_service
from app.services.job_search import JobSearchService
from app.services.resume_parser import profile_to_text

router = APIRouter(prefix="/api/job-boards", tags=["job-boards"])


def _normalize_domain(raw: str) -> str:
    value = (raw or "").strip().lower()
    if not value:
        return ""

    if "//" not in value:
        value = f"https://{value}"

    parsed = urlparse(value)
    domain = (parsed.netloc or parsed.path).strip().lower()
    if domain.startswith("www."):
        domain = domain[4:]
    return domain


def _find_existing_discovery_job(
    db: Session,
    source: str,
    external_id: str | None,
    title: str,
    company: str,
    url: str | None,
) -> Job | None:
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


@router.get("", response_model=list[JobBoardResponse])
def list_boards(db: Session = Depends(get_db)):
    return db.query(JobBoard).order_by(JobBoard.updated_at.desc()).all()


@router.post("", response_model=JobBoardResponse)
def create_board(data: JobBoardCreate, db: Session = Depends(get_db)):
    domain = _normalize_domain(data.domain)
    if not domain:
        raise HTTPException(status_code=400, detail="Domain is required")

    existing = db.query(JobBoard).filter(JobBoard.domain == domain).first()
    if existing:
        raise HTTPException(status_code=409, detail="Board domain is already tracked")

    board = JobBoard(
        name=data.name.strip(),
        domain=domain,
        query=data.query.strip(),
        location=(data.location or "").strip() or None,
        remote_only=bool(data.remote_only),
        min_fit_score=data.min_fit_score,
        score_results=bool(data.score_results),
        max_scored_jobs=max(0, min(data.max_scored_jobs, 30)),
        auto_apply_enabled=bool(data.auto_apply_enabled),
        apply_mode=(data.apply_mode or "manual_review").strip() or "manual_review",
        notes=(data.notes or "").strip() or None,
    )
    db.add(board)
    db.commit()
    db.refresh(board)
    return board


@router.put("/{board_id}", response_model=JobBoardResponse)
def update_board(board_id: int, data: JobBoardUpdate, db: Session = Depends(get_db)):
    board = db.query(JobBoard).filter(JobBoard.id == board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")

    updates = data.model_dump(exclude_unset=True)
    if "domain" in updates:
        normalized = _normalize_domain(updates["domain"] or "")
        if not normalized:
            raise HTTPException(status_code=400, detail="Domain is required")
        duplicate = db.query(JobBoard).filter(and_(JobBoard.domain == normalized, JobBoard.id != board_id)).first()
        if duplicate:
            raise HTTPException(status_code=409, detail="Board domain is already tracked")
        updates["domain"] = normalized

    if "query" in updates:
        updates["query"] = (updates["query"] or "").strip()
        if not updates["query"]:
            raise HTTPException(status_code=400, detail="Query cannot be empty")

    if "name" in updates:
        updates["name"] = (updates["name"] or "").strip()
        if not updates["name"]:
            raise HTTPException(status_code=400, detail="Name cannot be empty")

    if "location" in updates:
        updates["location"] = (updates["location"] or "").strip() or None

    if "notes" in updates:
        updates["notes"] = (updates["notes"] or "").strip() or None

    if "max_scored_jobs" in updates and updates["max_scored_jobs"] is not None:
        updates["max_scored_jobs"] = max(0, min(updates["max_scored_jobs"], 30))

    for key, value in updates.items():
        setattr(board, key, value)

    db.commit()
    db.refresh(board)
    return board


@router.delete("/{board_id}")
def delete_board(board_id: int, db: Session = Depends(get_db)):
    board = db.query(JobBoard).filter(JobBoard.id == board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")

    db.delete(board)
    db.commit()
    return {"ok": True}


@router.post("/{board_id}/run", response_model=JobBoardRunResponse)
def run_board(board_id: int, per_page: int = 30, db: Session = Depends(get_db)):
    board = db.query(JobBoard).filter(JobBoard.id == board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")

    profile = db.query(Profile).first()
    prefs = (profile.preferences or {}) if profile else {}
    query = (board.query or "").strip() or ((prefs.get("roles") or [""])[0].strip())
    if not query:
        raise HTTPException(status_code=400, detail="Board query is empty and no profile role preference is set")

    location = (board.location or "").strip() or ((prefs.get("locations") or [""])[0].strip() or None)

    search_service = JobSearchService()
    search_result = search_service.search_jobs(
        query=query,
        location=location,
        remote_only=bool(board.remote_only),
        salary_min=None,
        salary_max=None,
        page=1,
        per_page=max(1, min(per_page, 100)),
        sources=["brave_scrape"],
        country=None,
        scrape_sites=[board.domain],
    )

    discovered_jobs = search_result.get("jobs", [])
    if not discovered_jobs and search_result.get("errors"):
        raise HTTPException(status_code=502, detail="; ".join(search_result["errors"]))

    ai = get_ai_service() if (board.score_results and profile) else None
    profile_text = profile_to_text(profile) if (board.score_results and profile) else ""
    max_scored = max(0, board.max_scored_jobs or 0)
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
                apply_fit_result(job, ai.score_fit(profile_text, job.description))
                scored_count += 1
            except Exception as exc:
                if not job.fit_reasoning:
                    job.fit_reasoning = f"Scoring failed: {exc}"

        persisted.append(job)

    board.last_run_at = datetime.now(timezone.utc)
    db.commit()

    for job in persisted:
        db.refresh(job)
    db.refresh(board)

    min_fit = board.min_fit_score
    matched_jobs = persisted
    if min_fit is not None:
        scored_jobs = [j for j in persisted if j.fit_score is not None]
        if scored_jobs:
            matched_jobs = [j for j in scored_jobs if (j.fit_score or 0) >= min_fit]

    matched_jobs.sort(
        key=lambda j: (j.fit_score is not None, j.fit_score if j.fit_score is not None else -1),
        reverse=True,
    )

    apply_ready_jobs = [
        job
        for job in matched_jobs
        if job.url and (job.fit_score is not None and (min_fit is None or job.fit_score >= min_fit))
    ]

    return JobBoardRunResponse(
        board=JobBoardResponse.model_validate(board),
        total_found=len(persisted),
        fit_matched=len(matched_jobs),
        apply_ready=len(apply_ready_jobs) if board.auto_apply_enabled else 0,
        matched_jobs=[JobResponse.model_validate(job) for job in matched_jobs],
    )
