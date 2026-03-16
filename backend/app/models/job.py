from sqlalchemy import Column, Integer, String, Text, Float, DateTime, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    external_id = Column(String, nullable=True)
    source = Column(String, default="manual")  # "jsearch", "adzuna", "manual"
    title = Column(String, default="")
    company = Column(String, default="")
    location = Column(String, default="")
    remote_type = Column(String, default="")  # "remote", "hybrid", "onsite"
    salary_min = Column(Integer, nullable=True)
    salary_max = Column(Integer, nullable=True)
    description = Column(Text, default="")
    url = Column(String, nullable=True)
    fit_score = Column(Float, nullable=True)
    fit_reasoning = Column(Text, nullable=True)
    status = Column(String, default="interested")
    date_saved = Column(DateTime(timezone=True), server_default=func.now())
    date_applied = Column(DateTime(timezone=True), nullable=True)
    next_follow_up = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)
    link_type = Column(String, nullable=True)  # "job", "board", "expired"
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    cover_letters = relationship("CoverLetter", back_populates="job", cascade="all, delete-orphan")
    tracker_events = relationship("TrackerEvent", back_populates="job", cascade="all, delete-orphan")
