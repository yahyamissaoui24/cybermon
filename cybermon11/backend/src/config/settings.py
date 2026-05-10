from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://cybermon:sentinel_password@localhost:5432/cybermon"
    REDIS_URL: str = "redis://localhost:6379"
    SECRET_KEY: str = "cybermon_secret_key_sentinel_alpha_2024"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASS: str = ""
    ALERT_EMAIL: str = "admin@cybermon.io"

    class Config:
        env_file = ".env"

settings = Settings()
