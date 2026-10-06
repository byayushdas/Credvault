import json
import base64
import os
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import serialization, hashes
from ..core.config import settings

def ensure_keys_exist():
    os.makedirs(os.path.dirname(settings.PRIVATE_KEY_PATH), exist_ok=True)
    if not os.path.exists(settings.PRIVATE_KEY_PATH) or not os.path.exists(settings.PUBLIC_KEY_PATH):
        priv_pem, pub_pem = generate_key_pair()
        with open(settings.PRIVATE_KEY_PATH, "w") as f:
            f.write(priv_pem)
        with open(settings.PUBLIC_KEY_PATH, "w") as f:
            f.write(pub_pem)

def generate_key_pair():
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_key = private_key.public_key()
    
    priv_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    )
    
    pub_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    )
    return priv_pem.decode('utf-8'), pub_pem.decode('utf-8')

def get_private_key():
    ensure_keys_exist()
    with open(settings.PRIVATE_KEY_PATH, "rb") as f:
        return serialization.load_pem_private_key(f.read(), password=None)

def sign_data(data: dict) -> str:
    private_key = get_private_key()
    data_str = json.dumps(data, sort_keys=True)
    
    signature = private_key.sign(
        data_str.encode('utf-8'),
        padding.PSS(
            mgf=padding.MGF1(hashes.SHA256()),
            salt_length=padding.PSS.MAX_LENGTH
        ),
        hashes.SHA256()
    )
    return base64.b64encode(signature).decode('utf-8')

def verify_signature(data: dict, signature_b64: str, public_key_pem: str) -> bool:
    try:
        public_key = serialization.load_pem_public_key(public_key_pem.encode('utf-8'))
        signature = base64.b64decode(signature_b64)
        data_str = json.dumps(data, sort_keys=True)
        
        public_key.verify(
            signature,
            data_str.encode('utf-8'),
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.MAX_LENGTH
            ),
            hashes.SHA256()
        )
        return True
    except Exception:
        return False
