from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    groq_api_key: str = ""
    groq_model: str = "llama-3.1-70b-versatile"
    groq_base_url: str = "https://api.groq.com/openai/v1"
    database_url: str = "sqlite:///./medflow.db"
    cors_origins: str = "http://localhost:3000"
    secret_key: str = "dev-secret-key"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
