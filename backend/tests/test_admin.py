import pytest
from sqlmodel import Session

from app import cli, db
from tests.helpers import DEFAULT_PASSWORD, sign_up, use_session


@pytest.fixture
def accounts(client):
    """An admin and a regular user. The client starts signed in as the admin."""
    ravi = sign_up(client, email="ravi@example.com", name="Ravi")
    client.post("/api/todos", json={"title": "Ravi's private task"})
    client.post("/api/todos", json={"title": "Another one"})
    use_session(client, None)
    admin = sign_up(client, email="boss@example.com", name="Boss")
    with Session(db.engine) as s:
        cli.make_admin(s, "boss@example.com")
    users = {u["email"]: u for u in client.get("/api/admin/users").json()}
    return {"admin": admin, "ravi": ravi, "ids": {email: u["id"] for email, u in users.items()}}


def test_admin_endpoints_need_a_session(client):
    assert client.get("/api/admin/users").status_code == 401
    assert client.patch("/api/admin/users/1", json={"role": "admin"}).status_code == 401


def test_regular_users_get_403(client, accounts):
    use_session(client, accounts["ravi"])

    assert client.get("/api/admin/users").status_code == 403
    assert (
        client.patch(
            f"/api/admin/users/{accounts['ids']['boss@example.com']}", json={"role": "user"}
        )
    ).status_code == 403


def test_list_shows_counts_and_activity_but_not_task_contents(client, accounts):
    response = client.get("/api/admin/users")

    users = response.json()
    assert [(u["email"], u["role"], u["task_count"]) for u in users] == [
        ("ravi@example.com", "user", 2),
        ("boss@example.com", "admin", 0),
    ]
    assert all(u["last_active_at"] for u in users)
    assert "private task" not in response.text
    assert "password" not in response.text


def test_disabling_signs_the_account_out_and_blocks_sign_in(client, accounts):
    ravi_id = accounts["ids"]["ravi@example.com"]

    body = client.patch(f"/api/admin/users/{ravi_id}", json={"is_active": False}).json()

    assert body["is_active"] is False
    use_session(client, accounts["ravi"])
    assert client.get("/api/auth/me").status_code == 401
    login = {"email": "ravi@example.com", "password": DEFAULT_PASSWORD}
    assert client.post("/api/auth/login", json=login).status_code == 403


def test_enabling_again_allows_sign_in(client, accounts):
    ravi_id = accounts["ids"]["ravi@example.com"]
    client.patch(f"/api/admin/users/{ravi_id}", json={"is_active": False})
    client.patch(f"/api/admin/users/{ravi_id}", json={"is_active": True})
    use_session(client, None)

    login = {"email": "ravi@example.com", "password": DEFAULT_PASSWORD}
    assert client.post("/api/auth/login", json=login).status_code == 200


def test_promote_and_demote(client, accounts):
    ravi_id = accounts["ids"]["ravi@example.com"]

    assert (
        client.patch(f"/api/admin/users/{ravi_id}", json={"role": "admin"}).json()["role"]
        == "admin"
    )
    use_session(client, accounts["ravi"])
    assert client.get("/api/admin/users").status_code == 200

    use_session(client, accounts["admin"])
    assert (
        client.patch(f"/api/admin/users/{ravi_id}", json={"role": "user"}).json()["role"] == "user"
    )


def test_admins_cannot_change_their_own_account(client, accounts):
    my_id = accounts["ids"]["boss@example.com"]

    for change in ({"role": "user"}, {"is_active": False}):
        response = client.patch(f"/api/admin/users/{my_id}", json=change)
        assert response.status_code == 400
    assert client.get("/api/auth/me").json()["role"] == "admin"


def test_unknown_account_is_404(client, accounts):
    assert client.patch("/api/admin/users/999", json={"role": "admin"}).status_code == 404


def test_invalid_role_is_rejected(client, accounts):
    ravi_id = accounts["ids"]["ravi@example.com"]

    assert client.patch(f"/api/admin/users/{ravi_id}", json={"role": "owner"}).status_code == 422
