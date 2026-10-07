import pytest
from fastapi.testclient import TestClient

def test_vault_id_generation_and_uniqueness(env):
    c = TestClient(env['app'], base_url='http://localhost', raise_server_exceptions=False)
    
    # Create new owner
    payload1 = {'name': 'Owner One', 'email': 'owner1@demo.test', 'password': 'Password1!'}
    assert c.post('/api/v1/auth/register', json=payload1).status_code == 201
    
    c1 = TestClient(env['app'], base_url='http://localhost', raise_server_exceptions=False)
    assert c1.post('/api/v1/auth/login', json={'email': payload1['email'], 'password': payload1['password']}).status_code == 200
    me1 = c1.get('/api/v1/auth/me')
    c1.headers['X-CSRF-Token'] = me1.json()['csrf']
    
    # Access vault API
    vault1 = c1.get('/api/v1/vault/me')
    assert vault1.status_code == 200
    data1 = vault1.json()
    assert data1['success'] is True
    assert 'vault_id' in data1['data']
    assert data1['data']['vault_id'].startswith('CV-')
    
    # Create another owner
    payload2 = {'name': 'Owner Two', 'email': 'owner2@demo.test', 'password': 'Password1!'}
    assert c.post('/api/v1/auth/register', json=payload2).status_code == 201
    
    c2 = TestClient(env['app'], base_url='http://localhost', raise_server_exceptions=False)
    assert c2.post('/api/v1/auth/login', json={'email': payload2['email'], 'password': payload2['password']}).status_code == 200
    me2 = c2.get('/api/v1/auth/me')
    c2.headers['X-CSRF-Token'] = me2.json()['csrf']
    
    vault2 = c2.get('/api/v1/vault/me')
    assert vault2.status_code == 200
    data2 = vault2.json()
    assert data2['data']['vault_id'] != data1['data']['vault_id'] # Unique
    
    # Check it remains unchanged
    vault1_again = c1.get('/api/v1/vault/me')
    assert vault1_again.json()['data']['vault_id'] == data1['data']['vault_id']

def test_vault_access_control(env):
    owner = env['login'](0) # Owner
    issuer = env['login'](2) # Issuer
    verifier = env['login'](3) # Verifier
    
    assert owner.get('/api/v1/vault/me').status_code == 200
    assert issuer.get('/api/v1/vault/me').status_code == 403
    assert verifier.get('/api/v1/vault/me').status_code == 403

def test_vault_qr_endpoint(env):
    owner = env['login'](0)
    issuer = env['login'](2)
    
    qr_res = owner.get('/api/v1/vault/me/qr')
    assert qr_res.status_code == 200
    data = qr_res.json()
    
    assert data['success'] is True
    assert 'qr_payload' in data['data']
    assert data['data']['qr_payload'].startswith('credvault://vault/CV-')
    assert 'email' not in data['data']
    assert 'name' not in data['data']
    assert 'owner_id' not in data['data'] # Ensure owner_id isn't leaked here either
    
    # Issuer should not access
    assert issuer.get('/api/v1/vault/me/qr').status_code == 403

def test_qr_verification_minimum_disclosure_and_auth(env):
    owner = env['login'](0)
    verifier = env['login'](3)
    issuer = env['login'](2)
    unauthenticated = TestClient(env['app'], base_url='http://localhost')
    
    # 1. Get owner's vault ID
    vault_res = owner.get('/api/v1/vault/me')
    assert vault_res.status_code == 200
    vault_id = vault_res.json()['data']['vault_id']
    
    payload = {
        'vault_id': vault_id,
        'credential_type': 'HEALTHCARE',
        'fields': ['blood_type'],
        'purpose': 'Testing QR verification disclosure',
        'lifetime_hours': 24
    }
    
    headers = {'idempotency-key': '0123456789abcdefQRTEST1'}
    
    # 2. Unauthenticated verifier cannot access
    res_unauth = unauthenticated.post('/api/v1/verification/requests/from-vault', json=payload, headers=headers)
    assert res_unauth.status_code in (401, 403)
    
    # 3. Issuer cannot access
    res_issuer = issuer.post('/api/v1/verification/requests/from-vault', json=payload, headers=headers)
    assert res_issuer.status_code == 403
    
    # 4. Valid verifier submitting request via QR code reference
    res = verifier.post('/api/v1/verification/requests/from-vault', json=payload, headers=headers)
    
    # The owner does not have a HEALTHCARE credential yet, so this should not leak anything
    # other than a strict 404 meaning "Owner does not have a valid credential of this type"
    assert res.status_code == 404
    
    # Now we create a DEGREE credential for the owner
    payload['credential_type'] = 'DEGREE'
    payload['fields'] = ['degree', 'universityId']
    
    # Let's issue a credential through the existing API
    issue_payload = {
        'vault_id': vault_id,
        'title': 'Test Degree',
        'type': 'DEGREE',
        'claims': {'degree': 'BSc', 'universityId': 'Test Uni', 'rollNumber': '1234'},
        'issued_at': '2026-10-07T00:00:00Z'
    }
    issue_res = issuer.post('/api/v1/issuer/documents/issue-to-vault', json=issue_payload, headers={'idempotency-key': '0123456789abcdefISSUE'})
    assert issue_res.status_code == 201
    
    # Now verifier tries again
    headers2 = {'idempotency-key': '0123456789abcdefQRTEST2'}
    res2 = verifier.post('/api/v1/verification/requests/from-vault', json=payload, headers=headers2)
    assert res2.status_code == 201
    
    data = res2.json()
    assert 'id' in data
    assert 'fields' in data
    
    # Verify NO RAW CLAIMS or sensitive data were leaked in the setup menu or result
    for f in data['fields']:
        assert 'value' not in f
        assert 'degree' not in str(f) or 'decision' in f # Only metadata is present
    
    assert 'claims' not in data
    
    # Ensure consent engine applies
    # Verify that we can query the result only after approval
    res3 = verifier.get(f"/api/v1/verification/requests/{data['id']}/result")
    assert res3.status_code == 409 # Request is pending

