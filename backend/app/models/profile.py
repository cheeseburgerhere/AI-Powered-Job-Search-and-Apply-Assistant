from sqlalchemy import Column, Integer, String, Text, JSON
from app.models.types import UTCDateTime
from sqlalchemy.sql import func
from app.database import Base


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, default="")
    email = Column(String, default="")
    phone = Column(String, default="")
    location = Column(String, default="")
    summary = Column(Text, default="")
    raw_resume_text = Column(Text, default="")
    resume_file_path = Column(String, nullable=True)
    skills = Column(JSON, default=list)
    experiences = Column(JSON, default=list)
    education = Column(JSON, default=list)
    certifications = Column(JSON, default=list)
    writing_samples = Column(JSON, default=list)
    voice_profile = Column(Text, default="")
    preferences = Column(JSON, default=dict)
    created_at = Column(UTCDateTime(), server_default=func.now())
    updated_at = Column(UTCDateTime(), server_default=func.now(), onupdate=func.now())
