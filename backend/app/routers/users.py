from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..database.database import get_db
from ..models import Credential, VerificationRequest, Notification, AuditLog, now
from ..core.dependencies import browser, Principal, user_view
from ..schemas.contracts import Profile
from ..services.document_service import summary, credential_status
from ..services.audit_service import audit, audit_payload
from .verification import view_request
from ..services.live_service import changed

router = APIRouter(prefix='/api/v1', tags=['Workspace'])

@router.put('/users/me')
def settings(data: Profile, p: Principal = Depends(browser), db: Session = Depends(get_db)):
    try:
        ZoneInfo(data.timezone)
    except (ZoneInfoNotFoundError, ValueError):
        raise HTTPException(422, 'Choose a valid IANA timezone')
    p.user.name, p.user.timezone, p.user.notifications = data.name, data.timezone, data.notifications
    audit(db, p.user, 'PROFILE_UPDATED', owner_id=p.user.id if p.role == 'OWNER' else None)
    db.commit()
    return user_view(p)

def document_rows(db, p):
    if p.role == 'VERIFIER':
        return []
    return list(db.scalars(select(Credential).where(
        Credential.owner_id == p.user.id if p.role == 'OWNER' else Credential.issuer_id == p.org.id).order_by(Credential.created_at.desc())))

def request_rows(db, p):
    if p.role == 'ISSUER':
        return []
    return [view_request(db, r, p.user) for r in db.scalars(select(VerificationRequest).where(
        VerificationRequest.owner_id == p.user.id if p.role == 'OWNER' else VerificationRequest.verifier_id == p.org.id).order_by(VerificationRequest.created_at.desc()))]

def audit_query(db, p):
    q = select(AuditLog)
    if p.role == 'OWNER':
        return q.where(AuditLog.owner_id == p.user.id)
    if p.role == 'VERIFIER':
        ids = select(VerificationRequest.id).where(VerificationRequest.verifier_id == p.org.id)
        return q.where((AuditLog.organization_id == p.org.id) | AuditLog.request_id.in_(ids))
    ids = select(Credential.id).where(Credential.issuer_id == p.org.id)
    return q.where((AuditLog.organization_id == p.org.id) | AuditLog.credential_id.in_(ids))

@router.get('/dashboard')
def dashboard(p: Principal = Depends(browser), db: Session = Depends(get_db)):
    docs = document_rows(db, p)
    requests = request_rows(db, p)
    events = list(db.scalars(audit_query(db, p).order_by(AuditLog.id.desc())))
    return {'documents': len([d for d in docs if d.status != 'ARCHIVED']),
        'valid': sum(credential_status(db, d) == 'VALID' for d in docs),
        'expired': sum(credential_status(db, d) == 'EXPIRED' for d in docs),
        'revoked': sum(credential_status(db, d) == 'REVOKED' for d in docs),
        'pending': sum(r['status'] == 'PENDING' for r in requests),
        'requests': len(requests), 'approved': sum(r['status'] in ('APPROVED','PARTIAL') for r in requests),
        'disclosures': sum(e.action == 'DISCLOSURE' for e in events),
        'recent_documents': [summary(db, d) for d in docs[:5]],
        'recent_requests': ([r for r in requests if r['status'] == 'PENDING'] if p.role == 'OWNER' else requests)[:5],
        'recent_activity': [{**audit_payload(e), 'hash':e.hash} for e in events[:5]]}

@router.get('/search')
def search(q: str = '', p: Principal = Depends(browser), db: Session = Depends(get_db)):
    q = q.strip().lower()[:100]
    if len(q) < 2:
        return []
    results = []
    for d in document_rows(db, p):
        if q in (d.title + ' ' + d.type).lower():
            results.append({'label': d.title, 'kind': 'Credential', 'link': '/' + p.role.lower() + '/documents/' + d.id})
    for r in request_rows(db, p):
        if q in (r['purpose'] + ' ' + r['organization'] + ' ' + r['id']).lower():
            results.append({'label': r['organization'] + ' · ' + r['purpose'], 'kind': r['status'],
                'link': '/' + p.role.lower() + '/requests/' + r['id']})
    return results[:20]

@router.get('/notifications')
def notifications(p: Principal = Depends(browser), db: Session = Depends(get_db)):
    rows = list(db.scalars(select(Notification).where(Notification.user_id == p.user.id).order_by(Notification.created_at.desc())))
    return {'unread': sum(not n.read for n in rows),
        'items': [{'id':n.id, 'message':n.message, 'link':n.link, 'read':n.read, 'created_at':n.created_at} for n in rows[:100]]}

@router.post('/notifications/{notification_id}/read')
def read_notification(notification_id: str, p: Principal = Depends(browser), db: Session = Depends(get_db)):
    rows = list(db.scalars(select(Notification).where(Notification.user_id == p.user.id)))
    if notification_id != 'all' and not any(n.id == notification_id for n in rows):
        raise HTTPException(404, 'Notification unavailable')
    for n in rows:
        if notification_id == 'all' or n.id == notification_id:
            n.read = True
    changed(db, [p.user.id])
    db.commit()
    return {'message':'Notifications marked as read'}

@router.get('/audit')
def logs(p: Principal = Depends(browser), db: Session = Depends(get_db)):
    return [{**audit_payload(e), 'hash':e.hash} for e in db.scalars(audit_query(db, p).order_by(AuditLog.id.desc()))]
