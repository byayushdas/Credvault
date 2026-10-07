"""Private encrypted storage adapter. Cloud implementations must keep this contract."""
import os
from pathlib import Path
from typing import Protocol
from ..core.config import settings
from ..models import uid
from .encryption_service import encrypt_bytes, decrypt_bytes

class EncryptedStore(Protocol):
    def put(self, content: bytes, context: str) -> str: ...
    def get(self, reference: str, context: str) -> bytes: ...
    def delete(self, reference: str) -> None: ...

class LocalEncryptedStore:
    def __init__(self, directory: str):
        self.directory = Path(directory)

    def path(self, reference):
        if Path(reference).name != reference or not reference.endswith('.enc'):
            raise ValueError('Invalid storage reference')
        return self.directory / reference

    def put(self, content, context):
        self.directory.mkdir(parents=True, exist_ok=True)
        reference = uid() + '.enc'
        path = self.path(reference)
        ciphertext = encrypt_bytes(content, context)
        created = False
        try:
            with path.open('x', encoding='ascii') as stream:
                created = True
                stream.write(ciphertext)
                stream.flush()
                os.fsync(stream.fileno())
        except Exception:
            if created:
                path.unlink(missing_ok=True)
            raise
        return reference

    def get(self, reference, context):
        return decrypt_bytes(self.path(reference).read_text(encoding='ascii'), context)

    def delete(self, reference):
        self.path(reference).unlink(missing_ok=True)

def get_storage() -> EncryptedStore:
    return LocalEncryptedStore(settings.STORAGE_PATH)
