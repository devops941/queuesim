from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    APP_ENV: str = "development"
    APP_NAME: str = "QueueSim"
    API_PREFIX: str = "/api/v1"
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DATABASE: str = "queuesim"
    JWT_SECRET: str = "changeme"
    JWT_ACCESS_MINUTES: int = 15
    JWT_REFRESH_DAYS: int = 7
    REDIS_URL: str = "redis://localhost:6379/0"
    CORS_ORIGINS: str = "http://localhost:5173"
    MAX_UPLOAD_MB: int = 10
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"
    USE_CELERY: bool = False
    OBJECT_STORAGE_PATH: str = "./storage"
    ENGINE_VERSION: str = "1.0.0"
    LOG_LEVEL: str = "INFO"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
