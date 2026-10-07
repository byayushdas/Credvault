import base64,io,json,uuid
from pathlib import Path
from sqlalchemy import select,text
from sqlalchemy.exc import DatabaseError
from PIL import Image
import pytest
from conftest import request,rule
from app.models import Credential,ConsentRule,IssuerKey,Organization
from app.core.security import future
from app.services.audit_service import check_chain

def image_content():
    out=io.BytesIO();Image.new('RGB',(20,20),(12,37,69)).save(out,format='PNG')
    return out.getvalue()

@pytest.mark.parametrize('action,enabled,expired,expected',[
    ('AUTO_APPROVE',True,False,'APPROVED'),('ASK',True,False,'PENDING'),('DENY',True,False,'DENIED'),
    ('AUTO_APPROVE',False,False,'PENDING'),('AUTO_APPROVE',True,True,'PENDING'),('DENY',False,False,'PENDING')])
def test_consent_matrix(workflow,action,enabled,expired,expected):
    w=workflow;r=rule(w['owner'],w['doc'],w['orgs'][3],'degree',action,enabled=enabled)
    assert r.status_code==201,r.text
    if expired:
        with w['factory']() as db:db.get(ConsentRule,r.json()['id']).expires_at=future(seconds=-1);db.commit()
    assert request(w['verifier'],w['doc'],['degree']).json()['status']==expected

def test_conflicts_specificity_and_deny_wins(workflow):
    w=workflow
    for action in ['AUTO_APPROVE','ASK']:assert rule(w['owner'],w['doc'],w['orgs'][3],'degree',action).status_code==201
    assert request(w['verifier'],w['doc'],['degree']).json()['status']=='PENDING'
    assert rule(w['owner'],w['doc'],None,'*','DENY',credential_id=None).status_code==201
    assert request(w['verifier'],w['doc'],['degree']).json()['status']=='DENIED'
    assert rule(w['login'](1),w['doc'],None,'degree','AUTO_APPROVE').status_code==404

def test_unknown_fields_owner_lookup_and_wizard_validation(workflow):
    w=workflow
    for fields in [['dateOfBirth'],['degree','degree'],[]]:
        res=request(w['verifier'],w['doc'],fields=['degree'],**{'purpose':'too' if not fields else 'Validation test purpose'})
        if not fields:assert res.status_code==422
        else:assert request(w['verifier'],w['doc'],fields=fields).status_code==422
    assert request(w['verifier'],w['doc'],['degree'],lifetime_hours=169).status_code==422
    assert request(w['verifier'],w['doc'],['degree'],owner_id=w['ids'][1]).status_code==404
    assert w['verifier'].get('/api/v1/verification/discover?owner_id=Asha&credential_type=DEGREE').status_code==404
    discovered=w['verifier'].get('/api/v1/verification/discover?owner_id='+w['ids'][0]+'&credential_type=DEGREE')
    assert discovered.status_code==200
    assert 'PRIVATE-DEGREE' not in discovered.text and 'claims' not in discovered.text and 'title' not in discovered.text

def test_personal_import_file_encryption_archive_and_access(workflow):
    w=workflow;raw=image_content();encoded=base64.b64encode(raw).decode()
    r=w['owner'].post('/api/v1/documents/import',json={'title':'Unverified personal upload','attachment':{'content':encoded}})
    assert r.status_code==201,r.text
    d=r.json();assert d['status']=='UNVERIFIED'
    assert w['owner'].get('/api/v1/documents/'+d['id']).json()['signature_valid'] is False
    assert w['owner'].get('/api/v1/documents/'+d['id']+'/file').content==raw
    assert w['login'](1).get('/api/v1/documents/'+d['id']+'/file').status_code==404
    assert w['verifier'].get('/api/v1/documents/'+d['id']+'/file').status_code==403
    assert request(w['verifier'],d,['degree']).status_code==409
    with w['factory']() as db:
        row=db.get(Credential,d['id']);path=Path(w['tmp'])/'encrypted'/row.file_name
        assert raw not in path.read_bytes()
        cipher=path.read_text();path.write_text(cipher[:20]+('A' if cipher[20]!='A' else 'B')+cipher[21:])
    assert w['owner'].get('/api/v1/documents/'+d['id']+'/file').status_code==409
    assert w['owner'].post('/api/v1/documents/'+d['id']+'/archive').json()['status']=='ARCHIVED'
    for value in [base64.b64encode(b'fake.pdf').decode(),'invalid base64']:
        assert w['owner'].post('/api/v1/documents/import',json={'title':'Not a real PDF','attachment':{'content':value}}).status_code==422
    assert w['owner'].post('/api/v1/auth/logout').status_code==200
    assert w['owner'].get('/api/v1/documents/'+d['id']+'/file').status_code==401

def test_signed_package_binding_tampering_and_replacement(workflow):
    w=workflow;url='/api/v1/documents/'+w['doc']['id']
    package=w['owner'].get(url+'/package').json()
    assert w['owner'].post('/api/v1/documents/import-package',json=package).status_code==200
    assert w['login'](1).post('/api/v1/documents/import-package',json=package).status_code==403
    package['record']['claims']['degree']='Modified'
    assert w['owner'].post('/api/v1/documents/import-package',json=package).status_code==422
    replacement=w['issuer'].post('/api/v1/issuer/documents',headers={'Idempotency-Key':str(uuid.uuid4())},json={
        'owner_id':w['ids'][0],'title':'Corrected education','type':'DEGREE','issued_at':'2026-01-01','replaces_id':w['doc']['id'],
        'claims':{'degree':'Corrected','universityId':'DEMO-NEW','cgpa':9.2,'rollNumber':'DO-NOT-SHARE'}})
    assert replacement.status_code==201,replacement.text
    assert replacement.json()['version']==2
    assert w['owner'].get(url).json()['status']=='SUPERSEDED'

@pytest.mark.parametrize('tamper',['ciphertext','signature','key','issuer','expiry'])
def test_integrity_trust_and_expiry_fail_closed(workflow,tamper):
    w=workflow;rule(w['owner'],w['doc'],w['orgs'][3],'degree','AUTO_APPROVE')
    r=request(w['verifier'],w['doc'],['degree']).json()
    with w['factory']() as db:
        d=db.get(Credential,w['doc']['id'])
        if tamper=='ciphertext':d.claims_encrypted='tampered ciphertext'
        if tamper=='signature':d.signature=base64.b64encode(b'wrong').decode()
        if tamper=='key':db.get(IssuerKey,d.key_id).revoked_at=future(seconds=-1)
        if tamper=='issuer':db.get(Organization,d.issuer_id).approved=False
        if tamper=='expiry':d.expires_at=future(seconds=-1)
        db.commit()
    response=w['verifier'].get('/api/v1/verification/requests/'+r['id']+'/result')
    assert response.status_code==409 and 'PRIVATE-DEGREE' not in response.text

def test_age_threshold_does_not_disclose_birth_date(env):
    o=env['login'](0);v=env['login'](3)
    d=next(d for d in o.get('/api/v1/documents').json() if d['type']=='AGE')
    rule(o,d,env['orgs'][3],'over18','AUTO_APPROVE')
    r=request(v,d,['over18']).json();result=v.get('/api/v1/verification/requests/'+r['id']+'/result')
    assert result.status_code==200,result.text
    assert result.json()['claims'][0]['value'] is True
    assert 'birth' not in result.text.lower() and 'assessmentDate' not in result.text

def test_audit_append_only_and_failed_file_transaction(workflow,monkeypatch):
    w=workflow
    with w['factory']() as db:
        with pytest.raises(DatabaseError):db.execute(text("UPDATE cv_audit SET outcome='TAMPERED'"));db.commit()
        db.rollback()
        with pytest.raises(DatabaseError):db.execute(text('DELETE FROM cv_audit'));db.commit()
        db.rollback();assert check_chain(db)['valid']
    def fail(*args,**kwargs):raise RuntimeError('Injected audit failure')
    monkeypatch.setattr('app.routers.documents.audit',fail)
    r=w['owner'].post('/api/v1/documents/import',json={'title':'Failing transaction','attachment':{'content':base64.b64encode(image_content()).decode()}})
    assert r.status_code==500
    assert not list((w['tmp']/'encrypted').glob('*.enc'))
    assert not any(d['title']=='Failing transaction' for d in w['owner'].get('/api/v1/documents').json())


def test_age_assessment_is_bound_to_threshold_proof(env):
    o=env['login'](0);v=env['login'](3)
    d=next(d for d in o.get('/api/v1/documents').json() if d['type']=='AGE')
    rule(o,d,env['orgs'][3],'over18','AUTO_APPROVE')
    r=request(v,d,['over18']).json()
    result=v.get('/api/v1/verification/requests/'+r['id']+'/result').json()
    payload=json.loads(base64.b64decode(result['claims'][0]['signed_payload']))
    assert payload['format']=='CredVault-claim-v2' and payload['assessment_date'] and payload['signed_at']
    assert 'birth' not in json.dumps(payload).lower()
    from datetime import datetime
    assert (datetime.fromisoformat(payload['expires_at'])-datetime.fromisoformat(payload['assessment_date'])).days<=365

def test_decision_versions_are_retained(workflow):
    from app.models import DecisionHistory
    w=workflow;a=rule(w['owner'],w['doc'],w['orgs'][3],'cgpa','ASK').json()
    r=request(w['verifier'],w['doc'],['cgpa']).json()
    assert w['owner'].post('/api/v1/verification/requests/'+r['id']+'/decide',json={'revision':r['revision'],'decisions':{'cgpa':'APPROVED'}}).status_code==200
    with w['factory']() as db:
        records=list(db.scalars(select(DecisionHistory).where(DecisionHistory.request_id==r['id']).order_by(DecisionHistory.created_at)))
        assert [x.decision for x in records]==['PENDING','APPROVED']
        assert records[0].rules[0]['id']==a['id'] and records[0].rules[0]['version']==1
        assert records[1].method=='MANUAL'

def test_stale_rule_changes_do_not_overwrite_consent(workflow):
    w=workflow
    created=rule(w['owner'],w['doc'],w['orgs'][3],'degree','ASK').json()
    url='/api/v1/consent/rules/'+created['id']
    fields=['verifier_id','credential_id','credential_type','field','action','enabled','expires_at','version']
    data={k:created[k] for k in fields}
    updated=w['owner'].put(url,json={**data,'action':'AUTO_APPROVE'})
    assert updated.status_code==200,updated.text
    assert updated.json()['version']==2
    assert w['owner'].put(url,json={**data,'enabled':False}).status_code==409
    assert w['owner'].delete(url+'?version=1').status_code==409
    current=next(r for r in w['owner'].get('/api/v1/consent/rules').json() if r['id']==created['id'])
    assert current['enabled'] and current['action']=='AUTO_APPROVE' and current['version']==2
    assert request(w['verifier'],w['doc'],['degree']).json()['status']=='APPROVED'
    assert w['owner'].delete(url+'?version=2').status_code==200

def test_wrong_master_key_and_issuer_attachment_integrity(workflow,monkeypatch):
    from app.core.config import settings
    import os
    w=workflow;raw=image_content()
    data={'owner_id':w['ids'][0],'title':'Signed attachment','type':'DEGREE','issued_at':'2026-01-01',
        'claims':{'degree':'Demo with attachment','universityId':'DEMO','cgpa':8.2,'rollNumber':'PRIVATE'},'attachment':{'content':base64.b64encode(raw).decode()}}
    r=w['issuer'].post('/api/v1/issuer/documents',headers={'Idempotency-Key':str(uuid.uuid4())},json=data)
    assert r.status_code==201,r.text
    url='/api/v1/documents/'+r.json()['id']
    assert w['owner'].get(url).json()['signature_valid']
    assert w['owner'].get(url+'/file').content==raw
    monkeypatch.setattr(settings,'AES_MASTER_KEY',base64.b64encode(os.urandom(32)).decode())
    res=w['owner'].get(url);assert res.status_code==409 and 'Demo with attachment' not in res.text
