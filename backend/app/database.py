from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config import get_settings
import os


settings = get_settings()

# Ensure data directory exists for SQLite
db_path = settings.database_url.replace("sqlite:///", "")
os.makedirs(os.path.dirname(db_path) if os.path.dirname(db_path) else ".", exist_ok=True)

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},  # SQLite-specific
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    Base.metadata.create_all(bind=engine)
    _add_missing_job_columns()


def _add_missing_job_columns():
    """Expand older SQLite databases without deleting or rewriting job data."""
    inspector = inspect(engine)
    if "jobs" not in inspector.get_table_names():
        return

    existing = {column["name"] for column in inspector.get_columns("jobs")}
    additions = {
        "category": "VARCHAR NOT NULL DEFAULT ''",
        "priority": "VARCHAR NOT NULL DEFAULT ''",
        "fit_analysis": "JSON",
    }
    with engine.begin() as connection:
        for name, definition in additions.items():
            if name not in existing:
                connection.execute(text(f"ALTER TABLE jobs ADD COLUMN {name} {definition}"))
