import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from pwdlib import PasswordHash

passwords = PasswordHash.recommended()
DUMMY_HASH = passwords.hash(secrets.token_urlsafe(32))

def digest(value):
    return hashlib.sha256(value.encode() if isinstance(value, str) else value).hexdigest()

def hash_password(value):
    return passwords.hash(value)

def verify_password(value, hashed):
    try:
        return passwords.verify(value, hashed)
    except Exception:
        return False

def future(**kwargs):
    return (datetime.now(timezone.utc) + timedelta(**kwargs)).isoformat(timespec='microseconds')
