import pytest
from sqlmodel import Session, select

from app import cli, db
from app.ai.client import ParsedTask
from app.main import app
from app.models import Role, Todo, User
from app.routers.ai import get_ai
from tests.helpers import sign_up, use_session


@pytest.fixture
def two_users(client):
    """Anjani and Ravi, each with their own session token. The client starts as Anjani."""
    ravi = sign_up(client, email="ravi@example.com", name="Ravi")
    # Signing in on the same browser ends its previous session, so act as a second browser.
    use_session(client, None)
    anjani = sign_up(client, email="anjani@example.com", name="Anjani")
    return {"anjani": anjani, "ravi": ravi}


def titles(client):
    return [todo["title"] for todo in client.get("/api/todos").json()]


# --- Anonymous ------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("method", "path", "body"),
    [
        ("get", "/api/todos", None),
        ("post", "/api/todos", {"title": "x"}),
        ("patch", "/api/todos/1", {"completed": True}),
        ("delete", "/api/todos/1", None),
        ("delete", "/api/todos?completed=true", None),
        ("post", "/api/ai/parse", {"text": "call mom"}),
        ("post", "/api/ai/breakdown", {"todo_id": 1}),
    ],
)
def test_task_and_ai_endpoints_need_a_session(client, method, path, body):
    kwargs = {"json": body} if body is not None else {}

    response = getattr(client, method)(path, **kwargs)

    assert response.status_code == 401


# --- Between two users ----------------------------------------------------------------------


def test_each_user_sees_only_their_own_tasks(client, two_users):
    client.post("/api/todos", json={"title": "Anjani's task"})
    use_session(client, two_users["ravi"])
    client.post("/api/todos", json={"title": "Ravi's task"})

    assert titles(client) == ["Ravi's task"]
    use_session(client, two_users["anjani"])
    assert titles(client) == ["Anjani's task"]


def test_other_users_tasks_look_missing(client, two_users):
    task = client.post("/api/todos", json={"title": "Anjani's task"}).json()
    use_session(client, two_users["ravi"])

    assert client.patch(f"/api/todos/{task['id']}", json={"completed": True}).status_code == 404
    assert client.delete(f"/api/todos/{task['id']}").status_code == 404
    assert (
        client.post("/api/todos", json={"title": "x", "parent_id": task["id"]}).status_code == 404
    )

    use_session(client, two_users["anjani"])
    assert titles(client) == ["Anjani's task"]
    assert client.get("/api/todos").json()[0]["completed"] is False


def test_clear_completed_only_touches_your_tasks(client, two_users):
    mine = client.post("/api/todos", json={"title": "Anjani's done task"}).json()
    client.patch(f"/api/todos/{mine['id']}", json={"completed": True})
    use_session(client, two_users["ravi"])
    theirs = client.post("/api/todos", json={"title": "Ravi's done task"}).json()
    client.patch(f"/api/todos/{theirs['id']}", json={"completed": True})

    assert client.delete("/api/todos?completed=true").json() == {"deleted": 1}

    use_session(client, two_users["anjani"])
    assert titles(client) == ["Anjani's done task"]


def test_break_it_down_only_works_on_your_tasks(client, two_users):
    class FakeAI:
        def suggest_subtasks(self, title, notes, existing):
            return ["Step one"]

        def parse_task(self, text, now):
            return ParsedTask(title=text, notes=None, due_at=None, priority="medium")

    app.dependency_overrides[get_ai] = lambda: FakeAI()
    task = client.post("/api/todos", json={"title": "Anjani's task"}).json()

    assert client.post("/api/ai/breakdown", json={"todo_id": task["id"]}).status_code == 200
    use_session(client, two_users["ravi"])
    assert client.post("/api/ai/breakdown", json={"todo_id": task["id"]}).status_code == 404


def test_sign_in_is_checked_before_the_ai_key(client):
    """Without a session the answer is 401, not the 503 that reveals AI configuration."""
    assert client.post("/api/ai/parse", json={"text": "x"}).status_code == 401


# --- Admin commands -------------------------------------------------------------------------


def test_make_admin_gives_the_admin_role(client, two_users):
    with Session(db.engine) as session:
        assert cli.make_admin(session, "RAVI@example.com") == "ravi@example.com is now an admin."
        assert (
            cli.make_admin(session, "ravi@example.com") == "ravi@example.com is already an admin."
        )
        roles = {u.email: u.role for u in session.exec(select(User))}

    assert roles == {"ravi@example.com": Role.admin, "anjani@example.com": Role.user}


def test_claim_tasks_moves_ownerless_tasks_only(client, two_users):
    client.post("/api/todos", json={"title": "Anjani's task"})
    with Session(db.engine) as session:
        session.add(Todo(title="From v1"))
        session.commit()

        assert cli.claim_tasks(session, "ravi@example.com") == 1
        assert cli.claim_tasks(session, "ravi@example.com") == 0

    use_session(client, two_users["ravi"])
    assert titles(client) == ["From v1"]


def test_commands_explain_a_missing_account(client):
    with Session(db.engine) as session, pytest.raises(cli.CommandError, match="Sign up"):
        cli.make_admin(session, "nobody@example.com")
