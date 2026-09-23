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
    _add_missing_columns()


# Columns added after the first release, per table. create_all() never alters existing tables.
_COLUMN_ADDITIONS = {
    "jobs": {
        "category": "VARCHAR NOT NULL DEFAULT ''",
        "priority": "VARCHAR NOT NULL DEFAULT ''",
        "fit_analysis": "JSON",
    },
    "cover_letters": {
        "source": "VARCHAR NOT NULL DEFAULT ''",
    },
}

# One-off backfills that run only in the migration that adds the column. Only the exact
# default notes written by the agent tool and the manual-version route are trusted.
_BACKFILLS = {
    ("cover_letters", "source"): [
        "UPDATE cover_letters SET source = 'agent' WHERE feedback = 'Agent-authored draft'",
        "UPDATE cover_letters SET source = 'manual' WHERE feedback = 'Manual edit'",
    ],
}


def _add_missing_columns():
    """Expand older SQLite databases without deleting or rewriting existing rows."""
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    with engine.begin() as connection:
        for table, additions in _COLUMN_ADDITIONS.items():
            if table not in tables:
                continue
            existing = {column["name"] for column in inspector.get_columns(table)}
            for name, definition in additions.items():
                if name in existing:
                    continue
                connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {definition}"))
                for statement in _BACKFILLS.get((table, name), []):
                    connection.execute(text(statement))
