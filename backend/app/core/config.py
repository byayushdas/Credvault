import base64
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / '.env', extra='ignore')
    DATABASE_URL: str = 'postgresql+psycopg://credvault:credvault_local@localhost:5432/credvault'
    MIGRATION_DATABASE_URL: str | None = None
    AES_MASTER_KEY: str
    ENVIRONMENT: str = 'development'
    APP_ORIGIN: str = 'http://localhost:5173'
    STORAGE_PATH: str = str(ROOT / 'storage' / 'encrypted')
    MAILBOX_PATH: str = str(ROOT / 'mailbox')
    SESSION_HOURS: int = 8
    SECURE_COOKIES: bool = False

    def encryption_key(self):
        try:
            key = base64.b64decode(self.AES_MASTER_KEY, validate=True)
            if len(key) != 32:
                raise ValueError()
            return key
        except Exception as exc:
            raise RuntimeError('AES_MASTER_KEY must contain exactly 32 base64-encoded bytes. Run setup once; preserve the key.') from exc

settings = Settings()
settings.encryption_key()
if settings.ENVIRONMENT == 'production' and (not settings.SECURE_COOKIES or not settings.APP_ORIGIN.startswith('https://')):
    raise RuntimeError('Production requires an HTTPS APP_ORIGIN and SECURE_COOKIES=true')
