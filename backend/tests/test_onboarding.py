import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from app.models import User, Membership, Organization, IssuerKey
from app.services.onboarding_service import approve_membership
from app.database.database import lock_transaction

@pytest.mark.parametrize('role', ['ISSUER', 'VERIFIER'])
def test_organization_signup_approval_and_permissions(env,role):
    c=TestClient(env['app'],base_url='http://localhost',raise_server_exceptions=False)
    data={'name':'New Registrar','email':role.lower()+'@new.demo.test','password':'New-private-password-2026','role':role,'organization':'New Fictional Organisation'}
    assert c.post('/api/v1/auth/register-organization',json={**data,'approved':True}).status_code==422
    response=c.post('/api/v1/auth/register-organization',json=data)
    assert response.status_code==201,response.text
    assert response.json()['status']=='PENDING_APPROVAL'
    assert c.post('/api/v1/auth/register-organization',json=data).status_code==409
    login={'email':data['email'],'password':data['password']}
    assert c.post('/api/v1/auth/login',json=login).status_code==403
    assert c.get('/api/v1/auth/me').status_code==401
    assert c.get('/api/v1/events').status_code==401
    with env['factory']() as db:
        lock_transaction(db)
        user=db.scalar(select(User).where(User.email==data['email']))
        membership=db.get(Membership,user.id)
        org=db.get(Organization,membership.organization_id)
        original=org.id
        assert membership.role==role and not org.approved
        assert not db.scalar(select(IssuerKey).where(IssuerKey.organization_id==org.id))
        with pytest.raises(ValueError):approve_membership(db,user,'VERIFIER' if role=='ISSUER' else 'ISSUER',org.name)
        approved=approve_membership(db,user,role,org.name)
        assert approved.id==original
        db.commit()
        assert bool(db.scalar(select(IssuerKey).where(IssuerKey.organization_id==original)))==(role=='ISSUER')
        with pytest.raises(ValueError):approve_membership(db,user,role,org.name)
    assert c.post('/api/v1/auth/login',json=login).status_code==200
    me=c.get('/api/v1/auth/me').json()
    assert me['role']==role and me['organization']['id']==original
    assert c.get('/api/v1/dashboard').status_code==200
    assert c.get('/api/v1/issuer/drafts').status_code==(200 if role=='ISSUER' else 403)
    assert c.get('/api/v1/verification/requests').status_code==(200 if role=='VERIFIER' else 403)
