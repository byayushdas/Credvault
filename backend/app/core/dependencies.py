import secrets
from dataclasses import dataclass
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session as DBSession
from ..database.database import get_db
from ..models import User, Membership, Organization, Session, OAuthClient, OAuthToken, now
from .security import digest

@dataclass
class Principal:
    user: User
    role: str
    org: Organization | None
    session: Session | None
    scopes: set | None = None

def current(request: Request, db: DBSession = Depends(get_db)):
    auth = request.headers.get('authorization', '')
    session = None
    scopes = None
    if auth.startswith('Bearer '):
        token = db.get(OAuthToken, digest(auth[7:]))
        client = db.get(OAuthClient, token.client_id) if token else None
        if not token or token.expires_at <= now() or not client or client.revoked:
            raise HTTPException(401, 'API token is invalid, expired or revoked')
        user = db.get(User, client.user_id)
        scopes = set(token.scopes.split())
    else:
        raw = request.cookies.get('cv_session')
        session = db.get(Session, digest(raw)) if raw else None
        if not session or session.expires_at <= now():
            raise HTTPException(401, 'Your session has expired. Please sign in.')
        user = db.get(User, session.user_id)
        if request.method not in ('GET', 'HEAD', 'OPTIONS') and not secrets.compare_digest(request.headers.get('x-csrf-token', ''), session.csrf):
            raise HTTPException(403, 'Invalid CSRF token. Refresh and try again.')
    if not user or not user.active:
        raise HTTPException(401, 'Account unavailable')
    member = db.get(Membership, user.id)
    if not member:
        raise HTTPException(403, 'No approved membership')
    org = db.get(Organization, member.organization_id) if member.organization_id else None
    if member.role != 'OWNER' and (not org or not org.approved or org.kind != member.role):
        raise HTTPException(403, 'Organisation approval is required')
    if scopes is not None and (member.role != 'VERIFIER' or org.id != client.organization_id):
        raise HTTPException(403, 'Client membership unavailable')
    return Principal(user, member.role, org, session, scopes)

def role(*allowed, scope=None):
    def dependency(p: Principal = Depends(current)):
        if p.role not in allowed:
            raise HTTPException(403, 'Your role cannot perform this action')
        if p.scopes is not None and (scope is None or scope not in p.scopes):
            raise HTTPException(403, 'API token does not have the required scope')
        return p
    return dependency

def browser(p: Principal = Depends(current)):
    if p.session is None:
        raise HTTPException(403, 'Browser session required')
    return p

def user_view(p):
    return {'id': p.user.id, 'name': p.user.name, 'email': p.user.email, 'role': p.role,
        'organization': {'id': p.org.id, 'name': p.org.name} if p.org else None,
        'timezone': p.user.timezone, 'notifications': p.user.notifications,
        'csrf': p.session.csrf if p.session else None}
