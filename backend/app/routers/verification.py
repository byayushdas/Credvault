import base64
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..database.database import get_db
from ..models import Credential, VerificationRequest, RequestField, Organization, User, now, uid
from ..core.dependencies import role, Principal
from ..core.security import digest, future
from ..schemas.contracts import NewRequest, Decision, VerificationFromVault
from ..services.document_service import owner_lookup, SCHEMAS, credential_status, content, notify, notify_org
from ..services.encryption_service import canonical
from ..services.signature_service import claim_payload, key_trusted
from ..services.consent_service import evaluate, finalize, reconcile, request_fields, record_decision
from ..services.audit_service import audit

router = APIRouter(prefix='/api/v1/verification', tags=['Verification'])

def scoped_request(db, p, request_id):
    req = db.get(VerificationRequest, request_id)
    if not req or not ((p.role == 'OWNER' and req.owner_id == p.user.id) or (p.role == 'VERIFIER' and req.verifier_id == p.org.id)):
        raise HTTPException(404, 'Request unavailable')
    return req

def view_request(db, req, actor):
    d = db.get(Credential, req.credential_id)
    fields = reconcile(db, req, d, actor)
    org = db.get(Organization, req.verifier_id)
    return {'id': req.id, 'owner_id': req.owner_id, 'verifier_id': req.verifier_id,
        'organization': org.name, 'credential_id': d.id, 'credential_type': d.type,
        'credential_status': credential_status(db, d), 'purpose': req.purpose, 'status': req.status,
        'created_at': req.created_at, 'expires_at': req.expires_at, 'revision': req.revision,
        'fields': [{'field': f.field, 'decision': f.decision, 'method': f.method, 'rules': f.rules} for f in fields]}

@router.get('/discover')
def discover(owner_id: str, credential_type: str, p: Principal = Depends(role('VERIFIER', scope='requests:read')), db: Session = Depends(get_db)):
    owner = owner_lookup(db, owner_id)
    if credential_type not in SCHEMAS:
        raise HTTPException(422, 'Select a supported credential type')
    # Exact unguessable owner reference is shared by the owner out-of-band.
    # Return opaque IDs, issuer and dates only; never titles or claim values.
    return [{'id': d.id, 'issuer': db.get(Organization, d.issuer_id).name,
        'issued_at': d.issued_at, 'version': d.version, 'fields': list(content(db, d)[0])}
        for d in db.scalars(select(Credential).where(Credential.owner_id == owner.id, Credential.type == credential_type))
        if credential_status(db, d) == 'VALID']

@router.post('/requests', status_code=201)
def submit(data: NewRequest, idempotency_key: str = Header(min_length=16, max_length=80),
           p: Principal = Depends(role('VERIFIER', scope='requests:write')), db: Session = Depends(get_db)):
    fingerprint = digest(canonical(data.model_dump()))
    existing = db.scalar(select(VerificationRequest).where(VerificationRequest.verifier_id == p.org.id,
        VerificationRequest.idempotency_key == idempotency_key))
    if existing:
        if existing.fingerprint != fingerprint:
            raise HTTPException(409, 'Submission key already used for different content')
        return view_request(db, existing, p.user)
    owner = owner_lookup(db, data.owner_id)
    d = db.get(Credential, data.credential_id)
    if not d or d.owner_id != owner.id:
        raise HTTPException(404, 'Credential unavailable')
    if credential_status(db, d) != 'VALID':
        raise HTTPException(409, 'Credential is not valid for verification')
    if len(set(data.fields)) != len(data.fields) or not set(data.fields) <= set(content(db, d)[0]):
        raise HTTPException(422, 'Unknown, duplicated or forbidden fields')
    req = VerificationRequest(id=uid(), owner_id=owner.id, verifier_id=p.org.id, actor_id=p.user.id,
        credential_id=d.id, purpose=data.purpose, expires_at=future(hours=data.lifetime_hours),
        idempotency_key=idempotency_key, fingerprint=fingerprint)
    db.add(req)
    db.flush()
    fields = []
    for field in data.fields:
        decision, rules = evaluate(db, owner.id, p.org.id, d, field)
        f = RequestField(request_id=req.id, field=field, decision=decision,
            method='AUTO_FETCH' if decision == 'APPROVED' else 'RULE', rules=rules)
        db.add(f)
        record_decision(db, f)
        fields.append(f)
    finalize(req, fields)
    audit(db, p.user, 'REQUEST_SUBMITTED', owner.id, d.id, req.id, data.fields, outcome=req.status, method='RULE')
    audit(db, p.user, 'AUTOMATIC_DECISIONS', owner.id, d.id, req.id, data.fields, outcome=req.status, method='RULE')
    notify(db, owner.id, p.org.name + ' submitted a verification request.', '/owner/requests/' + req.id)
    result = view_request(db, req, p.user)
    db.commit()
    return result

@router.post('/requests/from-vault', status_code=201)
def submit_from_vault(data: VerificationFromVault, idempotency_key: str = Header(min_length=16, max_length=80),
           p: Principal = Depends(role('VERIFIER', scope='requests:write')), db: Session = Depends(get_db)):
    fingerprint = digest(canonical(data.model_dump()))
    existing = db.scalar(select(VerificationRequest).where(VerificationRequest.verifier_id == p.org.id,
        VerificationRequest.idempotency_key == idempotency_key))
    if existing:
        if existing.fingerprint != fingerprint:
            raise HTTPException(409, 'Submission key already used for different content')
        return view_request(db, existing, p.user)
    
    from ..models import Membership, ShareToken, now
    owner = db.scalar(select(User).join(Membership, Membership.user_id == User.id).where(User.vault_id == data.vault_id, User.active.is_(True), Membership.role == 'OWNER'))
    if not owner:
        raise HTTPException(404, 'Owner vault not found')

    if data.share_token:
        token_hash = digest(data.share_token)
        record = db.get(ShareToken, token_hash)
        if not record or record.consumed or record.expires_at < now():
            raise HTTPException(404, 'Share token is invalid, expired, or consumed')
        if record.verifier_id and record.verifier_id != p.org.id:
            raise HTTPException(403, 'This token is restricted to a different verifier')
        if record.vault_id != data.vault_id:
            raise HTTPException(422, 'Token vault mismatch')
            
        record.consumed = True
        db.add(record)


    # Find the latest valid credential of requested type
    d = db.scalar(
        select(Credential).where(
            Credential.owner_id == owner.id, 
            Credential.type == data.credential_type
        ).order_by(Credential.issued_at.desc()).limit(1)
    )
    if not d or credential_status(db, d) != 'VALID':
        raise HTTPException(404, 'Owner does not have a valid credential of this type')
        
    if len(set(data.fields)) != len(data.fields) or not set(data.fields) <= set(content(db, d)[0]):
        raise HTTPException(422, 'Unknown, duplicated or forbidden fields')
        
    req = VerificationRequest(id=uid(), owner_id=owner.id, verifier_id=p.org.id, actor_id=p.user.id,
        credential_id=d.id, purpose=data.purpose, expires_at=future(hours=data.lifetime_hours),
        idempotency_key=idempotency_key, fingerprint=fingerprint)
    db.add(req)
    db.flush()
    
    fields = []
    for field in data.fields:
        decision, rules = evaluate(db, owner.id, p.org.id, d, field)
        f = RequestField(request_id=req.id, field=field, decision=decision,
            method='AUTO_FETCH' if decision == 'APPROVED' else 'RULE', rules=rules)
        db.add(f)
        record_decision(db, f)
        fields.append(f)
        
    finalize(req, fields)
    audit(db, p.user, 'VERIFICATION_STARTED_FROM_QR', owner.id, d.id, req.id, requested=data.fields, outcome=req.status, method='RULE')
    audit(db, p.user, 'AUTOMATIC_DECISIONS', owner.id, d.id, req.id, requested=data.fields, outcome=req.status, method='RULE')
    notify(db, owner.id, p.org.name + ' submitted a verification request.', '/owner/requests/' + req.id)
    result = view_request(db, req, p.user)
    db.commit()
    return result

@router.get('/requests')
def history(p: Principal = Depends(role('OWNER', 'VERIFIER', scope='requests:read')), db: Session = Depends(get_db)):
    q = select(VerificationRequest).where(VerificationRequest.owner_id == p.user.id) if p.role == 'OWNER' else select(VerificationRequest).where(VerificationRequest.verifier_id == p.org.id)
    return [view_request(db, r, p.user) for r in db.scalars(q.order_by(VerificationRequest.created_at.desc()))]

@router.get('/requests/{request_id}')
def detail(request_id: str, p: Principal = Depends(role('OWNER', 'VERIFIER', scope='requests:read')), db: Session = Depends(get_db)):
    return view_request(db, scoped_request(db, p, request_id), p.user)

@router.post('/requests/{request_id}/decide')
def decide(request_id: str, data: Decision, p: Principal = Depends(role('OWNER')), db: Session = Depends(get_db)):
    req = scoped_request(db, p, request_id)
    d = db.get(Credential, req.credential_id)
    fields = reconcile(db, req, d, p.user)
    if req.status != 'PENDING' or req.revision != data.revision or credential_status(db, d) != 'VALID':
        raise HTTPException(409, 'This request changed or is no longer actionable. Refresh before deciding.')
    pending = {f.field: f for f in fields if f.decision == 'PENDING'}
    if not data.decisions or not set(data.decisions) <= set(pending):
        raise HTTPException(422, 'Decide only eligible pending fields')
    for name, decision in data.decisions.items():
        f = pending[name]
        f.decision, f.method, f.decided_at = decision, 'MANUAL', now()
        record_decision(db, f)
    req.revision += 1
    finalize(req, fields)
    audit(db, p.user, 'MANUAL_DECISION', req.owner_id, d.id, req.id, list(data.decisions), outcome=req.status, method='MANUAL')
    notify_org(db, req.verifier_id, 'An owner decided on your verification request.', '/verifier/requests/' + req.id)
    result = view_request(db, req, p.user)
    db.commit()
    return result

@router.post('/requests/{request_id}/cancel')
def cancel(request_id: str, p: Principal = Depends(role('VERIFIER', scope='requests:write')), db: Session = Depends(get_db)):
    req = scoped_request(db, p, request_id)
    view_request(db, req, p.user)
    if req.status != 'PENDING':
        raise HTTPException(409, 'Only pending requests can be cancelled')
    req.status = 'CANCELLED'
    req.revision += 1
    audit(db, p.user, 'REQUEST_CANCELLED', req.owner_id, req.credential_id, req.id, outcome='CANCELLED')
    notify(db, req.owner_id, 'A verifier cancelled a request.', '/owner/requests/' + req.id)
    db.commit()
    return {'message': 'Request cancelled'}

@router.get('/requests/{request_id}/result')
def result(request_id: str, p: Principal = Depends(role('VERIFIER', scope='results:read')), db: Session = Depends(get_db)):
    req = scoped_request(db, p, request_id)
    d = db.get(Credential, req.credential_id)
    fields = reconcile(db, req, d, p.user)
    if req.status not in ('APPROVED', 'PARTIAL'):
        audit(db, p.user, 'DISCLOSURE_BLOCKED', req.owner_id, d.id, req.id,
            [f.field for f in fields], outcome=req.status)
        db.commit()
        raise HTTPException(409, 'Disclosure unavailable: request is ' + req.status.lower())
    try:
        package, valid = content(db, d, require_valid=True)
    except HTTPException:
        audit(db, p.user, 'DISCLOSURE_BLOCKED', req.owner_id, d.id, req.id, outcome='CREDENTIAL_INVALID')
        db.commit()
        raise
    key, trusted = key_trusted(db, d)
    approved = [f.field for f in fields if f.decision == 'APPROVED']
    claims = []
    for field in approved:
        value = package[field]['value']
        payload = claim_payload(d, field, value)
        claims.append({'field': field, 'value': value, 'signed_payload': base64.b64encode(canonical(payload)).decode(),
            'signature': package[field]['signature']})
    payload = {'request_id': req.id, 'credential_id': d.id, 'owner_id': d.owner_id,
        'issuer_id': d.issuer_id, 'issuer': db.get(Organization, d.issuer_id).name, 'key_id': d.key_id,
        'public_key': key.public_key, 'algorithm': 'Ed25519', 'status': req.status,
        'claims': claims, 'verified_at': now(), 'expires_at': req.expires_at}
    audit(db, p.user, 'DISCLOSURE', req.owner_id, d.id, req.id,
        [f.field for f in fields], approved, outcome=req.status, method='SERVER_ENFORCED')
    # Commit audit BEFORE releasing any sensitive field.
    db.commit()
    return payload
