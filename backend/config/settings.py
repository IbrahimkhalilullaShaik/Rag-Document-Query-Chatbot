"""
Application Configuration
Centralized settings management using pydantic-settings
"""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Server
    env: str = "development"
    port: int = 8000
    allowed_origins: str = "http://localhost:3000"

    # AI Provider
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    llm_provider: str = "anthropic"
    llm_model: str = "claude-sonnet-4-20250514"

    # Embeddings
    embedding_model: str = "sentence-transformers/all-mpnet-base-v2"

    # RAG
    chunk_size: int = 800
    chunk_overlap: int = 150
    top_k_retrieval: int = 5
    similarity_threshold: float = 0.35
    max_context_tokens: int = 3000

    # File Upload
    max_file_size_mb: int = 50
    allowed_extensions: str = "pdf,txt"

    # Vector Store
    vector_store_path: str = "./data/vector_stores"
    persist_vector_store: bool = True

    # Logging
    log_level: str = "INFO"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    @property
    def allowed_extensions_list(self) -> list[str]:
        return [e.strip().lower() for e in self.allowed_extensions.split(",")]

    @property
    def max_file_size_bytes(self) -> int:
        return self.max_file_size_mb * 1024 * 1024


@lru_cache()
def get_settings() -> Settings:
    return Settings()
