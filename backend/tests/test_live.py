import uuid
from sqlalchemy import select
from starlette.requests import Request
from fastapi import HTTPException
import pytest
from app.models import LiveRevision
from app.services.live_service import changed
from app.routers import events
from conftest import request, rule

def revision(factory, user_id):
    with factory() as db:
        row=db.get(LiveRevision,user_id)
        return row.revision if row else 0

def test_live_cursor_commit_rollback_and_isolation(env):
    owner, other=env['ids'][:2]
    before=revision(env['factory'],owner)
    other_before=revision(env['factory'],other)
    with env['factory']() as db:
        changed(db,[owner])
        assert revision(env['factory'],owner)==before
        db.rollback()
    assert revision(env['factory'],owner)==before
    with env['factory']() as db:
        changed(db,[owner]);db.commit()
    assert revision(env['factory'],owner)==before+1
    assert revision(env['factory'],other)==other_before

def test_event_subscription_uses_session_and_rechecks_logout(env,monkeypatch):
    monkeypatch.setattr(events,'SessionLocal',env['factory'])
    a=env['login'](0);b=env['login'](1)
    def connection(client):
        return Request({'type':'http','method':'GET','path':'/api/v1/events','query_string':('user_id='+env['ids'][0]).encode(),
            'headers':[(b'cookie',('cv_session='+client.cookies.get('cv_session')).encode())]})
    first,second=connection(a),connection(b)
    assert events.snapshot(first)[0]==env['ids'][0]
    assert events.snapshot(second)[0]==env['ids'][1]
    a.post('/api/v1/auth/logout')
    with pytest.raises(HTTPException) as exc:events.snapshot(first)
    assert exc.value.status_code==401
    assert a.get('/api/v1/events').status_code==401
    assert b.get('/api/v1/events',headers={'Origin':'https://untrusted.invalid'}).status_code==403

def test_marksheet_disclosure_recipient_and_live_recipients(env):
    issuer=env['login'](2);owner=env['login'](0);verifier=env['login'](3)
    reference=env['ids'][0]
    assert issuer.get('/api/v1/owners/confirm?vault_id='+reference).json()=={'vault_id':reference,'status':'Available'}
    assert issuer.get('/api/v1/owners/confirm?vault_id='+str(uuid.uuid4())).status_code==404
    assert owner.get('/api/v1/owners/confirm?vault_id='+reference).status_code==403
    others=[revision(env['factory'],env['ids'][i]) for i in (1,4)]
    before=revision(env['factory'],reference)
    response=issuer.post('/api/v1/issuer/documents',headers={'Idempotency-Key':str(uuid.uuid4())},json={
        'owner_id':reference,'title':'Live Semester Marksheet','type':'SEMESTER_MARKSHEET','issued_at':'2026-01-01',
        'claims':{'course':'Demo Computer Science','semester':6,'cgpa':8.7,'rollNumber':'NEVER-LIVE-ROLL'}})
    assert response.status_code==201,response.text
    doc=response.json()
    assert revision(env['factory'],reference)>before
    for field,action in [('course','AUTO_APPROVE'),('semester','AUTO_APPROVE'),('cgpa','ASK'),('rollNumber','DENY')]:
        assert rule(owner,doc,env['orgs'][3],field,action).status_code==201
    req=request(verifier,doc,['course','semester','cgpa','rollNumber']).json()
    verifier_before=revision(env['factory'],env['ids'][3])
    assert owner.post('/api/v1/verification/requests/'+req['id']+'/decide',json={'revision':req['revision'],'decisions':{'cgpa':'APPROVED'}}).status_code==200
    assert revision(env['factory'],env['ids'][3])>verifier_before
    result=verifier.get('/api/v1/verification/requests/'+req['id']+'/result')
    assert result.status_code==200 and 'NEVER-LIVE-ROLL' not in result.text
    assert {c['field'] for c in result.json()['claims']}=={'course','semester','cgpa'}
    assert [revision(env['factory'],env['ids'][i]) for i in (1,4)]==others
    dashboard=issuer.get('/api/v1/dashboard').json()
    docs=issuer.get('/api/v1/documents').json()
    assert dashboard['revoked']==sum(d['status']=='REVOKED' for d in docs)
    assert dashboard['expired']==sum(d['status']=='EXPIRED' for d in docs)
