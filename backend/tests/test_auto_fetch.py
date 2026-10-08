import base64
import uuid
from concurrent.futures import ThreadPoolExecutor

import pytest
from sqlalchemy import select
from conftest import auto_fetch, request, rule
from app.core.security import future
from app.models import AuditLog, Credential, DecisionHistory, LiveRevision, VerificationRequest
from app.services.audit_service import check_chain


@pytest.mark.parametrize('from_vault', [False, True])
def test_switch_controls_requests_and_preserves_manual_approval(workflow, from_vault):
    w = workflow
    o, v, doc = w['owner'], w['verifier'], w['doc']
    assert doc['auto_fetch'] is False
    # Legacy automatic rules must never bypass the owner's off switch.
    assert rule(o, doc, w['orgs'][3], 'degree', 'AUTO_APPROVE').status_code == 201
    vault = o.get('/api/v1/vault/me/qr').json()['data']['vault_id']

    def submit():
        if not from_vault:
            response = request(v, doc, ['degree'])
        else:
            response = v.post('/api/v1/verification/requests/from-vault', json={
                'vault_id': vault, 'credential_type': 'DEGREE', 'fields': ['degree'],
                'purpose': 'Auto fetch integration test', 'lifetime_hours': 24,
            }, headers={'Idempotency-Key': str(uuid.uuid4())})
        assert response.status_code == 201, response.text
        return response.json()

    pending = submit()
    url = '/api/v1/verification/requests/' + pending['id']
    assert pending['status'] == 'PENDING'
    assert v.get(url + '/result').status_code == 409
    approved = o.post(url + '/decide', json={
        'revision': pending['revision'], 'decisions': {'degree': 'APPROVED'}})
    assert approved.status_code == 200
    assert v.get(url + '/result').status_code == 200

    auto_fetch(o, doc)
    # An old Ask rule cannot defeat the document's explicit opt-in.
    assert rule(o, doc, None, '*', 'ASK').status_code == 201
    automatic = submit()
    automatic_url = '/api/v1/verification/requests/' + automatic['id']
    assert automatic['status'] == 'APPROVED'
    assert automatic['fields'][0]['method'] == 'AUTO_FETCH'
    result = v.get(automatic_url + '/result')
    assert result.status_code == 200
    assert [c['field'] for c in result.json()['claims']] == ['degree']
    assert 'NEVER-SHARE-ROLL' not in result.text
    assert o.get('/api/v1/documents/' + doc['id']).json()['auto_fetch'] is True
    assert next(d for d in o.get('/api/v1/documents').json() if d['id'] == doc['id'])['auto_fetch'] is True

    auto_fetch(o, doc, False)
    assert v.get(automatic_url + '/result').status_code == 409
    updated = v.get(automatic_url).json()
    assert updated['status'] == 'PENDING' and updated['revision'] > automatic['revision']
    assert v.get(url + '/result').status_code == 200  # Manual consent survives.
    assert submit()['status'] == 'PENDING'
    assert o.post(automatic_url + '/decide', json={
        'revision': automatic['revision'], 'decisions': {'degree': 'APPROVED'}}).status_code == 409
    assert o.post(automatic_url + '/decide', json={
        'revision': updated['revision'], 'decisions': {'degree': 'APPROVED'}}).status_code == 200
    assert v.get(automatic_url + '/result').status_code == 200


def test_only_document_owner_can_update_strict_boolean(workflow):
    w = workflow
    path = '/api/v1/documents/' + w['doc']['id'] + '/auto-fetch'
    for client, status in [(w['login'](1), 404), (w['issuer'], 403), (w['verifier'], 403)]:
        assert client.patch(path, json={'auto_fetch': True}).status_code == status
    for body in [{}, {'auto_fetch': None}, {'auto_fetch': 'false'}, {'auto_fetch': 1},
                 {'auto_fetch': True, 'owner_id': w['ids'][1]}]:
        assert w['owner'].patch(path, json=body).status_code == 422
    assert w['owner'].patch('/api/v1/documents/' + str(uuid.uuid4()) + '/auto-fetch',
        json={'auto_fetch': True}).status_code == 404
    assert w['owner'].patch(path, json={'auto_fetch': True}, headers={'X-CSRF-Token': 'bad'}).status_code == 403
    assert w['owner'].get('/api/v1/documents/' + w['doc']['id']).json()['auto_fetch'] is False


def test_pending_requests_follow_switch_but_denials_and_terminal_requests_do_not(workflow):
    w = workflow
    o, v, d = w['owner'], w['verifier'], w['doc']
    pending = request(v, d, ['degree']).json()
    denied = request(v, d, ['degree']).json()
    cancelled = request(v, d, ['degree']).json()
    expired = request(v, d, ['degree']).json()
    prefix = '/api/v1/verification/requests/'
    assert o.post(prefix + denied['id'] + '/decide', json={
        'revision': denied['revision'], 'decisions': {'degree': 'DENIED'}}).status_code == 200
    assert v.post(prefix + cancelled['id'] + '/cancel').status_code == 200
    with w['factory']() as db:
        db.get(VerificationRequest, expired['id']).expires_at = future(seconds=-1)
        db.commit()
    auto_fetch(o, d)
    assert v.get(prefix + pending['id'] + '/result').status_code == 200
    for req, status in [(denied, 'DENIED'), (cancelled, 'CANCELLED'), (expired, 'EXPIRED')]:
        assert v.get(prefix + req['id']).json()['status'] == status
        assert v.get(prefix + req['id'] + '/result').status_code == 409
    assert rule(o, d, None, 'degree', 'DENY').status_code == 201
    assert v.get(prefix + pending['id'] + '/result').status_code == 409
    assert request(v, d, ['degree']).json()['status'] == 'DENIED'
    assert request(v, d, ['cgpa']).json()['status'] == 'APPROVED'
    assert v.get('/api/v1/documents/' + d['id'] + '/file').status_code == 403


def test_per_document_setting_audit_live_and_signatures(workflow):
    w = workflow
    o, v, d = w['owner'], w['verifier'], w['doc']
    package = o.get('/api/v1/documents/' + d['id'] + '/package').json()
    req = request(v, d, ['degree']).json()
    with w['factory']() as db:
        before = {user: db.get(LiveRevision, user).revision for user in (w['ids'][0], w['ids'][3])}
    auto_fetch(o, d)
    auto_fetch(o, d)  # Setting the same value is idempotent.
    assert o.get('/api/v1/documents/' + d['id'] + '/package').json() == package
    assert o.get('/api/v1/documents/' + d['id']).json()['signature_valid']
    others = [x for x in o.get('/api/v1/documents').json() if x['id'] != d['id']]
    assert others and all(x['auto_fetch'] is False for x in others)
    with w['factory']() as db:
        events = list(db.scalars(select(AuditLog).where(AuditLog.credential_id == d['id'],
            AuditLog.action == 'DOCUMENT_AUTO_FETCH_UPDATED')))
        assert len(events) == 1 and events[0].outcome == 'ENABLED'
        history = list(db.scalars(select(DecisionHistory).where(DecisionHistory.request_id == req['id'])
            .order_by(DecisionHistory.created_at)))
        assert [f.decision for f in history] == ['PENDING', 'APPROVED']
        assert history[-1].method == 'AUTO_FETCH'
        assert all(db.get(LiveRevision, user).revision > value for user, value in before.items())
        assert check_chain(db)['valid']


def test_auto_fetch_does_not_make_invalid_documents_verifiable(workflow):
    w = workflow
    from test_privacy import image_content
    imported = w['owner'].post('/api/v1/documents/import', json={
        'title': 'Personal document', 'attachment': {'content': base64.b64encode(image_content()).decode()}})
    assert imported.status_code == 201
    d = imported.json()
    assert d['auto_fetch'] is False
    auto_fetch(w['owner'], d)
    assert request(w['verifier'], d, ['degree']).status_code == 409
    auto_fetch(w['owner'], w['doc'])
    req = request(w['verifier'], w['doc'], ['degree']).json()
    assert w['issuer'].post('/api/v1/issuer/documents/' + w['doc']['id'] + '/revoke',
        json={'reason': 'Auto fetch revocation test'}).status_code == 200
    assert w['verifier'].get('/api/v1/verification/requests/' + req['id'] + '/result').status_code == 409


def test_disable_and_disclosure_are_serialized(workflow):
    w = workflow
    auto_fetch(w['owner'], w['doc'])
    req = request(w['verifier'], w['doc'], ['degree']).json()
    url = '/api/v1/verification/requests/' + req['id'] + '/result'
    with ThreadPoolExecutor(2) as pool:
        fetch = pool.submit(w['verifier'].get, url)
        disable = pool.submit(auto_fetch, w['owner'], w['doc'], False)
        assert fetch.result().status_code in (200, 409)
        assert disable.result()['auto_fetch'] is False
    assert w['verifier'].get(url).status_code == 409
    with w['factory']() as db:
        events = list(db.scalars(select(AuditLog).where(AuditLog.credential_id == w['doc']['id']).order_by(AuditLog.id)))
        disabled = next(e.id for e in events if e.action == 'DOCUMENT_AUTO_FETCH_UPDATED' and e.outcome == 'DISABLED')
        assert all(e.id < disabled for e in events if e.action == 'DISCLOSURE')


def test_failed_audit_rolls_back_switch(workflow, monkeypatch):
    def fail(*args, **kwargs):
        raise RuntimeError('Injected audit failure')
    monkeypatch.setattr('app.routers.documents.audit', fail)
    response = workflow['owner'].patch('/api/v1/documents/' + workflow['doc']['id'] + '/auto-fetch',
        json={'auto_fetch': True})
    assert response.status_code == 500
    with workflow['factory']() as db:
        assert db.get(Credential, workflow['doc']['id']).auto_fetch is False
