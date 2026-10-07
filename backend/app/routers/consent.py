from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..database.database import get_db
from ..models import ConsentRule, Credential, Organization, now
from ..core.dependencies import role, Principal
from ..schemas.contracts import Rule, RuleUpdate, timestamp
from ..services.document_service import SCHEMAS
from ..services.audit_service import audit

router = APIRouter(prefix='/api/v1/consent/rules', tags=['Consent'])
owner = role('OWNER')

def view(db, r):
    doc = db.get(Credential, r.credential_id) if r.credential_id else None
    org = db.get(Organization, r.verifier_id) if r.verifier_id else None
    return {'id': r.id, 'verifier_id': r.verifier_id, 'verifier': org.name if org else 'All approved verifiers',
        'credential_id': r.credential_id, 'document': doc.title if doc else 'All matching credentials',
        'credential_type': r.credential_type, 'field': r.field, 'action': r.action,
        'enabled': r.enabled, 'expires_at': r.expires_at, 'version': r.version, 'updated_at': r.updated_at}

def validate(db, p, data):
    if data.credential_id:
        d = db.get(Credential, data.credential_id)
        if not d or d.owner_id != p.user.id or d.type not in SCHEMAS:
            raise HTTPException(404, 'Credential unavailable')
        fields = set(SCHEMAS[d.type]['fields'])
        if data.credential_type and d.type != data.credential_type:
            raise HTTPException(422, 'Credential type does not match document')
    elif data.credential_type:
        fields = set(SCHEMAS[data.credential_type]['fields'])
    else:
        fields = {f for s in SCHEMAS.values() for f in s['fields']}
    if data.field != '*' and data.field not in fields:
        raise HTTPException(422, 'Unknown field for this scope')
    if data.verifier_id:
        org = db.get(Organization, data.verifier_id)
        if not org or not org.approved or org.kind != 'VERIFIER':
            raise HTTPException(422, 'Choose an approved verifier')
    if data.expires_at:
        data.expires_at = timestamp(data.expires_at)
        if data.enabled and data.expires_at <= now():
            raise HTTPException(422, 'Rule expiry must be in the future')

@router.get('')
def rules(p: Principal = Depends(owner), db: Session = Depends(get_db)):
    return [view(db, r) for r in db.scalars(select(ConsentRule).where(ConsentRule.owner_id == p.user.id).order_by(ConsentRule.updated_at.desc()))]

@router.post('', status_code=201)
def create(data: Rule, p: Principal = Depends(owner), db: Session = Depends(get_db)):
    validate(db, p, data)
    r = ConsentRule(owner_id=p.user.id, **data.model_dump())
    db.add(r)
    db.flush()
    audit(db, p.user, 'CONSENT_RULE_CREATED', p.user.id, data.credential_id,
        requested=[data.field], outcome=data.action, method='RULE_VERSION_1')
    db.commit()
    return view(db, r)

@router.put('/{rule_id}')
def update(rule_id: str, data: RuleUpdate, p: Principal = Depends(owner), db: Session = Depends(get_db)):
    r = db.get(ConsentRule, rule_id)
    if not r or r.owner_id != p.user.id:
        raise HTTPException(404, 'Rule unavailable')
    if r.version != data.version:
        raise HTTPException(409, 'Rule changed. Refresh before updating.')
    validate(db, p, data)
    for k, v in data.model_dump(exclude={'version'}).items():
        setattr(r, k, v)
    r.version += 1
    r.updated_at = now()
    audit(db, p.user, 'CONSENT_RULE_UPDATED', p.user.id, data.credential_id,
        requested=[data.field], outcome=data.action if data.enabled else 'DISABLED', method='RULE_VERSION_' + str(r.version))
    db.commit()
    return view(db, r)

@router.delete('/{rule_id}')
def delete_rule(rule_id: str, version: int = Query(ge=1), p: Principal = Depends(owner), db: Session = Depends(get_db)):
    r = db.get(ConsentRule, rule_id)
    if not r or r.owner_id != p.user.id:
        raise HTTPException(404, 'Rule unavailable')
    if r.version != version:
        raise HTTPException(409, 'Rule changed. Refresh before deleting.')
    audit(db, p.user, 'CONSENT_RULE_DELETED', p.user.id, r.credential_id, requested=[r.field], outcome='DELETED', method='RULE_VERSION_' + str(r.version))
    db.delete(r)
    db.commit()
    return {'message': 'Rule deleted; requests will be re-evaluated before disclosure.'}
