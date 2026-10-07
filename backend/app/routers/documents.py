import base64
import json
from fastapi import APIRouter, Depends, HTTPException, Header, Response, Body
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..database.database import get_db
from ..models import Credential, Draft, Idempotency, IssuerKey, Organization, uid, now
from ..core.dependencies import role, Principal
from ..core.security import digest
from ..schemas.contracts import Issue, IssueToVault, ImportDocument, Reason
from ..services.document_service import (SCHEMAS, issue, summary, content, accessible_document,
    download_bytes, validate_file, store_file, notify, notify_org, owner_lookup)
from ..services.encryption_service import encrypt, decrypt, canonical
from ..services.signature_service import manifest, verify, key_trusted
from ..services.audit_service import audit

router = APIRouter(prefix='/api/v1', tags=['Credentials'])
owner = role('OWNER')
issuer = role('ISSUER')
reader = role('OWNER', 'ISSUER')

@router.get('/owners/confirm')
def confirm_owner(vault_id: str, p: Principal = Depends(role('ISSUER', 'VERIFIER', scope='requests:read')), db: Session = Depends(get_db)):
    owner = owner_lookup(db, vault_id)
    masked_name = owner.name[0] + '*' * (len(owner.name)-2) + owner.name[-1] if len(owner.name) > 2 else owner.name[0] + '*'
    
    audit(db, p.user, 'VAULT_QR_SCANNED', owner.id, requested=[vault_id])
    db.commit()
    
    # Possession of the exact reference permits existence confirmation only.
    return {'vault_id': owner.vault_id, 'masked_name': masked_name, 'status': 'Available'}

@router.get('/owners/confirm-share')
def confirm_share(token: str, p: Principal = Depends(role('VERIFIER', scope='requests:read')), db: Session = Depends(get_db)):
    from ..core.security import digest
    from ..models import ShareToken, now
    token_hash = digest(token)
    record = db.get(ShareToken, token_hash)
    if not record or record.consumed or record.expires_at < now():
        raise HTTPException(404, 'Share token is invalid, expired, or consumed')
    if record.verifier_id and record.verifier_id != p.org.id:
        raise HTTPException(403, 'This token is restricted to a different verifier')
        
    owner = owner_lookup(db, record.vault_id)
    masked_name = owner.name[0] + '*' * (len(owner.name)-2) + owner.name[-1] if len(owner.name) > 2 else owner.name[0] + '*'
    
    audit(db, p.user, 'VAULT_QR_SCANNED', owner.id, requested=['temporary_share_token'])
    db.commit()
    return {'vault_id': owner.vault_id, 'masked_name': masked_name, 'status': 'Available', 'token': token}


@router.get('/schemas')
def schemas(p: Principal = Depends(role('OWNER', 'ISSUER', 'VERIFIER', scope='requests:read'))):
    return SCHEMAS

@router.get('/documents')
def documents(p: Principal = Depends(reader), db: Session = Depends(get_db)):
    q = select(Credential).where(Credential.owner_id == p.user.id) if p.role == 'OWNER' else select(Credential).where(Credential.issuer_id == p.org.id)
    return [summary(db, d) for d in db.scalars(q.order_by(Credential.created_at.desc()))]

@router.post('/issuer/documents', status_code=201)
def issue_document(data: Issue, idempotency_key: str = Header(min_length=16, max_length=80),
                   p: Principal = Depends(issuer), db: Session = Depends(get_db)):
    scope = 'issue:' + p.org.id
    fingerprint = digest(canonical(data.model_dump()))
    prior = db.get(Idempotency, (scope, idempotency_key))
    if prior:
        if prior.fingerprint != fingerprint:
            raise HTTPException(409, 'This submission key was used for different content')
        return summary(db, db.get(Credential, prior.result_id))
    d = issue(db, p, data)
    if data.draft_id:
        draft = db.get(Draft, data.draft_id)
        if not draft or draft.issuer_id != p.org.id:
            raise HTTPException(404, 'Draft unavailable')
        db.delete(draft)
    db.add(Idempotency(scope=scope, key=idempotency_key, fingerprint=fingerprint, result_id=d.id))
    db.commit()
    db.info.pop('file_rollbacks', None)
    return summary(db, d)

@router.post('/issuer/documents/issue-to-vault', status_code=201)
def issue_document_to_vault(data: IssueToVault, idempotency_key: str = Header(min_length=16, max_length=80),
                            p: Principal = Depends(issuer), db: Session = Depends(get_db)):
    scope = 'issue-vault:' + p.org.id
    fingerprint = digest(canonical(data.model_dump()))
    prior = db.get(Idempotency, (scope, idempotency_key))
    if prior:
        if prior.fingerprint != fingerprint:
            raise HTTPException(409, 'This submission key was used for different content')
        return summary(db, db.get(Credential, prior.result_id))
    
    from ..models import User, Membership
    owner = db.scalar(select(User).join(Membership, Membership.user_id == User.id).where(
        Membership.role == 'OWNER', User.active.is_(True), User.vault_id == data.vault_id))
    if not owner:
        raise HTTPException(404, 'Owner vault is unavailable or invalid.')
    
    issue_data = Issue(owner_id=owner.id, title=data.title, type=data.type, claims=data.claims, 
                       issued_at=data.issued_at, expires_at=data.expires_at, 
                       attachment=data.attachment, replaces_id=data.replaces_id)
    
    d = issue(db, p, issue_data)
    
    audit(db, p.user, 'CREDENTIAL_ISSUED_TO_VAULT', owner.id, d.id, outcome='SUCCESS', requested=[data.vault_id])
    
    from ..services.live_service import dispatch_sse
    org = db.get(Organization, p.org.id)
    dispatch_sse(owner.id, 'CREDENTIAL_ISSUED', {
        "event": "CREDENTIAL_ISSUED",
        "credential_id": d.id,
        "credential_type": d.type,
        "issuer_name": org.name,
        "timestamp": d.issued_at
    })
    
    db.add(Idempotency(scope=scope, key=idempotency_key, fingerprint=fingerprint, result_id=d.id))
    db.commit()
    db.info.pop('file_rollbacks', None)
    return summary(db, d)

@router.get('/issuer/drafts')
def drafts(p: Principal = Depends(issuer), db: Session = Depends(get_db)):
    return [{'id': d.id, 'updated_at': d.updated_at, 'data': decrypt(d.payload_encrypted, 'draft:' + d.id)}
        for d in db.scalars(select(Draft).where(Draft.issuer_id == p.org.id).order_by(Draft.updated_at.desc()))]

@router.put('/issuer/drafts/{draft_id}')
def draft_save(draft_id: str, data: dict = Body(), p: Principal = Depends(issuer), db: Session = Depends(get_db)):
    import uuid
    try:
        uuid.UUID(draft_id)
    except ValueError:
        raise HTTPException(422, 'Invalid draft ID')
    if len(canonical(data)) > 15000000 or not set(data) <= set(Issue.model_fields):
        raise HTTPException(422, 'Invalid draft')
    draft = db.get(Draft, draft_id)
    if draft and draft.issuer_id != p.org.id:
        raise HTTPException(404, 'Draft unavailable')
    if not draft:
        draft = Draft(id=draft_id, issuer_id=p.org.id, payload_encrypted='')
        db.add(draft)
    draft.payload_encrypted = encrypt(data, 'draft:' + draft_id)
    draft.updated_at = now()
    db.commit()
    return {'id': draft_id, 'message': 'Draft saved'}

@router.delete('/issuer/drafts/{draft_id}')
def draft_delete(draft_id: str, p: Principal = Depends(issuer), db: Session = Depends(get_db)):
    draft = db.get(Draft, draft_id)
    if not draft or draft.issuer_id != p.org.id:
        raise HTTPException(404, 'Draft unavailable')
    db.delete(draft)
    db.commit()
    return {'message': 'Draft deleted'}

@router.post('/documents/import', status_code=201)
def personal_import(data: ImportDocument, p: Principal = Depends(owner), db: Session = Depends(get_db)):
    raw, mime = validate_file(data.attachment.content)
    d = Credential(id=uid(), owner_id=p.user.id, title=data.title, type='PERSONAL', category='Personal',
        issued_at=now(), status='UNVERIFIED', version=1, claims_encrypted='', file_type=mime)
    d.claims_encrypted = encrypt({}, 'credential:' + d.id)
    store_file(db, d, raw)
    db.add(d)
    db.flush()
    audit(db, p.user, 'PERSONAL_DOCUMENT_IMPORTED', p.user.id, d.id, outcome='UNVERIFIED')
    db.commit()
    db.info.pop('file_rollbacks', None)
    return summary(db, d)

@router.post('/documents/import-package')
def signed_import(data: dict = Body(), p: Principal = Depends(owner), db: Session = Depends(get_db)):
    # Packages refer to this registry; validation never grants trust to unknown keys.
    if set(data) != {'record', 'signature'} or not isinstance(data['record'], dict):
        raise HTTPException(422, 'Unsupported signed package')
    record = data['record']
    if record.get('owner_id') != p.user.id:
        raise HTTPException(403, 'Package belongs to a different owner')
    d = db.get(Credential, record.get('credential_id', ''))
    if not d or d.owner_id != p.user.id:
        raise HTTPException(422, 'Package is not registered here. Ask the issuer to deliver it to this vault.')
    key, trusted = key_trusted(db, d)
    package, _ = content(db, d, require_valid=True)
    expected = manifest(d, {k:v['value'] for k,v in package.items()})
    if not trusted or record != expected or not verify(key.public_key, record, data['signature']):
        raise HTTPException(422, 'Signed package validation failed')
    audit(db, p.user, 'SIGNED_IMPORT_VALIDATED', p.user.id, d.id, method='ED25519')
    db.commit()
    return summary(db, d)

@router.get('/documents/{document_id}')
def details(document_id: str, p: Principal = Depends(reader), db: Session = Depends(get_db)):
    d = accessible_document(db, p, document_id)
    package, valid = content(db, d)
    key, trusted = key_trusted(db, d)
    return {**summary(db, d), 'claims': {k:v['value'] for k,v in package.items()},
        'signature_valid': valid, 'issuer_trusted': trusted, 'key_id': key.id if key else None}

@router.get('/documents/{document_id}/file')
def file(document_id: str, p: Principal = Depends(reader), db: Session = Depends(get_db)):
    d = accessible_document(db, p, document_id)
    if not d.file_name:
        raise HTTPException(404, 'This credential has no attachment')
    content(db, d)
    raw = download_bytes(d)
    audit(db, p.user, 'DOCUMENT_DOWNLOADED', d.owner_id, d.id, method='AUTHENTICATED')
    db.commit()
    ext = {'application/pdf':'pdf', 'image/png':'png', 'image/jpeg':'jpg'}[d.file_type]
    return Response(raw, media_type=d.file_type, headers={'Content-Disposition': 'inline; filename="credential.' + ext + '"',
        'Content-Security-Policy': "sandbox; default-src 'none'"})

@router.get('/documents/{document_id}/package')
def export_package(document_id: str, p: Principal = Depends(reader), db: Session = Depends(get_db)):
    d = accessible_document(db, p, document_id)
    values, valid = content(db, d)
    if not valid:
        raise HTTPException(409, 'Personal uploads do not have signed packages')
    payload = {'record': manifest(d, {k:v['value'] for k,v in values.items()}), 'signature': d.signature}
    audit(db, p.user, 'PACKAGE_EXPORTED', d.owner_id, d.id, shared=list(values), method='AUTHENTICATED')
    db.commit()
    return payload

@router.post('/documents/{document_id}/archive')
def archive(document_id: str, p: Principal = Depends(owner), db: Session = Depends(get_db)):
    d = accessible_document(db, p, document_id)
    if d.issuer_id or d.status != 'UNVERIFIED':
        raise HTTPException(409, 'Only personal uploads can be archived')
    d.status = 'ARCHIVED'
    audit(db, p.user, 'DOCUMENT_ARCHIVED', p.user.id, d.id)
    db.commit()
    return summary(db, d)

@router.post('/issuer/documents/{document_id}/revoke')
def revoke(document_id: str, data: Reason, p: Principal = Depends(issuer), db: Session = Depends(get_db)):
    d = accessible_document(db, p, document_id)
    if d.status != 'VALID':
        raise HTTPException(409, 'Credential has already been revoked or superseded')
    d.status = 'REVOKED'
    d.revoke_reason = data.reason
    audit(db, p.user, 'CREDENTIAL_REVOKED', d.owner_id, d.id, outcome='REVOKED')
    notify(db, d.owner_id, 'An issuer revoked a credential in your vault.', '/owner/documents/' + d.id)
    from ..models import VerificationRequest
    for org in set(db.scalars(select(VerificationRequest.verifier_id).where(VerificationRequest.credential_id == d.id))):
        notify_org(db, org, 'A requested credential was revoked. Further disclosure is blocked.', '/verifier/history')
    db.commit()
    return summary(db, d)
