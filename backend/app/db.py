from collections.abc import Iterator

from sqlmodel import Session, SQLModel, create_engine

from app.config import get_settings

# check_same_thread=False lets FastAPI use the SQLite connection from its worker threads.
engine = create_engine(get_settings().database_url, connect_args={"check_same_thread": False})


def init_db() -> None:
    """Create any missing tables."""
    SQLModel.metadata.create_all(engine)


def get_session() -> Iterator[Session]:
    """FastAPI dependency: one database session per request."""
    with Session(engine) as session:
        yield session
