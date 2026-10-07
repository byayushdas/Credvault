from sqlalchemy import select
from ..models import AuditLog, Membership, now, uid
from ..core.security import digest
from .encryption_service import canonical

AUDIT_FIELDS = ['id', 'event_id', 'created_at', 'actor_id', 'organization_id', 'owner_id', 'credential_id',
    'request_id', 'action', 'requested', 'shared', 'outcome', 'method', 'previous_hash']

def audit_payload(event):
    return {k: getattr(event, k) for k in AUDIT_FIELDS}

def audit(db, actor, action, owner_id=None, credential_id=None, request_id=None,
          requested=None, shared=None, outcome='SUCCESS', method='SYSTEM'):
    db.flush()
    previous = db.scalar(select(AuditLog).order_by(AuditLog.id.desc()).limit(1))
    membership = db.get(Membership, actor.id)
    event = AuditLog(id=(previous.id + 1 if previous else 1), event_id=uid(), created_at=now(),
        actor_id=actor.id, organization_id=membership.organization_id if membership else None,
        owner_id=owner_id, credential_id=credential_id, request_id=request_id, action=action,
        requested=requested or [], shared=shared or [], outcome=outcome, method=method,
        previous_hash=previous.hash if previous else '0' * 64, hash='')
    event.hash = digest(canonical(audit_payload(event)))
    db.add(event)
    db.flush()
    from .live_service import audit_changed
    audit_changed(db, event)
    return event

def check_chain(db):
    previous = '0' * 64
    count = 0
    for event in db.scalars(select(AuditLog).order_by(AuditLog.id)):
        count += 1
        if event.id != count or event.previous_hash != previous or event.hash != digest(canonical(audit_payload(event))):
            raise ValueError('Audit integrity failure at event ' + str(event.id))
        previous = event.hash
    return {'events': count, 'head': previous, 'valid': True}
