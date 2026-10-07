import base64,json,time,uuid
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy import select
from cryptography.hazmat.primitives import serialization
from cryptography.exceptions import InvalidSignature
import pytest
from conftest import request,rule
from app.models import Credential,AuditLog,VerificationRequest
from app.services.audit_service import check_chain
from app.core.security import future
from app.services.encryption_service import canonical

def test_complete_mixed_disclosure_and_isolation(workflow):
    w=workflow;o=w['owner'];v=w['verifier'];d=w['doc']
    details=o.get('/api/v1/documents/'+d['id']).json()
    assert details['signature_valid'] and details['issuer_trusted']
    for field,action in [('degree','AUTO_APPROVE'),('universityId','AUTO_APPROVE'),('cgpa','ASK'),('rollNumber','DENY')]:
        assert rule(o,d,w['orgs'][3],field,action).status_code==201
    started=time.perf_counter();r=request(v,d);elapsed=time.perf_counter()-started
    assert r.status_code==201,r.text
    req=r.json();assert req['status']=='PENDING'
    assert {f['field']:f['decision'] for f in req['fields']}=={'degree':'APPROVED','universityId':'APPROVED','cgpa':'PENDING','rollNumber':'DENIED'}
    assert v.get('/api/v1/verification/requests/'+req['id']+'/result').status_code==409
    assert o.get('/api/v1/notifications').json()['unread']>=1
    decide=o.post('/api/v1/verification/requests/'+req['id']+'/decide',json={'revision':req['revision'],'decisions':{'cgpa':'APPROVED'}})
    assert decide.status_code==200,decide.text
    assert decide.json()['status']=='PARTIAL'
    start=time.perf_counter();response=v.get('/api/v1/verification/requests/'+req['id']+'/result');result_elapsed=time.perf_counter()-start
    assert response.status_code==200,response.text
    result=response.json();assert {c['field'] for c in result['claims']}=={'degree','universityId','cgpa'}
    assert 'NEVER-SHARE-ROLL-9371' not in response.text and 'rollNumber' not in response.text and 'dateOfBirth' not in response.text
    public=serialization.load_pem_public_key(result['public_key'].encode())
    for claim in result['claims']:
        raw=base64.b64decode(claim['signed_payload']);public.verify(base64.b64decode(claim['signature']),raw)
        payload=json.loads(raw)
        assert payload['owner_id']==d['owner_id'] and payload['credential_id']==d['id']
        for field,value in [('value','tampered'),('owner_id',w['ids'][1]),('credential_id',str(uuid.uuid4()))]:
            with pytest.raises(InvalidSignature):public.verify(base64.b64decode(claim['signature']),canonical({**payload,field:value}))
    b=w['login'](1);vb=w['login'](4)
    for suffix in ['', '/file','/package']:
        assert b.get('/api/v1/documents/'+d['id']+suffix).status_code==404
        assert vb.get('/api/v1/documents/'+d['id']+suffix).status_code==403
    assert vb.get('/api/v1/verification/requests/'+req['id']).status_code==404
    assert vb.get('/api/v1/verification/requests/'+req['id']+'/result').status_code==404
    assert b.post('/api/v1/verification/requests/'+req['id']+'/decide',json={'revision':req['revision'],'decisions':{'cgpa':'APPROVED'}}).status_code==404
    assert b.get('/api/v1/search?q=Integration').json()==[]
    assert o.get('/api/v1/dashboard').json()['disclosures']==1
    assert any(e['action']=='DISCLOSURE' and set(e['shared'])=={'degree','universityId','cgpa'} for e in o.get('/api/v1/audit').json())
    with w['factory']() as db:
        c=db.get(Credential,d['id']);assert 'PRIVATE-DEGREE' not in c.claims_encrypted and 'NEVER-SHARE' not in c.claims_encrypted
        assert check_chain(db)['valid']
    assert elapsed<2 and result_elapsed<2
    print(f'PostgreSQL mixed evaluation {elapsed*1000:.1f} ms; result {result_elapsed*1000:.1f} ms')
    assert w['issuer'].post('/api/v1/issuer/documents/'+d['id']+'/revoke',json={'reason':'Classroom demonstration revocation'}).status_code==200
    assert v.get('/api/v1/verification/requests/'+req['id']+'/result').status_code==409

def test_duplicate_concurrent_submission_and_decisions(workflow):
    w=workflow;key=str(uuid.uuid4())
    with ThreadPoolExecutor(2) as pool:responses=list(pool.map(lambda _:request(w['verifier'],w['doc'],['degree'],key=key),range(2)))
    assert [r.status_code for r in responses]==[201,201]
    assert responses[0].json()['id']==responses[1].json()['id']
    r=responses[0].json();url='/api/v1/verification/requests/'+r['id']+'/decide'
    with ThreadPoolExecutor(2) as pool:outcomes=list(pool.map(lambda _:w['owner'].post(url,json={'revision':r['revision'],'decisions':{'degree':'APPROVED'}}),range(2)))
    assert sorted(x.status_code for x in outcomes)==[200,409]
    assert request(w['verifier'],w['doc'],['cgpa'],key=key).status_code==409

def test_pending_expiry_cancel_and_no_rule(workflow):
    w=workflow;r=request(w['verifier'],w['doc'],['degree']).json();assert r['status']=='PENDING'
    assert w['verifier'].post('/api/v1/verification/requests/'+r['id']+'/cancel').status_code==200
    assert w['owner'].post('/api/v1/verification/requests/'+r['id']+'/decide',json={'revision':r['revision'],'decisions':{'degree':'APPROVED'}}).status_code==409
    r=request(w['verifier'],w['doc'],['degree']).json()
    with w['factory']() as db:db.get(VerificationRequest,r['id']).expires_at=future(seconds=-1);db.commit()
    assert w['verifier'].get('/api/v1/verification/requests/'+r['id']).json()['status']=='EXPIRED'
    assert w['verifier'].get('/api/v1/verification/requests/'+r['id']+'/result').status_code==409

def test_manual_denial_and_auto_approval(workflow):
    w=workflow;r=request(w['verifier'],w['doc'],['cgpa']).json()
    response=w['owner'].post('/api/v1/verification/requests/'+r['id']+'/decide',json={'revision':r['revision'],'decisions':{'cgpa':'DENIED'}})
    assert response.json()['status']=='DENIED'
    assert w['verifier'].get('/api/v1/verification/requests/'+r['id']+'/result').status_code==409
    assert rule(w['owner'],w['doc'],w['orgs'][3],'degree','AUTO_APPROVE').status_code==201
    r=request(w['verifier'],w['doc'],['degree']).json();assert r['status']=='APPROVED'
    assert w['verifier'].get('/api/v1/verification/requests/'+r['id']+'/result').status_code==200

def test_consent_changes_do_not_reuse_broad_grants(workflow):
    w=workflow;rule(w['owner'],w['doc'],w['orgs'][3],'degree','AUTO_APPROVE')
    r=request(w['verifier'],w['doc'],['degree']).json()
    assert w['verifier'].get('/api/v1/verification/requests/'+r['id']+'/result').status_code==200
    assert rule(w['owner'],w['doc'],None,'degree','DENY').status_code==201
    assert w['verifier'].get('/api/v1/verification/requests/'+r['id']+'/result').status_code==409
    assert w['verifier'].get('/api/v1/verification/requests/'+r['id']).json()['status']=='DENIED'

def test_audit_failure_blocks_disclosure(workflow,monkeypatch):
    w=workflow;rule(w['owner'],w['doc'],w['orgs'][3],'degree','AUTO_APPROVE')
    r=request(w['verifier'],w['doc'],['degree']).json()
    def fail(*args,**kwargs):raise RuntimeError('Injected persistence failure')
    monkeypatch.setattr('app.routers.verification.audit',fail)
    response=w['verifier'].get('/api/v1/verification/requests/'+r['id']+'/result')
    assert response.status_code==500 and 'PRIVATE-DEGREE' not in response.text

def test_disclosure_and_revocation_are_serialized(workflow):
    w=workflow;rule(w['owner'],w['doc'],w['orgs'][3],'degree','AUTO_APPROVE')
    r=request(w['verifier'],w['doc'],['degree']).json()
    with ThreadPoolExecutor(2) as pool:
        a=pool.submit(w['verifier'].get,'/api/v1/verification/requests/'+r['id']+'/result')
        b=pool.submit(w['issuer'].post,'/api/v1/issuer/documents/'+w['doc']['id']+'/revoke',json={'reason':'Concurrent revocation test'})
        assert a.result().status_code in (200,409);assert b.result().status_code==200
    assert w['verifier'].get('/api/v1/verification/requests/'+r['id']+'/result').status_code==409
    with w['factory']() as db:
        events=list(db.scalars(select(AuditLog).where(AuditLog.credential_id==w['doc']['id']).order_by(AuditLog.id)))
        revoke_id=next(e.id for e in events if e.action=='CREDENTIAL_REVOKED')
        assert all(e.id<revoke_id for e in events if e.action=='DISCLOSURE')
