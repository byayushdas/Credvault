from fastapi import APIRouter, Depends, HTTPException, Request
from starlette.concurrency import run_in_threadpool
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..database.database import get_db
from ..models import Organization, IssuerKey, OAuthClient
from ..core.dependencies import browser, role, Principal
from ..schemas.contracts import OrgUpdate
from ..services.audit_service import audit
from ..services.oauth_service import token_response

router = APIRouter(prefix='/api/v1', tags=['Registry and API access'])

@router.get('/registry')
def registry(db: Session = Depends(get_db)):
    return [{'id':o.id, 'name':o.name, 'kind':o.kind, 'approved':o.approved,
        'keys':[{'id':k.id, 'public_key':k.public_key, 'valid_from':k.valid_from,
            'valid_until':k.valid_until, 'revoked_at':k.revoked_at} for k in db.scalars(
                select(IssuerKey).where(IssuerKey.organization_id == o.id))]}
        for o in db.scalars(select(Organization).order_by(Organization.name))]

@router.put('/organization')
def organization(data: OrgUpdate, p: Principal = Depends(role('ISSUER','VERIFIER')), db: Session = Depends(get_db)):
    p.org.name = data.name
    audit(db, p.user, 'ORGANIZATION_UPDATED')
    db.commit()
    return {'message':'Organisation name updated'}

@router.get('/oauth/clients')
def clients(p: Principal = Depends(role('VERIFIER')), db: Session = Depends(get_db)):
    return [{'id':c.id, 'name':c.name, 'scopes':c.scopes, 'revoked':c.revoked}
        for c in db.scalars(select(OAuthClient).where(OAuthClient.organization_id == p.org.id))]

@router.post('/oauth/clients/{client_id}/revoke')
def revoke(client_id: str, p: Principal = Depends(role('VERIFIER')), db: Session = Depends(get_db)):
    c = db.get(OAuthClient, client_id)
    if not c or c.organization_id != p.org.id:
        raise HTTPException(404, 'Client unavailable')
    c.revoked = True
    audit(db, p.user, 'API_CLIENT_REVOKED')
    db.commit()
    return {'message':'Client and its access tokens revoked'}

@router.post('/oauth/token')
async def token(request: Request, db: Session = Depends(get_db)):
    data = dict(await request.form())
    return await run_in_threadpool(token_response, db, request.method, str(request.url), request.headers, data)
