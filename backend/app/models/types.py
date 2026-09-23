from datetime import datetime, timezone

from sqlalchemy import DateTime
from sqlalchemy.types import TypeDecorator


class UTCDateTime(TypeDecorator):
    """Timestamp stored as UTC and always returned timezone-aware.

    SQLite keeps no offset, so plain DateTime(timezone=True) comes back naive and API
    clients read it as local time. Values are normalised to UTC on write (server_default
    CURRENT_TIMESTAMP is already UTC) and tagged as UTC on read.
    """

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect):
        if value is not None and value.tzinfo is not None:
            value = value.astimezone(timezone.utc)
        return value

    def process_result_value(self, value: datetime | None, dialect):
        if value is not None and value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value
