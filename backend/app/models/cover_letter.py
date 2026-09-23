from sqlalchemy import Column, Integer, String, Text, ForeignKey
from app.models.types import UTCDateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

# Who wrote a version: the MCP agent, the server's own AI, the user, or "" when unknown
# (older rows, and text handed to the jobs API without saying where it came from).
LETTER_SOURCES = {"", "agent", "server", "manual"}


class CoverLetter(Base):
    __tablename__ = "cover_letters"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    version = Column(Integer, default=1)
    content = Column(Text, default="")
    feedback = Column(Text, nullable=True)
    status = Column(String, default="draft")  # "draft", "ready"
    source = Column(String, nullable=False, default="")  # see LETTER_SOURCES
    created_at = Column(UTCDateTime(), server_default=func.now())
    updated_at = Column(UTCDateTime(), server_default=func.now(), onupdate=func.now())

    job = relationship("Job", back_populates="cover_letters")
