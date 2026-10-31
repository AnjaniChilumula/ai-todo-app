from app.config import Settings, get_settings
from app.main import app


def test_health_returns_ok(client):
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_health_reports_ai_disabled_without_key(client):
    assert client.get("/api/health").json()["ai_enabled"] is False


def test_health_reports_ai_enabled_with_key(client):
    app.dependency_overrides[get_settings] = lambda: Settings(
        _env_file=None, anthropic_api_key="test-key"
    )

    assert client.get("/api/health").json()["ai_enabled"] is True
