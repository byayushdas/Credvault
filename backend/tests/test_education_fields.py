import uuid
from conftest import request


def test_degree_without_cgpa_or_expiry(env):
    issuer, verifier = env['login'](2), env['login'](3)
    claims = {'degree': 'Demo degree', 'universityId': 'DEMO', 'rollNumber': '01'}
    response = issuer.post('/api/v1/issuer/documents', headers={'Idempotency-Key': str(uuid.uuid4())}, json={
        'owner_id': env['ids'][0], 'title': 'Education certificate', 'type': 'DEGREE',
        'issued_at': '2026-01-01', 'claims': claims})
    assert response.status_code == 201, response.text
    doc = response.json()
    assert doc['expires_at'] is None
    matches = verifier.get('/api/v1/verification/discover', params={
        'owner_id': env['ids'][0], 'credential_type': 'DEGREE'}).json()
    match = next(item for item in matches if item['id'] == doc['id'])
    assert set(match['fields']) == set(claims)
    assert request(verifier, doc, ['cgpa']).status_code == 422
    assert request(verifier, doc, ['degree']).status_code == 201
