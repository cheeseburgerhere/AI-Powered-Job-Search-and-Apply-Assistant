from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.orm import Session
from typing import Optional
from pathlib import Path
import uuid
from urllib.parse import quote
import unicodedata

from app.database import get_db
from app.models.profile import Profile
from app.schemas.profile import (
    ProfileResponse,
    ProfileUpdate,
    PreferencesUpdate,
    WritingSampleInput,
)
from app.services.resume_parser import extract_text_from_pdf, parse_resume, profile_to_text
from app.services.pdf_generator import generate_text_pdf
from app.services.ai_service import get_ai_service
from app.services.capabilities import server_ai_configured

router = APIRouter(prefix="/api/profile", tags=["profile"])


def _build_content_disposition(filename: str) -> str:
    normalized = unicodedata.normalize("NFKD", filename)
    ascii_name = normalized.encode("ascii", "ignore").decode("ascii") or "download.pdf"
    ascii_name = ascii_name.replace(" ", "_")
    utf8_name = quote(filename)
    return f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{utf8_name}"


def _get_or_create_profile(db: Session) -> Profile:
    """Get the single profile or create one."""
    profile = db.query(Profile).first()
    if not profile:
        profile = Profile()
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


@router.get("", response_model=ProfileResponse)
def get_profile(db: Session = Depends(get_db)):
    profile = _get_or_create_profile(db)
    return profile


@router.post("/upload-resume", response_model=ProfileResponse)
async def upload_resume(
    db: Session = Depends(get_db),
    file: Optional[UploadFile] = File(None),
    resume_text: Optional[str] = Form(None),
):
    if not file and not resume_text:
        raise HTTPException(status_code=400, detail="Provide either a PDF file or resume text")

    # Extract text from PDF or use provided text
    if file:
        if not file.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF files are supported")
        contents = await file.read()
        text = extract_text_from_pdf(contents)
        upload_dir = Path(__file__).resolve().parent.parent / "data" / "uploads" / "resumes"
        upload_dir.mkdir(parents=True, exist_ok=True)
        safe_name = file.filename.replace("..", "").replace("/", "_").replace("\\", "_")
        stored_name = f"{uuid.uuid4().hex}_{safe_name}"
        stored_path = upload_dir / stored_name
        stored_path.write_bytes(contents)
    else:
        text = resume_text

    parsed = parse_resume(text) if server_ai_configured() else {}

    # Update or create profile
    profile = _get_or_create_profile(db)
    profile.raw_resume_text = text
    if file:
        profile.resume_file_path = str(stored_path)
    if parsed:
        profile.full_name = parsed.get("full_name", "")
        profile.email = parsed.get("email", "")
        profile.phone = parsed.get("phone", "")
        profile.location = parsed.get("location", "")
        profile.summary = parsed.get("summary", "")
        profile.skills = parsed.get("skills", [])
        profile.experiences = parsed.get("experiences", [])
        profile.education = parsed.get("education", [])
        profile.certifications = parsed.get("certifications", [])

    db.commit()
    db.refresh(profile)
    return profile


@router.put("", response_model=ProfileResponse)
def update_profile(update: ProfileUpdate, db: Session = Depends(get_db)):
    profile = _get_or_create_profile(db)
    update_data = update.model_dump(exclude_unset=True)
    # Convert nested Pydantic models to dicts for JSON columns
    for key, value in update_data.items():
        if isinstance(value, list) and value and hasattr(value[0], "model_dump"):
            update_data[key] = [v.model_dump() for v in value]
        setattr(profile, key, value)
    db.commit()
    db.refresh(profile)
    return profile


@router.post("/writing-sample", response_model=ProfileResponse)
def add_writing_sample(sample: WritingSampleInput, db: Session = Depends(get_db)):
    profile = _get_or_create_profile(db)
    samples = list(profile.writing_samples or [])
    samples.append(sample.text)
    profile.writing_samples = samples
    db.commit()
    db.refresh(profile)
    return profile


@router.post("/analyze-voice", response_model=ProfileResponse)
def analyze_voice(db: Session = Depends(get_db)):
    profile = _get_or_create_profile(db)
    if not profile.writing_samples:
        raise HTTPException(status_code=400, detail="Add writing samples first")

    ai = get_ai_service()
    voice = ai.analyze_voice(profile.writing_samples)
    profile.voice_profile = voice
    db.commit()
    db.refresh(profile)
    return profile


@router.put("/preferences", response_model=ProfileResponse)
def update_preferences(prefs: PreferencesUpdate, db: Session = Depends(get_db)):
    profile = _get_or_create_profile(db)
    current = dict(profile.preferences or {})
    update_data = prefs.model_dump(exclude_unset=True)
    current.update(update_data)
    profile.preferences = current
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/resume/download")
def download_resume(db: Session = Depends(get_db)):
    profile = _get_or_create_profile(db)
    resume_path = (profile.resume_file_path or "").strip()
    if resume_path:
        path = Path(resume_path)
        if path.exists():
            headers = {"Content-Disposition": _build_content_disposition(path.name)}
            return FileResponse(path, media_type="application/pdf", headers=headers)

    resume_text = (profile.raw_resume_text or "").strip()
    if not resume_text:
        resume_text = profile_to_text(profile).strip()

    if not resume_text:
        raise HTTPException(status_code=400, detail="Resume data not found. Upload a resume first.")

    name_part = (profile.full_name or "resume").strip().replace(" ", "_")
    filename = f"{name_part}_resume.pdf"
    pdf_buffer = generate_text_pdf(resume_text, filename=filename, author=profile.full_name or "AI Job Assistant", title="Resume")
    headers = {"Content-Disposition": _build_content_disposition(filename)}
    return StreamingResponse(pdf_buffer, media_type="application/pdf", headers=headers)
