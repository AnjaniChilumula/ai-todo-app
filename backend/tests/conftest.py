import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import create_engine

from app import db
from app.config import Settings, get_settings
from app.main import app


@pytest.fixture
def client(monkeypatch):
    """A test client backed by a fresh in-memory database.

    Settings ignore the developer's own .env file, so tests behave the same everywhere.
    """
    test_engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    monkeypatch.setattr(db, "engine", test_engine)
    app.dependency_overrides[get_settings] = lambda: Settings(
        _env_file=None, anthropic_api_key=None
    )
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
