"""
Configuração da aplicação — lida do ambiente / .env
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Base de dados
    DATABASE_URL: str = "postgresql://agentoffice:secret@postgres:5432/agentoffice"

    # Redis
    REDIS_URL: str = "redis://redis:6379"

    # LLM
    ANTHROPIC_API_KEY: str = ""
    OPENAI_API_KEY: str    = ""

    # Segurança
    SECRET_KEY: str = "dev-secret-muda-em-producao"
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "muda-esta-password"

    # App
    ENVIRONMENT: str = "development"
    SKILLS_DIR: str  = "/app/skills"

    class Config:
        env_file = ".env"
        extra    = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
