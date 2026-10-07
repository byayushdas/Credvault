import base64
import json
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from ..core.config import settings

def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode('utf-8')

def encrypt_bytes(data, context):
    nonce = os.urandom(12)
    return base64.b64encode(nonce + AESGCM(settings.encryption_key()).encrypt(nonce, data, context.encode())).decode()

def decrypt_bytes(data, context):
    raw = base64.b64decode(data, validate=True)
    return AESGCM(settings.encryption_key()).decrypt(raw[:12], raw[12:], context.encode())

def encrypt(value, context):
    return encrypt_bytes(canonical(value), context)

def decrypt(value, context):
    return json.loads(decrypt_bytes(value, context))
