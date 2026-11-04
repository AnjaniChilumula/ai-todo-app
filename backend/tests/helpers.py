"""Small helpers shared by the tests."""

DEFAULT_PASSWORD = "correct horse battery"


def sign_up(client, email="anjani@example.com", name="Anjani", password=DEFAULT_PASSWORD) -> str:
    """Create an account through the API (which signs the client in) and return its token."""
    response = client.post(
        "/api/auth/signup", json={"name": name, "email": email, "password": password}
    )
    assert response.status_code == 201, response.text
    return response.cookies["session"]


def use_session(client, token: str | None) -> None:
    """Make the client act as whoever owns this session token (or as nobody, with None)."""
    client.cookies.clear()  # setting a cookie without clearing first would send two
    if token is not None:
        client.cookies.set("session", token, domain="testserver.local")
