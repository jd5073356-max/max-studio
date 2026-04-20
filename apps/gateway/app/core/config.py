"""Configuración centralizada del gateway.

Lee variables de entorno desde `.env` (dev) o el entorno del proceso (prod).
"""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Supabase (accedido vía REST con httpx)
    supabase_url: str = Field(default="", description="https://<project>.supabase.co")
    supabase_service_key: str = Field(default="", description="Service role key")

    # Auth
    jwt_secret: str = Field(default="change-me-in-production-64-chars-random-string-please")
    jwt_algorithm: str = "HS256"
    jwt_expiration_days: int = 30
    cookie_name: str = "max_auth"
    cookie_secure: bool = False  # True en producción con HTTPS
    cookie_samesite: str = "lax"

    # LLM
    anthropic_api_key: str = Field(default="", description="API key Anthropic")
    default_model: str = Field(default="claude-sonnet-4-6", description="Modelo por defecto")

    # Secretos compartidos
    agent_api_key: str = Field(default="change-me-agent-key")
    internal_api_key: str = Field(default="change-me-internal-key")

    # Web Push (Step 15)
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_subject: str = "mailto:tu@email.com"

    # Servicios MAX internos
    dispatch_url: str = "http://localhost:8001"
    dispatch_secret: str = Field(default="", description="JWT secret compartido con Dispatch")
    pi_service_url: str = "http://localhost:8000"
    openclaw_url: str = "http://localhost:8002"

    # CORS + networking
    allowed_origins: str = "http://localhost:3000"
    sandbox_docker_network: str = "bridge_sandbox"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
