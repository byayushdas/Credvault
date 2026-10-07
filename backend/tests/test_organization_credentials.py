import uuid
from conftest import request, rule
from app.services.document_service import SCHEMAS


def test_organisation_types_issue_and_disclose_only_consented_fields(env):
    issuer, owner, verifier = (env['login'](i) for i in (2, 0, 3))
    for kind in ('GENERAL', 'EMPLOYMENT', 'HEALTHCARE'):
        fields = list(SCHEMAS[kind]['fields'])
        claims = {field: 'Private value for ' + field for field in fields}
        response = issuer.post('/api/v1/issuer/documents',
            headers={'Idempotency-Key': str(uuid.uuid4())}, json={
                'owner_id': env['ids'][0], 'title': 'Organisation test ' + kind,
                'type': kind, 'issued_at': '2026-01-01', 'claims': claims})
        assert response.status_code == 201, response.text
        doc = response.json()
        assert owner.get('/api/v1/documents/' + doc['id']).json()['claims'] == claims
        for index, field in enumerate(fields):
            response = rule(owner, doc, env['orgs'][3], field,
                'AUTO_APPROVE' if index == 0 else 'DENY', credential_type=kind)
            assert response.status_code == 201, response.text
        response = request(verifier, doc, fields)
        assert response.status_code == 201, response.text
        result = verifier.get('/api/v1/verification/requests/' + response.json()['id'] + '/result')
        assert result.status_code == 200, result.text
        assert {claim['field'] for claim in result.json()['claims']} == {fields[0]}
        assert claims[fields[-1]] not in result.text
