"""Sign in with Google, using Authlib's OpenID Connect client.

Authlib handles the security-critical parts: the state value (CSRF for the redirect), PKCE, the
nonce, exchanging the code for tokens, and checking the ID token's signature, issuer, audience and
expiry. We only decide which account the verified Google identity belongs to.
"""

from authlib.integrations.starlette_client import OAuth
from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.config import SettingsDep
from app.models import User

GOOGLE_METADATA_URL = "https://accounts.google.com/.well-known/openid-configuration"

oauth = OAuth()


def get_google(settings: SettingsDep):
    """FastAPI dependency: the Google client, or 404 when Google sign-in isn't set up."""
    if not settings.google_enabled:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Google sign-in is not set up.")
    client = oauth.create_client("google")
    if client is None:
        oauth.register(
            name="google",
            client_id=settings.google_client_id,
            client_secret=settings.google_client_secret,
            server_metadata_url=GOOGLE_METADATA_URL,
            client_kwargs={"scope": "openid email profile", "code_challenge_method": "S256"},
        )
        client = oauth.create_client("google")
    return client


def account_for_google(db: Session, claims: dict) -> User:
    """Find or create the account for a verified Google identity.

    1. An account already linked to this Google id.
    2. Otherwise an account with the same email: Google has verified the email, so it's the same
       person, and the accounts are linked.
    3. Otherwise a new account without a password (one can be set later in Settings).
    """
    sub = claims["sub"]
    email = claims["email"].lower()

    user = db.exec(select(User).where(User.google_sub == sub)).first()
    if user is None:
        user = db.exec(select(User).where(User.email == email)).first()
        if user is not None and user.google_sub is None:
            user.google_sub = sub
    if user is None:
        name = (claims.get("name") or email.split("@")[0]).strip()[:80] or "Google user"
        user = User(email=email, name=name, google_sub=sub)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
