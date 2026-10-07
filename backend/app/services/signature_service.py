import base64
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives import serialization
from cryptography.exceptions import InvalidSignature
from ..models import IssuerKey, uid, now
from .encryption_service import canonical, encrypt_bytes, decrypt_bytes

def create_key(db, organization_id):
    private = Ed25519PrivateKey.generate()
    kid = uid()
    key = IssuerKey(id=kid, organization_id=organization_id,
        public_key=private.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo).decode(),
        private_encrypted=encrypt_bytes(private.private_bytes(serialization.Encoding.Raw, serialization.PrivateFormat.Raw, serialization.NoEncryption()), 'signing:' + kid))
    db.add(key)
    db.flush()
    return key

def sign(key, payload):
    private = Ed25519PrivateKey.from_private_bytes(decrypt_bytes(key.private_encrypted, 'signing:' + key.id))
    return base64.b64encode(private.sign(canonical(payload))).decode()

def verify(public_key, payload, signature):
    try:
        serialization.load_pem_public_key(public_key.encode()).verify(base64.b64decode(signature, validate=True), canonical(payload))
        return True
    except (ValueError, TypeError, InvalidSignature):
        return False

def context(document):
    return {'format': 'CredVault-claim-v' + str(document.proof_version or 1), 'credential_id': document.id, 'owner_id': document.owner_id,
        'issuer_id': document.issuer_id, 'key_id': document.key_id, 'version': document.version,
        'credential_type': document.type, 'issued_at': document.issued_at, 'expires_at': document.expires_at,
        **({'assessment_date':document.assessment_date} if document.assessment_date else {}),
        **({'signed_at':document.created_at} if document.proof_version == 2 else {})}

def claim_payload(document, field, value):
    return {**context(document), 'field': field, 'value': value}

def manifest(document, claims):
    return {**context(document), 'format': 'CredVault-record-v' + str(document.proof_version or 1), 'title': document.title,
        'category': document.category, 'claims': claims, 'file_hash': document.file_hash,
        'replaces_id': document.replaces_id}

def key_trusted(db, document):
    from ..models import Organization
    key = db.get(IssuerKey, document.key_id) if document.key_id else None
    org = db.get(Organization, document.issuer_id) if document.issuer_id else None
    trusted = bool(key and org and org.approved and not key.revoked_at and key.organization_id == document.issuer_id
        and key.valid_from <= document.created_at and (not key.valid_until or document.created_at < key.valid_until))
    return key, trusted
