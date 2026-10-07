import pytest
from app.models import Credential
from app.core.security import digest

def test_scenario_1_issuer_issues_degree(env):
    issuer = env['login'](2)
    owner = env['login'](0)
    
    # 3. Owner obtains Vault QR
    res_qr = owner.get('/api/v1/vault/me/qr')
    assert res_qr.status_code == 200
    qr_data = res_qr.json()['data']
    vault_id = qr_data['vault_id']
    qr_payload = qr_data['qr_payload']
    
    # 4. Issuer resolves Vault ID
    res_resolve = issuer.get(f'/api/v1/owners/confirm?vault_id={vault_id}')
    assert res_resolve.status_code == 200, res_resolve.json()
    assert res_resolve.json()['vault_id'] == vault_id
    
    # 6. Issuer selects Degree Certificate & 7. submits
    res_issue = issuer.post('/api/v1/issuer/documents/issue-to-vault', json={
        "vault_id": vault_id,
        "title": "B.Tech Computer Science",
        "type": "DEGREE",
        "claims": {
            "degree": "B.Tech",
            "universityId": "XYZ University",
            "cgpa": 8.7,
            "rollNumber": "123456"
        },
        "issued_at": "2026-01-01T00:00:00Z"
    }, headers={'Idempotency-Key': 'key-issue-degree-1234'})
    assert res_issue.status_code == 201, res_issue.json()
    doc = res_issue.json()
    
    # Assert credential belongs to correct owner
    assert doc['owner_id'] == env['ids'][0]
    
    # Owner sees new credential
    res_docs = owner.get('/api/v1/documents')
    assert res_docs.status_code == 200
    owner_docs = res_docs.json()
    assert any(d['id'] == doc['id'] for d in owner_docs)
    
    return vault_id, doc

def test_scenario_2_verifier_requests_approved_fields(env):
    vault_id, doc = test_scenario_1_issuer_issues_degree(env)
    owner = env['login'](0)
    verifier = env['login'](3)
    
    # 1. Owner sets rules: degree = AUTO_APPROVE, university = AUTO_APPROVE
    res_rule1 = owner.post('/api/v1/consent/rules', json={
        "credential_id": doc['id'],
        "field": "degree",
        "action": "AUTO_APPROVE"
    })
    assert res_rule1.status_code == 201
    
    res_rule2 = owner.post('/api/v1/consent/rules', json={
        "credential_id": doc['id'],
        "field": "universityId",
        "action": "AUTO_APPROVE"
    })
    assert res_rule2.status_code == 201
    
    # 2. Verifier scans owner QR and requests fields
    res_request = verifier.post('/api/v1/verification/requests/from-vault', json={
        "vault_id": vault_id,
        "credential_type": "DEGREE",
        "fields": ["degree", "universityId"],
        "purpose": "Employment Verification",
        "lifetime_hours": 24
    }, headers={'Idempotency-Key': 'key-verify-1-1234567'})
    
    assert res_request.status_code == 201, res_request.json()
    req = res_request.json()
    
    # Wait for result to be valid
    # Since it's auto-approved, the result should be APPROVED immediately
    res_result = verifier.get(f'/api/v1/verification/requests/{req["id"]}/result')
    assert res_result.status_code == 200
    
    result = res_result.json()
    assert result['status'] == 'APPROVED'
    
    # Only degree and universityId are disclosed
    claims = {c['field']: c['value'] for c in result['claims']}
    assert 'degree' in claims
    assert 'universityId' in claims
    assert 'cgpa' not in claims
    assert 'rollNumber' not in claims

def test_scenario_3_and_4_ask_and_deny(env):
    vault_id, doc = test_scenario_1_issuer_issues_degree(env)
    owner = env['login'](0)
    verifier = env['login'](3)
    
    # SCENARIO 3 - ASK
    res_rule_ask = owner.post('/api/v1/consent/rules', json={
        "credential_id": doc['id'],
        "field": "cgpa",
        "action": "ASK"
    })
    assert res_rule_ask.status_code == 201
    
    # Verifier requests cgpa
    res_req_ask = verifier.post('/api/v1/verification/requests/from-vault', json={
        "vault_id": vault_id,
        "credential_type": "DEGREE",
        "fields": ["cgpa"],
        "purpose": "Background Check",
        "lifetime_hours": 24
    }, headers={'Idempotency-Key': 'key-verify-2-1234567'})
    assert res_req_ask.status_code == 201, res_req_ask.json()
    req_ask = res_req_ask.json()
    
    # Status should be PENDING initially (from verifier's perspective, 409 or status is not APPROVED)
    res_result_ask = verifier.get(f'/api/v1/verification/requests/{req_ask["id"]}/result')
    assert res_result_ask.status_code in [404, 409]
    
    # Owner approves
    res_decide = owner.post(f'/api/v1/verification/requests/{req_ask["id"]}/decide', json={
        "revision": req_ask['revision'],
        "decisions": {"cgpa": "APPROVED"}
    })
    assert res_decide.status_code == 200
    
    # Result is now available
    res_result_ask2 = verifier.get(f'/api/v1/verification/requests/{req_ask["id"]}/result')
    assert res_result_ask2.status_code == 200
    assert res_result_ask2.json()['status'] == 'APPROVED'
    assert res_result_ask2.json()['claims'][0]['field'] == 'cgpa'
    
    # SCENARIO 4 - DENY
    res_rule_deny = owner.post('/api/v1/consent/rules', json={
        "credential_id": doc['id'],
        "field": "rollNumber",
        "action": "DENY"
    })
    assert res_rule_deny.status_code == 201
    
    res_req_deny = verifier.post('/api/v1/verification/requests/from-vault', json={
        "vault_id": vault_id,
        "credential_type": "DEGREE",
        "fields": ["rollNumber"],
        "purpose": "Background Check",
        "lifetime_hours": 24
    }, headers={'Idempotency-Key': 'key-verify-3-1234567'})
    assert res_req_deny.status_code == 201, res_req_deny.json()
    req_deny = res_req_deny.json()
    
    # Result should be DENIED immediately since it's AUTO-DENY rule
    # wait, rule action is DENY. So it should immediately be rejected.
    res_result_deny = verifier.get(f'/api/v1/verification/requests/{req_deny["id"]}/result')
    assert res_result_deny.status_code == 409

def test_scenario_5_invalid_qr(env):
    verifier = env['login'](3)
    
    # Submitting with invalid vault_id
    res = verifier.post('/api/v1/verification/requests/from-vault', json={
        "vault_id": "invalid-vault-id",
        "credential_type": "DEGREE",
        "fields": ["degree"],
        "purpose": "Verify education invalid",
        "lifetime_hours": 24
    }, headers={'Idempotency-Key': 'key-invalid-qr-123456'})
    
    assert res.status_code in [422, 404]

def test_scenario_6_forbidden_access(env):
    # Verifier attempts to access vault documents directly
    verifier = env['login'](3)
    
    # Verifier fetches a document that they don't own
    res = verifier.get('/api/v1/documents')
    assert res.status_code == 403

def test_scenario_7_qr_does_not_leak_data(env):
    owner = env['login'](0)
    res_qr = owner.get('/api/v1/vault/me/qr')
    assert res_qr.status_code == 200
    qr_data = res_qr.json()['data']
    
    assert 'qr_payload' in qr_data
    payload = qr_data['qr_payload']
    
    # assert starts with credvault://vault/
    assert payload.startswith('credvault://vault/')
    
    # assert no personal data is leaked
    # payload is basically credvault://vault/<vault_id>
    assert '@' not in payload # no email
    assert 'Test' not in payload # no names
    assert '{' not in payload # no json data
