from sqlalchemy import select
from ..models import ConsentRule, RequestField, DecisionHistory, now
from .audit_service import audit

def evaluate(db, owner_id, verifier_id, document, field):
    rules = [r for r in db.scalars(select(ConsentRule).where(ConsentRule.owner_id == owner_id, ConsentRule.enabled.is_(True)))
        if (not r.expires_at or r.expires_at > now()) and (not r.verifier_id or r.verifier_id == verifier_id)
        and (not r.credential_id or r.credential_id == document.id)
        and (not r.credential_type or r.credential_type == document.type) and r.field in (field, '*')]
    snapshots = [{'id': r.id, 'version': r.version, 'action': r.action} for r in sorted(rules, key=lambda r:r.id)]
    # Snapshot the owner-controlled document setting as well as legacy rules so
    # changing the switch invalidates automatic grants before the next disclosure.
    snapshots.append({'id': 'auto-fetch:' + document.id, 'version': 1,
        'action': 'AUTO_APPROVE' if document.auto_fetch else 'ASK'})
    if any(r.action == 'DENY' for r in rules):
        return 'DENIED', snapshots
    # The document switch determines whether approval is automatic. Existing
    # AUTO_APPROVE/ASK rules cannot bypass an off switch or override an on switch.
    return ('APPROVED' if document.auto_fetch else 'PENDING'), snapshots

def request_fields(db, req):
    return list(db.scalars(select(RequestField).where(RequestField.request_id == req.id).order_by(RequestField.field)))

def record_decision(db, field):
    db.add(DecisionHistory(request_id=field.request_id, field=field.field, decision=field.decision,
        method=field.method, rules=field.rules))

def finalize(req, fields):
    if req.status == 'CANCELLED':
        return
    if req.expires_at <= now():
        req.status = 'EXPIRED'
    elif any(f.decision == 'PENDING' for f in fields):
        req.status = 'PENDING'
    elif all(f.decision == 'APPROVED' for f in fields):
        req.status = 'APPROVED'
    elif any(f.decision == 'APPROVED' for f in fields):
        req.status = 'PARTIAL'
    else:
        req.status = 'DENIED'

def reconcile(db, req, document, actor):
    fields = request_fields(db, req)
    changed = False
    if req.status in ('CANCELLED', 'EXPIRED'):
        return fields
    for field in fields:
        decision, snapshots = evaluate(db, req.owner_id, req.verifier_id, document, field.field)
        # Consent tightening applies immediately. Broader changes never resurrect
        # a denied grant. Manual approvals survive ASK but never an explicit DENY.
        if snapshots != field.rules:
            previous = field.decision
            if field.decision != 'DENIED':
                if decision == 'DENIED':
                    field.decision = 'DENIED'
                    field.method = 'RULE'
                elif field.method in ('RULE', 'AUTO_FETCH'):
                    field.decision = decision
                    field.method = 'AUTO_FETCH' if decision == 'APPROVED' else 'RULE'
            field.rules = snapshots
            record_decision(db, field)
            changed = True
            if previous != field.decision:
                field.decided_at = now()
    old_status = req.status
    finalize(req, fields)
    if changed or old_status != req.status:
        req.revision += 1
        audit(db, actor, 'CONSENT_REEVALUATED', req.owner_id, document.id, req.id,
            [f.field for f in fields], outcome=req.status, method='RULE')
    return fields
