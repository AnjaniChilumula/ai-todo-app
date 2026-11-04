import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app import db
from app.auth import sessions
from app.auth.devices import describe_user_agent
from app.main import app
from app.models import User
from tests.helpers import DEFAULT_PASSWORD, sign_up, use_session

CHROME_WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/142.0.0.0 Safari/537.36"
SAFARI_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) Version/18.5 Safari/604.1"


@pytest.fixture
def browser(client):
    """Open extra browsers (separate cookie jars) on the same app and database."""
    opened = []

    def open_browser(user_agent: str | None = None) -> TestClient:
        extra = TestClient(app, headers={"User-Agent": user_agent} if user_agent else None)
        extra.__enter__()
        opened.append(extra)
        return extra

    yield open_browser
    for extra in opened:
        extra.__exit__(None, None, None)


def sign_in(client, email="anjani@example.com", password=DEFAULT_PASSWORD):
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response


def change_password(client, current, new):
    return client.post(
        "/api/account/password", json={"current_password": current, "new_password": new}
    )


# --- Profile --------------------------------------------------------------------------------


def test_rename_trims_and_saves(client):
    sign_up(client)

    response = client.patch("/api/account", json={"name": "  Anjani C  "})

    assert response.status_code == 200
    assert response.json()["name"] == "Anjani C"
    assert client.get("/api/auth/me").json()["name"] == "Anjani C"


def test_rename_rejects_a_blank_name(client):
    sign_up(client)

    assert client.patch("/api/account", json={"name": "   "}).status_code == 422


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("patch", "/api/account"),
        ("post", "/api/account/password"),
        ("get", "/api/account/sessions"),
        ("delete", "/api/account/sessions?others=true"),
    ],
)
def test_account_endpoints_need_a_session(client, method, path):
    assert getattr(client, method)(path).status_code == 401


# --- Password -------------------------------------------------------------------------------


def test_wrong_current_password_is_rejected(client):
    sign_up(client)

    response = change_password(client, "not my password", "brand new password")

    assert response.status_code == 400
    assert response.json()["detail"] == "Your current password is incorrect."


@pytest.mark.parametrize("new", ["short", "anjani@example.com"])
def test_new_password_follows_the_sign_up_rules(client, new):
    sign_up(client)

    assert change_password(client, DEFAULT_PASSWORD, new).status_code == 422


def test_changing_the_password_signs_out_other_devices(client, browser):
    sign_up(client)
    phone = browser()
    sign_in(phone)

    assert change_password(client, DEFAULT_PASSWORD, "brand new password").status_code == 204

    assert client.get("/api/auth/me").status_code == 200  # this device stays signed in
    assert phone.get("/api/auth/me").status_code == 401
    assert (
        phone.post(
            "/api/auth/login", json={"email": "anjani@example.com", "password": DEFAULT_PASSWORD}
        ).status_code
        == 401
    )
    sign_in(phone, password="brand new password")


def test_an_account_without_a_password_can_set_one(client):
    with Session(db.engine) as s:
        user = User(email="google@example.com", name="Google user")
        s.add(user)
        s.commit()
        s.refresh(user)
        use_session(client, sessions.create_session(s, user, None))
    assert client.get("/api/auth/me").json()["has_password"] is False

    response = client.post("/api/account/password", json={"new_password": "first password"})

    assert response.status_code == 204
    assert client.get("/api/auth/me").json()["has_password"] is True
    sign_in(client, email="google@example.com", password="first password")


# --- Sessions -------------------------------------------------------------------------------


def test_sessions_list_this_device_first_with_readable_names(client, browser):
    laptop = browser(CHROME_WINDOWS)
    sign_up(laptop)
    phone = browser(SAFARI_IPHONE)
    sign_in(phone)

    listed = laptop.get("/api/account/sessions").json()

    assert [(s["device"], s["current"]) for s in listed] == [
        ("Chrome on Windows", True),
        ("Safari on iPhone", False),
    ]


def test_sessions_list_only_shows_your_own(client, browser):
    sign_up(client)
    other = browser()
    sign_up(other, email="ravi@example.com", name="Ravi")

    assert len(client.get("/api/account/sessions").json()) == 1


def test_sign_out_one_device(client, browser):
    sign_up(client)
    phone = browser(SAFARI_IPHONE)
    sign_in(phone)
    phone_id = next(s["id"] for s in client.get("/api/account/sessions").json() if not s["current"])

    assert client.delete(f"/api/account/sessions/{phone_id}").status_code == 204

    assert phone.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me").status_code == 200


def test_cannot_end_someone_elses_session(client, browser):
    sign_up(client)
    other = browser()
    sign_up(other, email="ravi@example.com", name="Ravi")
    their_id = other.get("/api/account/sessions").json()[0]["id"]

    assert client.delete(f"/api/account/sessions/{their_id}").status_code == 404
    assert other.get("/api/auth/me").status_code == 200


def test_ending_this_devices_session_signs_you_out_here(client):
    sign_up(client)
    mine = client.get("/api/account/sessions").json()[0]["id"]

    response = client.delete(f"/api/account/sessions/{mine}")

    assert "max-age=0" in response.headers["set-cookie"].lower()
    assert client.get("/api/auth/me").status_code == 401


def test_sign_out_everywhere_else(client, browser):
    sign_up(client)
    others = [browser(), browser()]
    for other in others:
        sign_in(other)

    assert client.delete("/api/account/sessions?others=true").json() == {"ended": 2}

    assert client.get("/api/auth/me").status_code == 200
    assert all(other.get("/api/auth/me").status_code == 401 for other in others)


def test_sign_out_everywhere_needs_the_flag(client):
    sign_up(client)

    assert client.delete("/api/account/sessions?others=false").status_code == 400


@pytest.mark.parametrize(
    ("user_agent", "label"),
    [
        (CHROME_WINDOWS, "Chrome on Windows"),
        (CHROME_WINDOWS + " Edg/142.0.0.0", "Edge on Windows"),
        (SAFARI_IPHONE, "Safari on iPhone"),
        ("Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:140.0) Firefox/140.0", "Firefox on Mac"),
        ("Mozilla/5.0 (Linux; Android 15) Chrome/142.0 Mobile Safari/537.36", "Chrome on Android"),
        ("curl/8.10.1", "Unknown device"),
        (None, "Unknown device"),
    ],
)
def test_device_labels(user_agent, label):
    assert describe_user_agent(user_agent) == label
