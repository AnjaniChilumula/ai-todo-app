from collections.abc import Iterator
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect
from sqlmodel import Session, create_engine

from app.config import get_settings

BACKEND_DIR = Path(__file__).resolve().parent.parent

# The revision that matches databases created by v1 (before migrations existed).
BASELINE_REVISION = "0001"

# check_same_thread=False lets FastAPI use the SQLite connection from its worker threads.
engine = create_engine(get_settings().database_url, connect_args={"check_same_thread": False})


def migrate() -> None:
    """Bring the database schema up to date, creating it on first run."""
    with engine.begin() as connection:
        config = Config(str(BACKEND_DIR / "alembic.ini"))
        config.attributes["connection"] = connection
        tables = inspect(connection).get_table_names()
        if "todo" in tables and "alembic_version" not in tables:
            # A v1 database: the baseline tables exist already, so record that instead of
            # trying to create them again.
            command.stamp(config, BASELINE_REVISION)
        command.upgrade(config, "head")


def get_session() -> Iterator[Session]:
    """FastAPI dependency: one database session per request."""
    with Session(engine) as session:
        yield session
