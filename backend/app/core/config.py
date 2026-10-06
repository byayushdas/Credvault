from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./credvault.db"
    JWT_SECRET_KEY: str = "CHANGE_THIS_IN_LOCAL_ENVIRONMENT"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    AES_MASTER_KEY: str = "GENERATE_A_32_BYTE_BASE64_KEY"
    STORAGE_PATH: str = "./storage/encrypted"
    PRIVATE_KEY_PATH: str = "./keys/issuer_private.pem"
    PUBLIC_KEY_PATH: str = "./keys/issuer_public.pem"
    MAX_UPLOAD_SIZE_MB: int = 10
    CORS_ORIGINS: str = "http://localhost:5173"

    @property
    def async_database_url(self) -> str:
        if self.DATABASE_URL.startswith("sqlite://") and not self.DATABASE_URL.startswith("sqlite+aiosqlite://"):
            return self.DATABASE_URL.replace("sqlite://", "sqlite+aiosqlite://", 1)
        return self.DATABASE_URL
        
    class Config:
        env_file = ".env"

settings = Settings()
