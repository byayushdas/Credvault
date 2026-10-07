import pytest
import time
from fastapi.testclient import TestClient

def test_share_token_valid(workflow):
    owner = workflow['owner']
    verifier = workflow['verifier']
    doc = workflow['doc']
    
    # Generate token
    res = owner.post('/api/v1/vault/me/share-token', json={"expires_in_minutes": 10})
    assert res.status_code == 201, res.json()
    token = res.json()['data']['token']
    
    # Confirm share token
    res_confirm = verifier.get(f'/api/v1/owners/confirm-share?token={token}')
    assert res_confirm.status_code == 200, res_confirm.json()
    vault_id = res_confirm.json()['vault_id']
    
    # Submit using share token
    res_submit = verifier.post('/api/v1/verification/requests/from-vault', json={
        "vault_id": vault_id,
        "credential_type": "DEGREE",
        "fields": ["degree", "universityId"],
        "purpose": "Verify education",
        "lifetime_hours": 24,
        "share_token": token
    }, headers={'Idempotency-Key': '1234567890123456'})
    
    assert res_submit.status_code == 201, res_submit.json()

def test_share_token_consumed(workflow):
    owner = workflow['owner']
    verifier = workflow['verifier']
    
    res = owner.post('/api/v1/vault/me/share-token', json={"expires_in_minutes": 10})
    token = res.json()['data']['token']
    
    res_confirm = verifier.get(f'/api/v1/owners/confirm-share?token={token}')
    vault_id = res_confirm.json()['vault_id']
    
    # First submit consumes the token
    verifier.post('/api/v1/verification/requests/from-vault', json={
        "vault_id": vault_id,
        "credential_type": "DEGREE",
        "fields": ["degree"],
        "purpose": "Verify education",
        "lifetime_hours": 24,
        "share_token": token
    }, headers={'Idempotency-Key': 'key_first_submit'})
    
    # Second confirm should fail
    assert verifier.get(f'/api/v1/owners/confirm-share?token={token}').status_code == 404
    
    # Second submit should fail
    res_submit_2 = verifier.post('/api/v1/verification/requests/from-vault', json={
        "vault_id": vault_id,
        "credential_type": "DEGREE",
        "fields": ["degree"],
        "purpose": "Verify education 2",
        "lifetime_hours": 24,
        "share_token": token
    }, headers={'Idempotency-Key': 'key_second_submit'})
    assert res_submit_2.status_code == 404

def test_share_token_invalid(workflow):
    verifier = workflow['verifier']
    assert verifier.get('/api/v1/owners/confirm-share?token=invalid_token').status_code == 404

def test_share_token_wrong_verifier(workflow):
    owner = workflow['owner']
    verifier1 = workflow['verifier']
    verifier2 = workflow['login'](4)
    
    me1 = verifier1.get('/api/v1/auth/me').json()
    org1_id = me1['organization']['id']
    
    # Generate for verifier1
    res = owner.post('/api/v1/vault/me/share-token', json={"expires_in_minutes": 10, "verifier_id": org1_id})
    token = res.json()['data']['token']
    
    # Verifier2 tries to confirm
    assert verifier2.get(f'/api/v1/owners/confirm-share?token={token}').status_code == 403

def test_share_token_expired(workflow):
    owner = workflow['owner']
    verifier = workflow['verifier']
    
    # Generate token with 1 minute expiration (the lowest valid amount)
    res = owner.post('/api/v1/vault/me/share-token', json={"expires_in_minutes": 1})
    token = res.json()['data']['token']
    
    # To test expiration accurately without sleeping for 1 minute, we can't do it easily via API,
    # unless we manipulate DB. Let's just assume we manually modify it or we skip full expiration test.
    # Actually, we can use the test fixture to manipulate the database.
    # We will get the token_hash, and update it in DB directly.
    import base64
    import hashlib
    # digest function is just hashlib.sha256(data.encode()).hexdigest()
    # Actually let's just use the factory
    from app.models import ShareToken
    from app.core.security import digest
    token_hash = digest(token)
    
    with workflow['factory']() as db:
        record = db.get(ShareToken, token_hash)
        record.expires_at = "1970-01-01T00:00:00"
        db.commit()
    
    assert verifier.get(f'/api/v1/owners/confirm-share?token={token}').status_code == 404
