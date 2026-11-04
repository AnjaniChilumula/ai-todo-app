from urllib.parse import quote

import pytest
from authlib.integrations.starlette_client import OAuthError
from fastapi.responses import RedirectResponse
from sqlmodel import Session, select

from app import db
from app.auth.google import get_google
from app.config import Settings, get_settings
from app.main import app
from app.models import User
from tests.helpers import DEFAULT_PASSWORD, sign_up, use_session

APP = "http://localhost:5173"


class FakeGoogle:
    """Stands in for Authlib's Google client: no network, and we choose what Google "says"."""

    def __init__(self):
        self.claims = {
            "sub": "google-123",
            "email": "anjani@gmail.com",
            "email_verified": True,
            "name": "Anjani C",
        }
        self.error = None

    async def authorize_redirect(self, request, redirect_uri):
        target = f"https://accounts.google.com/o/oauth2/v2/auth?redirect_uri={quote(redirect_uri)}"
        return RedirectResponse(target, status_code=302)

    async def authorize_access_token(self, request):
        if self.error:
            raise self.error
        return {"userinfo": self.claims}


@pytest.fixture
def google(client):
    fake = FakeGoogle()
    app.dependency_overrides[get_google] = lambda: fake
    client.follow_redirects = False
    return fake


def callback(client):
    return client.get("/api/auth/google/callback?code=abc&state=xyz")


def users() -> list[User]:
    with Session(db.engine) as s:
        return list(s.exec(select(User)))


# --- Configuration --------------------------------------------------------------------------


def test_google_is_off_until_configured(client):
    client.follow_redirects = False

    assert client.get("/api/auth/config").json() == {"password": True, "google": False}
    assert client.get("/api/auth/google/start").status_code == 404
    assert callback(client).status_code == 404


def test_config_reports_google_when_both_credentials_are_set(client):
    app.dependency_overrides[get_settings] = lambda: Settings(
        _env_file=None, google_client_id="id", google_client_secret="secret"
    )

    assert client.get("/api/auth/config").json() == {"password": True, "google": True}


def test_the_real_client_asks_for_openid_with_pkce(client):
    settings = Settings(_env_file=None, google_client_id="id", google_client_secret="secret")

    google_client = get_google(settings)

    assert google_client.client_kwargs["scope"] == "openid email profile"
    assert google_client.client_kwargs["code_challenge_method"] == "S256"


# --- The flow -------------------------------------------------------------------------------


def test_start_sends_the_browser_to_google_with_our_callback(client, google):
    response = client.get("/api/auth/google/start")

    assert response.status_code == 302
    assert response.headers["location"].startswith("https://accounts.google.com/")
    assert quote(f"{APP}/api/auth/google/callback") in response.headers["location"]


def test_first_google_sign_in_creates_an_account(client, google):
    response = callback(client)

    assert response.status_code == 303
    assert response.headers["location"] == f"{APP}/"
    me = client.get("/api/auth/me").json()
    assert me["email"] == "anjani@gmail.com"
    assert me["name"] == "Anjani C"
    assert me["google_linked"] is True
    assert me["has_password"] is False


def test_signing_in_again_uses_the_same_account(client, google):
    callback(client)
    use_session(client, None)
    google.claims["name"] = "Changed on Google"

    callback(client)

    assert len(users()) == 1
    assert client.get("/api/auth/me").json()["name"] == "Anjani C"


def test_an_existing_account_with_the_same_email_is_linked(client, google):
    sign_up(client, email="anjani@gmail.com")
    use_session(client, None)
    google.claims["email"] = "Anjani@Gmail.com"

    callback(client)

    assert len(users()) == 1
    me = client.get("/api/auth/me").json()
    assert me["google_linked"] is True
    assert me["has_password"] is True  # the password still works too
    use_session(client, None)
    login = {"email": "anjani@gmail.com", "password": DEFAULT_PASSWORD}
    assert client.post("/api/auth/login", json=login).status_code == 200


def test_an_email_linked_to_another_google_account_is_refused(client, google):
    callback(client)
    use_session(client, None)
    google.claims["sub"] = "a-different-google-account"

    response = callback(client)

    assert response.headers["location"] == f"{APP}/login?error=google_conflict"
    assert client.get("/api/auth/me").status_code == 401


@pytest.mark.parametrize(
    "claims",
    [{"email_verified": False}, {"email_verified": None}, {"email": None}, {"sub": None}],
)
def test_unverified_or_incomplete_identities_are_refused(client, google, claims):
    google.claims.update(claims)

    response = callback(client)

    assert response.headers["location"] == f"{APP}/login?error=google_unverified"
    assert users() == []


def test_a_failed_or_forged_callback_goes_back_to_sign_in(client, google):
    google.error = OAuthError(error="mismatching_state")

    response = callback(client)

    assert response.headers["location"] == f"{APP}/login?error=google_failed"
    assert "session=" not in response.headers.get("set-cookie", "")


def test_a_disabled_account_cannot_sign_in_with_google(client, google):
    callback(client)
    with Session(db.engine) as s:
        user = s.exec(select(User)).one()
        user.is_active = False
        s.add(user)
        s.commit()
    use_session(client, None)

    response = callback(client)

    assert response.headers["location"] == f"{APP}/login?error=disabled"
    assert client.get("/api/auth/me").status_code == 401


def test_a_google_account_can_set_a_password_later(client, google):
    callback(client)

    response = client.post("/api/account/password", json={"new_password": "my new password"})

    assert response.status_code == 204
    use_session(client, None)
    login = {"email": "anjani@gmail.com", "password": "my new password"}
    assert client.post("/api/auth/login", json=login).status_code == 200
