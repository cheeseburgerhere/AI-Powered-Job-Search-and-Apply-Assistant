from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.job import Job
from app.models.cover_letter import CoverLetter
from app.models.profile import Profile
from app.schemas.cover_letter import (
    CoverLetterGenerate,
    CoverLetterRefine,
    CoverLetterContentUpdate,
    CoverLetterManualVersionCreate,
    CoverLetterStatusUpdate,
    CoverLetterResponse,
)
from app.services.resume_parser import profile_to_text
from app.services.ai_service import get_ai_service
from app.services.company_info import fetch_company_info
from app.services.pdf_generator import generate_cover_letter_pdf
from app.routers.profile import _build_content_disposition

router = APIRouter(prefix="/api/cover-letters", tags=["cover-letters"])


@router.post("/generate", response_model=CoverLetterResponse)
def generate_cover_letter(req: CoverLetterGenerate, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == req.job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    profile = db.query(Profile).first()
    if not profile:
        raise HTTPException(status_code=400, detail="Create a profile first")

    profile_text = profile_to_text(profile)
    company_context = (req.company_context or "").strip()
    if not company_context and req.company_website:
        company_context = fetch_company_info(job.company, req.company_website)

    ai = get_ai_service()
    content = ai.generate_cover_letter(
        profile_text=profile_text,
        voice_profile=profile.voice_profile or "",
        jd_text=job.description,
        company=job.company,
        title=job.title,
        company_website=req.company_website or "",
        company_context=company_context,
    )

    # Determine version number
    existing_count = db.query(CoverLetter).filter(CoverLetter.job_id == job.id).count()

    letter = CoverLetter(
        job_id=job.id,
        version=existing_count + 1,
        content=content,
        status="draft",
        source="server",
    )
    db.add(letter)
    db.commit()
    db.refresh(letter)
    return letter


@router.get("", response_model=list[CoverLetterResponse])
def list_cover_letters(job_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(CoverLetter)
    if job_id is not None:
        query = query.filter(CoverLetter.job_id == job_id)
    return query.order_by(CoverLetter.created_at.desc()).all()


@router.get("/{letter_id}", response_model=CoverLetterResponse)
def get_cover_letter(letter_id: int, db: Session = Depends(get_db)):
    letter = db.query(CoverLetter).filter(CoverLetter.id == letter_id).first()
    if not letter:
        raise HTTPException(status_code=404, detail="Cover letter not found")
    return letter


@router.get("/{letter_id}/download")
def download_cover_letter(letter_id: int, db: Session = Depends(get_db)):
    letter = db.query(CoverLetter).filter(CoverLetter.id == letter_id).first()
    if not letter:
        raise HTTPException(status_code=404, detail="Cover letter not found")

    job = db.query(Job).filter(Job.id == letter.job_id).first()
    profile = db.query(Profile).first()
    job_title = job.title.replace(" ", "_").replace("/", "_") if job else "cover_letter"
    filename = f"{job_title}_v{letter.version}.pdf"

    author = (profile.full_name or "AI Job Assistant").strip() if profile else "AI Job Assistant"
    pdf_buffer = generate_cover_letter_pdf(
        letter.content,
        filename=filename,
        author=author,
        title=f"{job.title} Cover Letter" if job else "Cover Letter",
    )

    headers = {"Content-Disposition": _build_content_disposition(filename)}
    return StreamingResponse(pdf_buffer, media_type="application/pdf", headers=headers)



@router.post("/{letter_id}/refine", response_model=CoverLetterResponse)
def refine_cover_letter(letter_id: int, req: CoverLetterRefine, db: Session = Depends(get_db)):
    letter = db.query(CoverLetter).filter(CoverLetter.id == letter_id).first()
    if not letter:
        raise HTTPException(status_code=404, detail="Cover letter not found")

    ai = get_ai_service()
    refined_content = ai.refine_cover_letter(letter.content, req.feedback)

    # Create new version
    new_letter = CoverLetter(
        job_id=letter.job_id,
        version=letter.version + 1,
        content=refined_content,
        feedback=req.feedback,
        status="draft",
        source="server",
    )
    db.add(new_letter)
    db.commit()
    db.refresh(new_letter)
    return new_letter


@router.put("/{letter_id}", response_model=CoverLetterResponse)
def update_cover_letter_content(letter_id: int, req: CoverLetterContentUpdate, db: Session = Depends(get_db)):
    letter = db.query(CoverLetter).filter(CoverLetter.id == letter_id).first()
    if not letter:
        raise HTTPException(status_code=404, detail="Cover letter not found")

    if not req.content.strip():
        raise HTTPException(status_code=400, detail="Content cannot be empty")

    letter.content = req.content
    db.commit()
    db.refresh(letter)
    return letter


@router.post("/{letter_id}/manual-version", response_model=CoverLetterResponse)
def create_manual_cover_letter_version(letter_id: int, req: CoverLetterManualVersionCreate, db: Session = Depends(get_db)):
    letter = db.query(CoverLetter).filter(CoverLetter.id == letter_id).first()
    if not letter:
        raise HTTPException(status_code=404, detail="Cover letter not found")

    if not req.content.strip():
        raise HTTPException(status_code=400, detail="Content cannot be empty")

    latest = (
        db.query(CoverLetter)
        .filter(CoverLetter.job_id == letter.job_id)
        .order_by(CoverLetter.version.desc())
        .first()
    )
    next_version = (latest.version + 1) if latest else (letter.version + 1)

    new_letter = CoverLetter(
        job_id=letter.job_id,
        version=next_version,
        content=req.content,
        feedback=(req.feedback or "Manual edit"),
        status="draft",
        source="manual",
    )
    db.add(new_letter)
    db.commit()
    db.refresh(new_letter)
    return new_letter


@router.put("/{letter_id}/status", response_model=CoverLetterResponse)
def update_cover_letter_status(letter_id: int, req: CoverLetterStatusUpdate, db: Session = Depends(get_db)):
    letter = db.query(CoverLetter).filter(CoverLetter.id == letter_id).first()
    if not letter:
        raise HTTPException(status_code=404, detail="Cover letter not found")
    if req.status not in ("draft", "ready"):
        raise HTTPException(status_code=400, detail="Status must be 'draft' or 'ready'")
    letter.status = req.status
    db.commit()
    db.refresh(letter)
    return letter
