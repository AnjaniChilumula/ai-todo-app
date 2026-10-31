from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """App settings, read from environment variables or backend/.env."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Origins allowed to call the API from a browser (the Vite dev server by default).
    cors_origins: list[str] = ["http://localhost:5173"]

    # AI features are switched on only when a key is present.
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-opus-5-5"

    @property
    def ai_enabled(self) -> bool:
        return bool(self.anthropic_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
