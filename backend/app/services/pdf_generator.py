from io import BytesIO
from pathlib import Path
from datetime import datetime

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


def _find_font_path() -> Path | None:
    app_dir = Path(__file__).resolve().parent.parent
    candidates = [
        app_dir / "assets" / "fonts" / "NotoSans-Regular.ttf",
        app_dir / "assets" / "fonts" / "DejaVuSans.ttf",
        Path("C:/Windows/Fonts/arial.ttf"),
        Path("C:/Windows/Fonts/segoeui.ttf"),
        Path("C:/Windows/Fonts/calibri.ttf"),
    ]

    for candidate in candidates:
        if candidate.exists():
            return candidate

    return None


def _register_body_font() -> str:
    font_name = "CoverLetterBody"
    if font_name in pdfmetrics.getRegisteredFontNames():
        return font_name

    font_path = _find_font_path()
    if not font_path:
        raise RuntimeError(
            "No Unicode-capable font found for PDF generation. "
            "Add a TTF font to backend/app/assets/fonts (e.g., NotoSans-Regular.ttf)."
        )

    pdfmetrics.registerFont(TTFont(font_name, str(font_path)))
    return font_name


def generate_cover_letter_pdf(
    content: str,
    filename: str = "cover_letter.pdf",
    author: str = "AI Job Assistant",
    title: str = "Cover Letter",
) -> BytesIO:
    """
    Generate a PDF from cover letter content.
    
    Args:
        content: The cover letter text content
        filename: Optional filename for the PDF
        
    Returns:
        BytesIO object containing the PDF data
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
        author=author,
        title=title,
    )
    
    # Create styles
    styles = getSampleStyleSheet()
    body_font = _register_body_font()
    
    # Custom style for body text
    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['Normal'],
        fontSize=11,
        leading=16,
        alignment=TA_LEFT,
        fontName=body_font,
        spaceAfter=12,
    )

    date_style = ParagraphStyle(
        'Date',
        parent=styles['Normal'],
        fontSize=11,
        leading=14,
        alignment=TA_LEFT,
        fontName=body_font,
        spaceAfter=12,
    )
    
    # Build the PDF content
    story = []
    
    # Add date
    # date_today = datetime.now().strftime("%B %d, %Y")
    # story.append(Paragraph(date_today, date_style))
    # story.append(Spacer(1, 0.3*inch))
    
    # Add the cover letter content
    # Split content into paragraphs for better formatting
    paragraphs = content.split('\n\n')
    for para in paragraphs:
        if para.strip():
            story.append(Paragraph(para.strip(), body_style))
    
    # Build PDF
    doc.build(story)
    buffer.seek(0)
    return buffer


def generate_text_pdf(
    content: str,
    filename: str = "document.pdf",
    author: str = "AI Job Assistant",
    title: str = "Document",
) -> BytesIO:
    """
    Generate a PDF from arbitrary text content.

    Args:
        content: The text content
        filename: Optional filename for the PDF

    Returns:
        BytesIO object containing the PDF data
    """
    return generate_cover_letter_pdf(content, filename=filename, author=author, title=title)
