from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    SECRET_KEY: str = "fallback-secret-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    CORS_ORIGINS: str = "http://localhost:4200"

    class Config:
        env_file = ".env"

    def get_origins(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]


settings = Settings()
