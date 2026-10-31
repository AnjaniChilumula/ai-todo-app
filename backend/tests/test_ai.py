import json
from datetime import datetime
from zoneinfo import ZoneInfo

import anthropic
import httpx2
import pytest

from app.ai.client import FALLBACK_BETA, AIError, ParsedTask, TodoAI
from app.main import app
from app.routers.ai import get_ai

# --- Endpoints, with a fake AI ---------------------------------------------------------------


class FakeAI:
    def __init__(self):
        self.parsed = ParsedTask(title="Call mom", notes=None, due_at=None, priority="medium")
        self.suggestions = ["Book the venue", "Order the cake"]
        self.error = None
        self.calls = []

    def parse_task(self, text, now):
        self.calls.append(("parse", text, now))
        if self.error:
            raise self.error
        return self.parsed

    def suggest_subtasks(self, title, notes, existing):
        self.calls.append(("breakdown", title, existing))
        if self.error:
            raise self.error
        return self.suggestions


@pytest.fixture
def fake_ai(client):
    fake = FakeAI()
    app.dependency_overrides[get_ai] = lambda: fake
    return fake


def test_ai_endpoints_return_503_without_api_key(client):
    response = client.post("/api/ai/parse", json={"text": "call mom"})

    assert response.status_code == 503
    assert "ANTHROPIC_API_KEY" in response.json()["detail"]


def test_parse_returns_a_suggestion_without_saving(client, fake_ai):
    fake_ai.parsed = ParsedTask(
        title="Call mom",
        notes="Ask about Sunday",
        due_at="2026-11-01T18:00:00+05:30",
        priority="high",
    )

    response = client.post(
        "/api/ai/parse", json={"text": "call mom tomorrow 6pm, high priority", "timezone": "UTC"}
    )

    assert response.status_code == 200
    assert response.json() == {
        "title": "Call mom",
        "notes": "Ask about Sunday",
        "due_at": "2026-11-01T12:30:00Z",
        "priority": "high",
    }
    assert client.get("/api/todos").json() == []


def test_parse_reads_dates_without_offset_in_the_users_timezone(client, fake_ai):
    fake_ai.parsed = ParsedTask(
        title="Call mom", notes=None, due_at="2026-11-01T18:00:00", priority="medium"
    )

    response = client.post("/api/ai/parse", json={"text": "x", "timezone": "Asia/Kolkata"})

    assert response.json()["due_at"] == "2026-11-01T12:30:00Z"
    _, _, now = fake_ai.calls[0]
    assert now.tzinfo == ZoneInfo("Asia/Kolkata")


def test_parse_drops_an_unreadable_date(client, fake_ai):
    fake_ai.parsed = ParsedTask(title="Call mom", notes=None, due_at="soon-ish", priority="low")

    assert client.post("/api/ai/parse", json={"text": "x"}).json()["due_at"] is None


def test_parse_falls_back_to_the_typed_text_for_an_empty_title(client, fake_ai):
    fake_ai.parsed = ParsedTask(title="  ", notes="  ", due_at=None, priority="medium")

    body = client.post("/api/ai/parse", json={"text": "  water the plants "}).json()

    assert body["title"] == "water the plants"
    assert body["notes"] is None


def test_parse_validates_input(client, fake_ai):
    assert client.post("/api/ai/parse", json={"text": ""}).status_code == 422
    assert (
        client.post("/api/ai/parse", json={"text": "x", "timezone": "Mars/Base"}).status_code == 422
    )


def test_parse_reports_ai_errors(client, fake_ai):
    fake_ai.error = AIError("The AI service is busy right now.", 429)

    response = client.post("/api/ai/parse", json={"text": "x"})

    assert response.status_code == 429
    assert response.json()["detail"] == "The AI service is busy right now."


def test_breakdown_suggests_subtasks_and_skips_existing(client, fake_ai):
    parent = client.post("/api/todos", json={"title": "Plan party"}).json()
    client.post("/api/todos", json={"title": "Make guest list", "parent_id": parent["id"]})

    response = client.post("/api/ai/breakdown", json={"todo_id": parent["id"]})

    assert response.status_code == 200
    assert response.json() == {"subtasks": ["Book the venue", "Order the cake"]}
    assert fake_ai.calls == [("breakdown", "Plan party", ["Make guest list"])]


def test_breakdown_rejects_missing_tasks_and_subtasks(client, fake_ai):
    parent = client.post("/api/todos", json={"title": "Plan party"}).json()
    sub = client.post("/api/todos", json={"title": "Sub", "parent_id": parent["id"]}).json()

    assert client.post("/api/ai/breakdown", json={"todo_id": 999}).status_code == 404
    assert client.post("/api/ai/breakdown", json={"todo_id": sub["id"]}).status_code == 400


def test_breakdown_reports_ai_errors(client, fake_ai):
    todo = client.post("/api/todos", json={"title": "Plan party"}).json()
    fake_ai.error = AIError("The AI couldn't help with that one.", 422)

    response = client.post("/api/ai/breakdown", json={"todo_id": todo["id"]})

    assert response.status_code == 422


# --- TodoAI, with the real SDK and a mock HTTP transport ---------------------------------------


def make_ai(handler):
    """A TodoAI whose SDK client sends requests to `handler` instead of the network."""
    transport = httpx2.MockTransport(handler)
    sdk = anthropic.Anthropic(
        api_key="test-key", http_client=httpx2.Client(transport=transport), max_retries=0
    )
    return TodoAI(api_key="test-key", model="claude-opus-5-5", client=sdk)


def claude_reply(answer, stop_reason="end_turn"):
    return httpx2.Response(
        200,
        json={
            "id": "msg_test",
            "type": "message",
            "role": "assistant",
            "model": "claude-opus-5-5",
            "content": [{"type": "text", "text": json.dumps(answer)}],
            "stop_reason": stop_reason,
            "stop_sequence": None,
            "usage": {"input_tokens": 10, "output_tokens": 10},
        },
    )


NOW = datetime(2026, 10, 31, 12, 0, tzinfo=ZoneInfo("Asia/Kolkata"))


def test_parse_task_sends_a_structured_request():
    requests = []

    def handler(request):
        requests.append(request)
        return claude_reply(
            {"title": "Call mom", "notes": None, "due_at": None, "priority": "high"}
        )

    result = make_ai(handler).parse_task("call mom, high priority", NOW)

    assert result.title == "Call mom"
    assert result.priority == "high"
    body = json.loads(requests[0].content)
    assert requests[0].headers["anthropic-beta"] == FALLBACK_BETA
    assert body["model"] == "claude-opus-5-5"
    assert body["fallbacks"] == "default"
    assert body["output_config"]["effort"] == "low"
    assert body["output_config"]["format"]["type"] == "json_schema"
    assert "Saturday 31 October 2026, 12:00" in body["messages"][0]["content"]
    assert "<task>\ncall mom, high priority\n</task>" in body["messages"][0]["content"]


def test_suggest_subtasks_cleans_up_the_answer():
    answer = {"subtasks": [" Book venue ", "", "make guest list", "A", "B", "C", "D", "E"]}
    ai = make_ai(lambda request: claude_reply(answer))

    result = ai.suggest_subtasks("Plan party", None, ["Make guest list"])

    assert result == ["Book venue", "A", "B", "C", "D", "E"]


def test_refusal_becomes_a_friendly_error():
    ai = make_ai(lambda request: claude_reply({}, stop_reason="refusal"))

    with pytest.raises(AIError) as caught:
        ai.parse_task("x", NOW)

    assert caught.value.status_code == 422


@pytest.mark.parametrize(
    ("status", "error_type", "expected_status", "expected_text"),
    [
        (401, "authentication_error", 502, "ANTHROPIC_API_KEY"),
        (404, "not_found_error", 502, "ANTHROPIC_MODEL"),
        (429, "rate_limit_error", 429, "busy"),
        (500, "api_error", 502, "error (500)"),
    ],
)
def test_api_errors_become_friendly_errors(status, error_type, expected_status, expected_text):
    def handler(request):
        return httpx2.Response(
            status, json={"type": "error", "error": {"type": error_type, "message": "nope"}}
        )

    with pytest.raises(AIError) as caught:
        make_ai(handler).parse_task("x", NOW)

    assert caught.value.status_code == expected_status
    assert expected_text in caught.value.message


def test_network_failure_becomes_a_friendly_error():
    def handler(request):
        raise httpx2.ConnectError("no network")

    with pytest.raises(AIError) as caught:
        make_ai(handler).parse_task("x", NOW)

    assert "Couldn't reach the AI service" in caught.value.message
