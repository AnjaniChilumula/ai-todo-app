import hashlib
from datetime import timedelta

import pytest
from sqlmodel import Session, select

from app import db
from app.auth import sessions
from app.config import Settings, get_settings
from app.main import app
from app.models import User, UserSession, utcnow

PASSWORD = "correct horse battery"


def signup(client, email="anjani@example.com", name="Anjani", password=PASSWORD):
    return client.post(
        "/api/auth/signup", json={"name": name, "email": email, "password": password}
    )


def login(client, email="anjani@example.com", password=PASSWORD):
    return client.post("/api/auth/login", json={"email": email, "password": password})


def stored_user(email="anjani@example.com") -> User:
    with Session(db.engine) as s:
        return s.exec(select(User).where(User.email == email)).one()


def session_row(token: str) -> UserSession | None:
    with Session(db.engine) as s:
        return s.get(UserSession, sessions.hash_token(token))


def update_session(token: str, **changes) -> None:
    with Session(db.engine) as s:
        row = s.get(UserSession, sessions.hash_token(token))
        for field, value in changes.items():
            setattr(row, field, value)
        s.add(row)
        s.commit()


# --- Sign up --------------------------------------------------------------------------------


def test_signup_creates_the_account_and_signs_in(client):
    response = signup(client)

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "anjani@example.com"
    assert body["role"] == "user"
    assert body["has_password"] is True
    assert "password" not in str(body).replace("has_password", "")
    assert client.get("/api/auth/me").json()["email"] == "anjani@example.com"


def test_signup_stores_only_an_argon2_hash(client):
    signup(client)

    stored = stored_user().password_hash
    assert stored.startswith("$argon2id$")
    assert PASSWORD not in stored


def test_signup_normalises_email_and_name(client):
    body = signup(client, email="Anjani@Example.COM", name="  Anjani  ").json()

    assert body["email"] == "anjani@example.com"
    assert body["name"] == "Anjani"


def test_signup_rejects_a_taken_email_in_any_case(client):
    signup(client)
    client.cookies.clear()

    response = signup(client, email="ANJANI@example.com")

    assert response.status_code == 409
    assert "already exists" in response.json()["detail"]


@pytest.mark.parametrize(
    "fields",
    [
        {"password": "short"},
        {"password": "x" * 129},
        {"email": "not-an-email"},
        {"name": "   "},
        {"email": "same@example.com", "password": "same@example.com"},
    ],
)
def test_signup_validates_input(client, fields):
    data = {"name": "Anjani", "email": "anjani@example.com", "password": PASSWORD, **fields}

    assert client.post("/api/auth/signup", json=data).status_code == 422


# --- The session cookie ---------------------------------------------------------------------


def test_session_cookie_is_httponly_lax_and_long_lived(client):
    cookie = signup(client).headers["set-cookie"].lower()

    assert cookie.startswith("session=")
    assert "httponly" in cookie
    assert "samesite=lax" in cookie
    assert "path=/" in cookie
    assert "max-age=2592000" in cookie  # 30 days
    assert "secure" not in cookie  # off for http://localhost by default


def test_session_cookie_is_secure_when_configured(client):
    app.dependency_overrides[get_settings] = lambda: Settings(_env_file=None, cookie_secure=True)

    assert "secure" in signup(client).headers["set-cookie"].lower()


def test_only_a_hash_of_the_token_is_stored(client):
    signup(client)
    token = client.cookies["session"]

    row = session_row(token)
    assert row.id == hashlib.sha256(token.encode()).hexdigest()
    assert row.id != token


# --- Sign in --------------------------------------------------------------------------------


def test_wrong_password_and_unknown_email_get_the_same_answer(client):
    signup(client)
    client.cookies.clear()

    wrong_password = login(client, password="wrong password")
    unknown_email = login(client, email="nobody@example.com")

    assert wrong_password.status_code == unknown_email.status_code == 401
    assert (
        wrong_password.json()
        == unknown_email.json()
        == {"detail": "Email or password is incorrect."}
    )


def test_login_ignores_email_case_and_records_last_login(client):
    signup(client)
    client.cookies.clear()

    response = login(client, email="ANJANI@EXAMPLE.COM")

    assert response.status_code == 200
    assert stored_user().last_login_at is not None


def test_every_sign_in_gets_a_new_session(client):
    signup(client)
    first = client.cookies["session"]

    login(client)
    second = client.cookies["session"]

    assert second != first
    assert session_row(first) is None  # the old session was ended
    assert session_row(second) is not None


def test_disabled_account_cannot_sign_in_or_use_its_session(client):
    signup(client)
    with Session(db.engine) as s:
        user = s.exec(select(User)).one()
        user.is_active = False
        s.add(user)
        s.commit()

    assert client.get("/api/auth/me").status_code == 401
    assert login(client).status_code == 403


# --- /me and sign out -----------------------------------------------------------------------


def test_me_requires_a_session(client):
    assert client.get("/api/auth/me").status_code == 401


def test_logout_ends_the_session_and_clears_the_cookie(client):
    signup(client)
    token = client.cookies["session"]

    response = client.post("/api/auth/logout")

    assert response.status_code == 204
    assert "max-age=0" in response.headers["set-cookie"].lower()  # tells the browser to drop it
    assert session_row(token) is None
    client.cookies.set("session", token)
    assert client.get("/api/auth/me").status_code == 401


# --- Expiry ---------------------------------------------------------------------------------


def test_expired_session_is_rejected_and_deleted(client):
    signup(client)
    token = client.cookies["session"]
    update_session(token, expires_at=utcnow() - timedelta(seconds=1))

    assert client.get("/api/auth/me").status_code == 401
    assert session_row(token) is None


def test_activity_extends_the_session_but_never_past_30_days(client):
    signup(client)
    token = client.cookies["session"]
    long_ago = utcnow() - timedelta(days=29, hours=12)
    update_session(token, created_at=long_ago, last_seen_at=long_ago)

    assert client.get("/api/auth/me").status_code == 200

    row = session_row(token)
    lifetime = row.expires_at - row.created_at
    assert lifetime == sessions.MAX_AGE


def test_recent_activity_extends_by_the_idle_timeout(client):
    signup(client)
    token = client.cookies["session"]
    update_session(token, last_seen_at=utcnow() - timedelta(hours=1))

    client.get("/api/auth/me")

    remaining = session_row(token).expires_at - utcnow()
    assert sessions.IDLE_TIMEOUT - timedelta(minutes=1) < remaining <= sessions.IDLE_TIMEOUT


# --- Lockout --------------------------------------------------------------------------------


def test_five_failures_lock_sign_in_even_with_the_right_password(client):
    signup(client)
    client.cookies.clear()
    for _ in range(5):
        assert login(client, password="wrong password").status_code == 401

    response = login(client)

    assert response.status_code == 429
    assert "Too many attempts" in response.json()["detail"]
    assert int(response.headers["retry-after"]) > 0


def test_a_successful_sign_in_resets_the_failure_count(client):
    signup(client)
    client.cookies.clear()
    for _ in range(4):
        login(client, password="wrong password")
    assert login(client).status_code == 200
    for _ in range(4):
        login(client, password="wrong password")

    assert login(client).status_code == 200


# --- Cross-site requests --------------------------------------------------------------------


def test_cross_site_requests_are_blocked(client):
    signup(client)

    response = client.post("/api/auth/logout", headers={"Origin": "https://evil.example"})

    assert response.status_code == 403
    assert client.get("/api/auth/me").status_code == 200  # still signed in


def test_requests_from_the_app_are_allowed(client):
    signup(client)

    response = client.post("/api/auth/logout", headers={"Origin": "http://localhost:5173"})

    assert response.status_code == 204
