import base64
import io
from datetime import datetime, timedelta
from pathlib import Path
from fastapi import HTTPException
from sqlalchemy import select
from PIL import Image
from ..models import Credential, IssuerKey, User, Membership, Organization, Notification, uid, now
from ..core.config import settings
from ..core.security import digest
from ..schemas.contracts import timestamp
from .encryption_service import encrypt, decrypt, encrypt_bytes, decrypt_bytes, canonical
from .signature_service import claim_payload, manifest, sign, verify, key_trusted
from .audit_service import audit
from .storage_service import get_storage

SCHEMAS = {
    'GENERAL': {'label': 'Organisation credential', 'category': 'General', 'fields': {
        'credentialName': {'label': 'Credential name', 'type': 'string'},
        'referenceNumber': {'label': 'Reference number', 'type': 'string'},
        'description': {'label': 'Description', 'type': 'string'}}},
    'EMPLOYMENT': {'label': 'Employment credential', 'category': 'Employment', 'fields': {
        'jobTitle': {'label': 'Job title', 'type': 'string'},
        'department': {'label': 'Department', 'type': 'string'},
        'employeeId': {'label': 'Employee ID', 'type': 'string'},
        'employmentStatus': {'label': 'Employment status', 'type': 'string'}}},
    'HEALTHCARE': {'label': 'Healthcare certificate', 'category': 'Healthcare', 'fields': {
        'certificateName': {'label': 'Certificate name', 'type': 'string'},
        'referenceNumber': {'label': 'Reference number', 'type': 'string'},
        'practitioner': {'label': 'Issuing practitioner', 'type': 'string'},
        'statement': {'label': 'Certified statement', 'type': 'string'}}},
    'SEMESTER_MARKSHEET': {'label': 'Semester Marksheet', 'category': 'Education', 'fields': {
        'course': {'label': 'Course', 'type': 'string'}, 'semester': {'label': 'Semester', 'type': 'number'},
        'cgpa': {'label': 'CGPA', 'type': 'number'}, 'rollNumber': {'label': 'Roll number', 'type': 'string'}}},
    'DEGREE': {'label': 'Education credential', 'category': 'Education', 'fields': {
        'degree': {'label': 'Degree', 'type': 'string'}, 'universityId': {'label': 'University ID', 'type': 'string'},
        'cgpa': {'label': 'CGPA', 'type': 'number'}, 'rollNumber': {'label': 'Roll number', 'type': 'string'}}},
    'MARKSHEET': {'label': 'Marksheet', 'category': 'Education', 'fields': {
        'course': {'label': 'Course', 'type': 'string'}, 'semester': {'label': 'Semester', 'type': 'number'},
        'percentage': {'label': 'Percentage', 'type': 'number'}, 'rollNumber': {'label': 'Roll number', 'type': 'string'}}},
    'AGE': {'label': 'Age threshold', 'category': 'Identity', 'fields': {
        'over18': {'label': 'Age 18 or older', 'type': 'boolean'},
        'assessmentDate': {'label': 'Assessment date', 'type': 'date'}}},
    'AADHAAR_STYLE': {'label': 'Aadhaar-style demo', 'category': 'Government', 'fields': {
        'uid': {'label': 'Aadhaar Number', 'type': 'string'},
        'name': {'label': 'Name', 'type': 'string'},
        'dob': {'label': 'Date of Birth', 'type': 'date'}}},
    'PAN_STYLE': {'label': 'PAN-style demo', 'category': 'Government', 'fields': {
        'pan': {'label': 'PAN Number', 'type': 'string'},
        'name': {'label': 'Name', 'type': 'string'},
        'dob': {'label': 'Date of Birth', 'type': 'date'}}},
    'PASSPORT': {'label': 'Passport', 'category': 'Government', 'fields': {
        'passportNumber': {'label': 'Passport Number', 'type': 'string'},
        'nationality': {'label': 'Nationality', 'type': 'string'},
        'name': {'label': 'Name', 'type': 'string'},
        'dob': {'label': 'Date of Birth', 'type': 'date'}}},
    'DRIVING_LICENSE': {'label': 'Driving Licence', 'category': 'Government', 'fields': {
        'licenseNumber': {'label': 'Licence Number', 'type': 'string'},
        'name': {'label': 'Name', 'type': 'string'},
        'dob': {'label': 'Date of Birth', 'type': 'date'},
        'vehicleClasses': {'label': 'Vehicle Classes', 'type': 'string'}}}
}

def owner_lookup(db, reference):
    from sqlalchemy import or_
    owner = db.scalar(select(User).join(Membership, Membership.user_id == User.id).where(
        Membership.role == 'OWNER', User.active.is_(True), or_(User.id == reference, User.vault_id == reference)))
    if not owner:
        raise HTTPException(404, 'Owner reference is unavailable. Ask the owner for their exact vault ID.')
    return owner

def validate_claims(kind, values, issue, expiry):
    schema = SCHEMAS[kind]['fields']
    # Retain legacy signed degree claims, while allowing new degrees without CGPA.
    if kind == 'DEGREE' and 'cgpa' not in values:
        schema = {name: spec for name, spec in schema.items() if name != 'cgpa'}
    if set(values) != set(schema):
        raise HTTPException(422, 'Provide exactly the fields defined for this credential type')
    for name, spec in schema.items():
        v = values[name]
        if spec['type'] in ('string', 'date') and (not isinstance(v, str) or not 1 <= len(v.strip()) <= 300):
            raise HTTPException(422, spec['label'] + ' is required (maximum 300 characters)')
        if spec['type'] == 'number' and (type(v) not in (int, float) or v != v or not 0 <= v <= 100):
            raise HTTPException(422, spec['label'] + ' must be a number from 0 to 100')
        if spec['type'] == 'boolean' and type(v) is not bool:
            raise HTTPException(422, spec['label'] + ' must be true or false')
    if kind in ('DEGREE', 'SEMESTER_MARKSHEET') and values.get('cgpa', 0) > 10:
        raise HTTPException(422, 'CGPA must be between 0 and 10')
    if kind in ('MARKSHEET', 'SEMESTER_MARKSHEET') and (values['semester'] != int(values['semester']) or not 1 <= values['semester'] <= 20):
        raise HTTPException(422, 'Semester must be a whole number from 1 to 20')
    if issue > now() or (expiry and expiry <= issue):
        raise HTTPException(422, 'Issue date cannot be in the future; expiry must follow issue date')
    if kind == 'AGE':
        assessment = timestamp(values['assessmentDate'])
        if not expiry or assessment > now() or assessment > issue or datetime.fromisoformat(expiry) > datetime.fromisoformat(assessment) + timedelta(days=365):
            raise HTTPException(422, 'Age attestations require an assessment on/before issue and expiry within 365 days of assessment')

def notify(db, user_id, message, link):
    user = db.get(User, user_id)
    if user and user.notifications:
        db.add(Notification(user_id=user_id, message=message, link=link))

def notify_org(db, org_id, message, link):
    for m in db.scalars(select(Membership).where(Membership.organization_id == org_id)):
        notify(db, m.user_id, message, link)

def validate_file(content):
    try:
        raw = base64.b64decode(content, validate=True)
    except Exception:
        raise HTTPException(422, 'Attachment must be valid base64')
    if not 1 <= len(raw) <= 10 * 1024 * 1024:
        raise HTTPException(422, 'Attachment must be between 1 byte and 10 MB')
    if raw.startswith(b'%PDF-'):
        from pypdf import PdfReader
        try:
            reader = PdfReader(io.BytesIO(raw), strict=True)
            if reader.is_encrypted or not len(reader.pages):
                raise ValueError()
            root = reader.trailer['/Root']
            if root.get('/OpenAction') or root.get('/AA') or '/JavaScript' in str(root.get('/Names', {})):
                raise ValueError()
        except Exception:
            raise HTTPException(422, 'Use a readable PDF without scripts or automatic actions')
        return raw, 'application/pdf'
    try:
        with Image.open(io.BytesIO(raw)) as im:
            if im.format not in ('PNG', 'JPEG') or im.width * im.height > 25000000:
                raise ValueError()
            kind = im.format
            im.verify()
        return raw, 'image/png' if kind == 'PNG' else 'image/jpeg'
    except Exception:
        raise HTTPException(422, 'Only genuine PDF, PNG or JPEG attachments are supported')

def store_file(db, document, raw):
    storage = get_storage()
    name = storage.put(raw, 'file:' + document.id)
    db.info.setdefault('file_rollbacks', []).append(lambda: storage.delete(name))
    document.file_name = name
    document.file_hash = digest(raw)

def credential_status(db, document):
    if document.status != 'VALID':
        return document.status
    if document.expires_at and document.expires_at <= now():
        return 'EXPIRED'
    _, trusted = key_trusted(db, document)
    return 'VALID' if trusted else 'UNTRUSTED'

def content(db, document, require_valid=False):
    status = credential_status(db, document)
    if require_valid and status != 'VALID':
        raise HTTPException(409, 'Credential is ' + status.lower() + '; disclosure is blocked')
    try:
        package = decrypt(document.claims_encrypted, 'credential:' + document.id)
        if document.status == 'UNVERIFIED' or not document.key_id:
            return package, False
        key, _ = key_trusted(db, document)
        values = {k: v['value'] for k, v in package.items()}
        valid = bool(key and verify(key.public_key, manifest(document, values), document.signature))
        valid = valid and all(verify(key.public_key, claim_payload(document, k, v['value']), v['signature']) for k, v in package.items())
        if not valid:
            raise ValueError()
        return package, True
    except Exception as exc:
        raise HTTPException(409, 'Credential integrity check failed; no content was released') from exc

def summary(db, d):
    org = db.get(Organization, d.issuer_id) if d.issuer_id else None
    return {'id': d.id, 'owner_id': d.owner_id, 'title': d.title, 'type': d.type, 'category': d.category,
        'issuer': org.name if org else 'Personal upload', 'issuer_id': d.issuer_id,
        'issued_at': d.issued_at, 'expires_at': d.expires_at, 'status': credential_status(db, d),
        'version': d.version, 'replaces_id': d.replaces_id, 'has_file': bool(d.file_name),
        'file_type': d.file_type, 'revoke_reason': d.revoke_reason, 'created_at': d.created_at,
        'auto_fetch': d.auto_fetch}

def issue(db, p, data):
    owner = owner_lookup(db, data.owner_id)
    issued = timestamp(data.issued_at)
    expires = timestamp(data.expires_at) if data.expires_at else None
    validate_claims(data.type, data.claims, issued, expires)
    key = db.scalar(select(IssuerKey).where(IssuerKey.organization_id == p.org.id, IssuerKey.revoked_at.is_(None),
        IssuerKey.valid_from <= now()).order_by(IssuerKey.valid_from.desc()))
    if not key or (key.valid_until and key.valid_until <= now()):
        raise HTTPException(409, 'No active signing key. Ask the local administrator to rotate keys.')
    previous = db.get(Credential, data.replaces_id) if data.replaces_id else None
    if data.replaces_id and (not previous or previous.issuer_id != p.org.id or previous.owner_id != owner.id):
        raise HTTPException(404, 'Replacement credential is unavailable')
    if previous and previous.status == 'SUPERSEDED':
        raise HTTPException(409, 'This version has already been replaced. Replace its current successor instead.')
    d = Credential(id=uid(), owner_id=owner.id, issuer_id=p.org.id, key_id=key.id, title=data.title,
        type=data.type, category=SCHEMAS[data.type]['category'], issued_at=issued, expires_at=expires,
        status='VALID', proof_version=2, version=(previous.version + 1 if previous else 1),
        replaces_id=previous.id if previous else None, claims_encrypted='', created_at=now())
    if data.type == 'AGE':
        d.assessment_date = timestamp(data.claims['assessmentDate'])
    if data.attachment:
        raw, d.file_type = validate_file(data.attachment.content)
        store_file(db, d, raw)
    d.claims_encrypted = encrypt({k: {'value': v, 'signature': sign(key, claim_payload(d, k, v))} for k, v in data.claims.items()}, 'credential:' + d.id)
    d.signature = sign(key, manifest(d, data.claims))
    db.add(d)
    db.flush()
    if previous:
        previous.status = 'SUPERSEDED'
        previous.revoke_reason = previous.revoke_reason or ('Replaced by credential ' + d.id)
        audit(db, p.user, 'CREDENTIAL_REPLACED', owner.id, previous.id, outcome='SUPERSEDED')
    audit(db, p.user, 'CREDENTIAL_ISSUED', owner.id, d.id, outcome='VALID', method='ED25519')
    notify(db, owner.id, 'A signed credential was added to your vault.', '/owner/documents/' + d.id)
    return d

def accessible_document(db, p, document_id):
    d = db.get(Credential, document_id)
    if not d or not ((p.role == 'OWNER' and d.owner_id == p.user.id) or (p.role == 'ISSUER' and d.issuer_id == p.org.id)):
        raise HTTPException(404, 'Document unavailable')
    return d

def download_bytes(document):
    try:
        raw = get_storage().get(document.file_name, 'file:' + document.id)
        if digest(raw) != document.file_hash:
            raise ValueError()
        return raw
    except Exception as exc:
        raise HTTPException(409, 'Attachment integrity check failed') from exc
