from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


# Import models so Alembic sees them
from app.models.job import Job  # noqa: E402,F401