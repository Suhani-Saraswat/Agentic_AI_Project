from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from typing import List
import os
from pathlib import Path

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # Server settings
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"

    # LLM Settings
    OPENAI_API_KEY: str = Field(default="")
    ANTHROPIC_API_KEY: str = Field(default="")
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    DEFAULT_LLM_PROVIDER: str = "openai"  # openai, anthropic, ollama, mock
    DEFAULT_MODEL_NAME: str = "gpt-4o"

    # Execution Guardrails
    MAX_EXECUTION_TIME: int = 15  # seconds
    MAX_RETRIES: int = 3
    MAX_MEMORY_MB: int = 512

    # Storage paths
    UPLOAD_DIR: str = "./uploads"
    SANDBOX_TEMP_DIR: str = "./temp_sandbox"

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    def setup_directories(self) -> None:
        Path(self.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
        Path(self.SANDBOX_TEMP_DIR).mkdir(parents=True, exist_ok=True)

settings = Settings()
settings.setup_directories()
