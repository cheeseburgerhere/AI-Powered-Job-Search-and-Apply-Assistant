import pdfplumber
import io
from app.services.ai_service import get_ai_service


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract text from a PDF file."""
    text_parts = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
    return "\n\n".join(text_parts)


def parse_resume(text: str) -> dict:
    """Send resume text to Claude for structured parsing."""
    ai = get_ai_service()
    return ai.parse_resume(text)


def profile_to_text(profile) -> str:
    """Convert a profile DB object to a text representation for AI prompts."""
    parts = [f"Name: {profile.full_name}"]
    if profile.location:
        parts.append(f"Location: {profile.location}")
    if profile.summary:
        parts.append(f"\nSummary: {profile.summary}")
    if profile.skills:
        parts.append(f"\nSkills: {', '.join(profile.skills)}")
    if profile.experiences:
        parts.append("\nExperience:")
        for exp in profile.experiences:
            parts.append(f"  {exp.get('title', '')} at {exp.get('company', '')} ({exp.get('start_date', '')} - {exp.get('end_date', '')})")
            for bullet in exp.get("bullets", []):
                parts.append(f"    - {bullet}")
    if profile.education:
        parts.append("\nEducation:")
        for edu in profile.education:
            parts.append(f"  {edu.get('degree', '')} in {edu.get('field', '')} from {edu.get('school', '')} ({edu.get('start_date', '')} - {edu.get('end_date', '')})")
    if profile.certifications:
        parts.append("\nCertifications:")
        for cert in profile.certifications:
            parts.append(f"  {cert.get('name', '')} - {cert.get('issuer', '')} ({cert.get('date', '')})")
    return "\n".join(parts)
