import json,uuid,base64
from pathlib import Path
from fastapi.testclient import TestClient
from sqlalchemy import select
from conftest import PASSWORD
from app.models import User,Session,ResetToken,OAuthClient,OAuthToken,Membership,Organization
from app.core.security import future,hash_password
from app.main import attempts

def test_authentication_registration_csrf_roles_logout(env):
    c=TestClient(env['app'],base_url='http://localhost',raise_server_exceptions=False)
    bad=c.post('/api/v1/auth/login',json={'email':'owner.a@demo.test','password':'incorrect'})
    assert bad.status_code==401
    payload={'name':'New Owner','email':'new.owner@demo.test','password':'A-new-private-password'}
    assert c.post('/api/v1/auth/register',json={**payload,'role':'ISSUER'}).status_code==422
    assert c.post('/api/v1/auth/register',json=payload).status_code==201
    assert c.post('/api/v1/auth/register',json=payload).status_code==409
    c.post('/api/v1/auth/login',json={'email':payload['email'],'password':payload['password']})
    me=c.get('/api/v1/auth/me');assert me.json()['role']=='OWNER'
    assert 'HttpOnly' in c.post('/api/v1/auth/login',json={'email':payload['email'],'password':payload['password']}).headers['set-cookie']
    assert c.post('/api/v1/auth/logout').status_code==403
    me=c.get('/api/v1/auth/me');c.headers['X-CSRF-Token']=me.json()['csrf']
    assert c.post('/api/v1/auth/logout',headers={'Origin':'https://attacker.invalid'}).status_code==403
    old=c.cookies.get('cv_session');assert c.post('/api/v1/auth/logout').status_code==200
    c.cookies.set('cv_session',old)
    assert c.get('/api/v1/auth/me').status_code==401
    assert c.get('/api/v1/documents').status_code==401
    owner=env['login'](0)
    assert owner.post('/api/v1/issuer/documents',json={}).status_code==403
    assert owner.get('/api/v1/verification/discover?owner_id='+env['ids'][0]+'&credential_type=DEGREE').status_code==403

def test_session_expiry_and_all_tab_logout(env):
    a=env['login'](0);b=env['login'](0)
    assert a.post('/api/v1/auth/logout').status_code==200
    assert b.get('/api/v1/auth/me').status_code==401
    a=env['login'](0)
    with env['factory']() as db:
        for s in db.scalars(select(Session).where(Session.user_id==env['ids'][0])):s.expires_at=future(seconds=-1)
        db.commit()
    assert a.get('/api/v1/auth/me').status_code==401

def test_password_reset_single_use_and_change(env):
    c=TestClient(env['app'],base_url='http://localhost',raise_server_exceptions=False)
    for email in ['owner.a@demo.test','unknown@demo.test']:
        res=c.post('/api/v1/auth/forgot-password',json={'email':email})
        assert res.status_code==200 and 'token' not in res.json()
    files=list((env['tmp']/'mailbox').glob('*.txt'));assert len(files)==1
    token=files[0].read_text().split('token=')[1]
    signed=env['login'](0)
    assert c.post('/api/v1/auth/reset-password',json={'token':token,'password':'New-secure-password-1'}).status_code==200
    assert signed.get('/api/v1/auth/me').status_code==401
    assert c.post('/api/v1/auth/reset-password',json={'token':token,'password':'New-secure-password-2'}).status_code==400
    assert c.post('/api/v1/auth/login',json={'email':'owner.a@demo.test','password':PASSWORD}).status_code==401
    assert c.post('/api/v1/auth/login',json={'email':'owner.a@demo.test','password':'New-secure-password-1'}).status_code==200
    c.headers['X-CSRF-Token']=c.get('/api/v1/auth/me').json()['csrf']
    assert c.post('/api/v1/auth/change-password',json={'current_password':'wrong','password':'Another-password-12'}).status_code==400
    assert c.post('/api/v1/auth/change-password',json={'current_password':'New-secure-password-1','password':'Another-password-12'}).status_code==200
    assert c.get('/api/v1/auth/me').status_code==401

def test_settings_notifications_persistence(env):
    c=env['login'](0)
    assert c.put('/api/v1/users/me',json={'name':'Changed Owner','timezone':'Asia/Kolkata','notifications':False}).status_code==200
    env['engine'].dispose()
    me=c.get('/api/v1/auth/me').json();assert me['name']=='Changed Owner' and me['notifications'] is False
    assert c.put('/api/v1/users/me',json={'name':'Changed Owner','timezone':'Bad/Timezone','notifications':True}).status_code==422
    assert c.post('/api/v1/notifications/all/read').status_code==200
    assert c.get('/api/v1/notifications').json()['unread']==0
    other=env['login'](1)
    own_id=c.get('/api/v1/notifications').json()['items'][0]['id']
    assert other.post('/api/v1/notifications/'+own_id+'/read').status_code==404

def test_oauth_client_credentials_scope_expiry_revocation(env):
    with env['factory']() as db:
        client=OAuthClient(id=str(uuid.uuid4()),user_id=env['ids'][3],organization_id=env['orgs'][3],
            secret_hash=hash_password('private-client-secret'),name='Test integration',scopes='requests:read')
        db.add(client);db.commit();cid=client.id
    c=TestClient(env['app'],base_url='http://localhost',raise_server_exceptions=False)
    c.raise_server_exceptions = True
    c._transport.raise_server_exceptions = True
    auth={'Authorization':'Basic '+base64.b64encode((cid+':private-client-secret').encode()).decode()}
    response=c.post('/api/v1/oauth/token',headers=auth,data={'grant_type':'client_credentials','scope':'requests:read'})
    assert response.status_code==200,response.text
    body=response.json();assert body['expires_in']==600 and body['scope']=='requests:read' and 'refresh_token' not in body
    token=body['access_token'];c.headers['Authorization']='Bearer '+token
    assert c.get('/api/v1/verification/requests').status_code==200
    assert c.get('/api/v1/documents').status_code==403
    assert c.post('/api/v1/verification/requests',json={}).status_code==403
    assert c.get('/api/v1/auth/me').status_code==403
    response=c.post('/api/v1/oauth/token',headers=auth,data={'grant_type':'client_credentials','scope':'results:read'})
    assert response.status_code==400,response.text
    verifier=env['login'](3)
    assert verifier.post('/api/v1/oauth/clients/'+cid+'/revoke').status_code==200
    assert c.get('/api/v1/verification/requests').status_code==401
    assert c.post('/api/v1/oauth/token',headers=auth,data={'grant_type':'client_credentials'}).status_code==401

def test_rate_limit_and_validation_does_not_echo_password(env):
    c=TestClient(env['app'],base_url='http://localhost',raise_server_exceptions=False)
    res=c.post('/api/v1/auth/register',json={'name':'A','email':'bad','password':'PRIVATE_PASSWORD'})
    assert res.status_code==422 and 'PRIVATE_PASSWORD' not in res.text
    for _ in range(20):c.post('/api/v1/auth/login',json={'email':'none@demo.test','password':'bad'})
    assert c.post('/api/v1/auth/login',json={'email':'none@demo.test','password':'bad'}).status_code==429



def test_expired_reset_and_oauth_tokens(env):
    from app.core.security import digest
    c=TestClient(env['app'],base_url='http://localhost',raise_server_exceptions=False)
    c.post('/api/v1/auth/forgot-password',json={'email':'owner.a@demo.test'})
    token=next((env['tmp']/'mailbox').glob('*.txt')).read_text().split('token=')[1]
    with env['factory']() as db:
        db.get(ResetToken,digest(token)).expires_at=future(seconds=-1)
        client=OAuthClient(id=str(uuid.uuid4()),user_id=env['ids'][3],organization_id=env['orgs'][3],secret_hash=hash_password('secret'),name='Expiry test')
        db.add(client);db.flush()
        db.add(OAuthToken(token_hash=digest('expired-test-access-token'),client_id=client.id,scopes='requests:read',expires_at=future(seconds=-1)))
        db.commit()
    assert c.post('/api/v1/auth/reset-password',json={'token':token,'password':'A-new-long-password'}).status_code==400
    assert c.get('/api/v1/verification/requests',headers={'Authorization':'Bearer expired-test-access-token'}).status_code==401
