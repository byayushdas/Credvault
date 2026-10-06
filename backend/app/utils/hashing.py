import hashlib
import json
import os
from ..services.encryption_service import decrypt_bytes

def calculate_integrity_hash(core_data: dict, file_path: str = None) -> str:
    hash_obj = hashlib.sha256()
    
    # Hash the canonical core_data
    data_str = json.dumps(core_data, sort_keys=True)
    hash_obj.update(data_str.encode('utf-8'))
    
    # Decrypt and hash the original physical bytes to verify true payload integrity
    if file_path and os.path.exists(file_path):
        with open(file_path, "rb") as f:
            encrypted_bytes = f.read()
            raw_bytes = decrypt_bytes(encrypted_bytes)
            hash_obj.update(raw_bytes)
                
    return hash_obj.hexdigest()
