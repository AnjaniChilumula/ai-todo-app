import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.main import app


@pytest.fixture
def client():
    """A test client with settings that ignore the developer's own .env file."""
    app.dependency_overrides[get_settings] = lambda: Settings(
        _env_file=None, anthropic_api_key=None
    )
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
