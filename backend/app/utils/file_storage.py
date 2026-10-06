import os
from fastapi import UploadFile
from ..services.encryption_service import encrypt_bytes, decrypt_bytes

def save_upload_file(upload_file: UploadFile, destination: str) -> str:
    os.makedirs(os.path.dirname(destination), exist_ok=True)
    raw_bytes = upload_file.file.read()
    encrypted_bytes = encrypt_bytes(raw_bytes)
    
    with open(destination, "wb") as f:
        f.write(encrypted_bytes)
    return destination

def read_encrypted_file(filepath: str) -> bytes:
    with open(filepath, "rb") as f:
        encrypted_bytes = f.read()
    return decrypt_bytes(encrypted_bytes)
