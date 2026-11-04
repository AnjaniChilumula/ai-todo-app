import secrets
from functools import lru_cache
from typing import Annotated

from fastapi import Depends
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """App settings, read from environment variables or backend/.env."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # SQLite file, created next to where the server is started (backend/).
    database_url: str = "sqlite:///./todos.db"

    # Origins allowed to call the API from a browser (the Vite dev server by default).
    cors_origins: list[str] = ["http://localhost:5173"]

    # Where people open the app. Google redirects back through it (the Vite proxy forwards /api
    # to us), so the session cookie is set for the app's own address.
    app_url: str = "http://localhost:5173"

    # Mark the session cookie Secure (HTTPS only). Leave off for http://localhost development.
    cookie_secure: bool = False

    # Signs the short-lived cookie that carries the OAuth state during the Google redirect.
    # A random value is fine for development; set a fixed long random value in production.
    secret_key: str = Field(default_factory=lambda: secrets.token_urlsafe(32))

    # Sign in with Google: an OAuth client of type "Web application" from Google Cloud Console.
    google_client_id: str | None = None
    google_client_secret: str | None = None

    # AI features are switched on only when a key is present.
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-opus-5-5"

    @field_validator("secret_key")
    @classmethod
    def _never_blank(cls, value: str) -> str:
        # "SECRET_KEY=" in .env means "not set", not "sign with an empty key".
        return value or secrets.token_urlsafe(32)

    @property
    def ai_enabled(self) -> bool:
        return bool(self.anthropic_api_key)

    @property
    def google_enabled(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret)

    @property
    def google_redirect_uri(self) -> str:
        return f"{self.app_url.rstrip('/')}/api/auth/google/callback"


@lru_cache
def get_settings() -> Settings:
    return Settings()


SettingsDep = Annotated[Settings, Depends(get_settings)]
