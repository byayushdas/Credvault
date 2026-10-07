"""Cursors are committed with the mutation; no private values enter SSE payloads."""
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from ..models import LiveRevision, Membership, Credential, VerificationRequest

def changed(db, users):
    for user_id in sorted(set(u for u in users if u)):
        statement = insert(LiveRevision).values(user_id=user_id, revision=1)
        db.execute(statement.on_conflict_do_update(index_elements=['user_id'],
            set_={'revision': LiveRevision.revision + 1}))

def audit_changed(db, event):
    users = {event.actor_id, event.owner_id}
    orgs = {event.organization_id}
    if event.credential_id:
        credential = db.get(Credential, event.credential_id)
        if credential:
            orgs.add(credential.issuer_id)
    if event.request_id:
        request = db.get(VerificationRequest, event.request_id)
        if request:
            orgs.add(request.verifier_id)
    elif event.credential_id or (event.owner_id and event.action.startswith('CONSENT_RULE_')):
        query = select(VerificationRequest.verifier_id)
        query = query.where(VerificationRequest.credential_id == event.credential_id) if event.credential_id else query.where(VerificationRequest.owner_id == event.owner_id)
        orgs.update(db.scalars(query))
    orgs.discard(None)
    if orgs:
        users.update(db.scalars(select(Membership.user_id).where(Membership.organization_id.in_(orgs))))
    changed(db, users)

import asyncio
from collections import defaultdict
from typing import Dict, List, Any

# In-memory queue per user for live events
sse_queues: Dict[str, List[asyncio.Queue]] = defaultdict(list)

def dispatch_sse(user_id: str, event_name: str, payload: Any):
    for q in sse_queues.get(user_id, []):
        try:
            q.put_nowait((event_name, payload))
        except asyncio.QueueFull:
            pass
