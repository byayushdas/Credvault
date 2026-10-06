import json
import base64
import os
from typing import Any
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from ..core.config import settings

def _get_key() -> bytes:
    try:
        key = base64.b64decode(settings.AES_MASTER_KEY)
    except Exception:
        key = settings.AES_MASTER_KEY.encode()
    # Ensure exactly 32 bytes for AES-256
    return key.ljust(32, b'\0')[:32]

def encrypt_bytes(data: bytes) -> bytes:
    aesgcm = AESGCM(_get_key())
    nonce = os.urandom(12)
    ct = aesgcm.encrypt(nonce, data, None)
    return nonce + ct

def decrypt_bytes(encrypted_data: bytes) -> bytes:
    nonce, ct = encrypted_data[:12], encrypted_data[12:]
    aesgcm = AESGCM(_get_key())
    return aesgcm.decrypt(nonce, ct, None)

def encrypt_text(text: str) -> str:
    encrypted_bytes = encrypt_bytes(text.encode('utf-8'))
    return base64.b64encode(encrypted_bytes).decode('utf-8')

def decrypt_text(encrypted_text: str) -> str:
    try:
        encrypted_bytes = base64.b64decode(encrypted_text)
        return decrypt_bytes(encrypted_bytes).decode('utf-8')
    except Exception:
        return ""

def encrypt_value(value: Any) -> str:
    return encrypt_text(json.dumps(value))

def decrypt_value(encrypted_val: str) -> Any:
    text = decrypt_text(encrypted_val)
    if text:
        return json.loads(text)
    return None

def encrypt_fields(fields: dict) -> dict:
    return {k: encrypt_value(v) for k, v in fields.items()}

def decrypt_fields(encrypted_fields: dict) -> dict:
    decrypted = {}
    if not encrypted_fields: return decrypted
    for k, v in encrypted_fields.items():
        dec = decrypt_value(v)
        if dec is not None:
            decrypted[k] = dec
    return decrypted
