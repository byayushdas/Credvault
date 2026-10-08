"""Versioned model: prototype tables are preserved by an additive migration."""
from datetime import datetime, timezone
import uuid
from sqlalchemy import String, Text, Boolean, Integer, ForeignKey, JSON, UniqueConstraint, CheckConstraint, false
from sqlalchemy.orm import Mapped, mapped_column
from ..database.database import Base

def now():
    return datetime.now(timezone.utc).isoformat(timespec='microseconds')

def uid():
    return str(uuid.uuid4())

class Organization(Base):
    __tablename__ = 'cv_organizations'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    name: Mapped[str] = mapped_column(String(160))
    kind: Mapped[str] = mapped_column(String(20))
    approved: Mapped[bool] = mapped_column(Boolean, default=False)
    demo: Mapped[bool] = mapped_column(Boolean, default=False)

class User(Base):
    __tablename__ = 'cv_users'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    vault_id: Mapped[str | None] = mapped_column(String(64), unique=True, index=True, nullable=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(Text)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    timezone: Mapped[str] = mapped_column(String(80), default='Asia/Kolkata')
    notifications: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[str] = mapped_column(String(40), default=now)

class Membership(Base):
    __tablename__ = 'cv_memberships'
    user_id: Mapped[str] = mapped_column(ForeignKey('cv_users.id'), primary_key=True)
    role: Mapped[str] = mapped_column(String(20), default='OWNER')
    organization_id: Mapped[str | None] = mapped_column(ForeignKey('cv_organizations.id'), index=True)
    __table_args__ = (CheckConstraint("role IN ('OWNER','ISSUER','VERIFIER')"),)

class Session(Base):
    __tablename__ = 'cv_sessions'
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey('cv_users.id'), index=True)
    csrf: Mapped[str] = mapped_column(String(80))
    expires_at: Mapped[str] = mapped_column(String(40), index=True)

class ResetToken(Base):
    __tablename__ = 'cv_password_resets'
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey('cv_users.id'))
    expires_at: Mapped[str] = mapped_column(String(40))
    used: Mapped[bool] = mapped_column(Boolean, default=False)

class IssuerKey(Base):
    __tablename__ = 'cv_issuer_keys'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey('cv_organizations.id'), index=True)
    public_key: Mapped[str] = mapped_column(Text)
    private_encrypted: Mapped[str] = mapped_column(Text)
    valid_from: Mapped[str] = mapped_column(String(40), default=now)
    valid_until: Mapped[str | None] = mapped_column(String(40))
    revoked_at: Mapped[str | None] = mapped_column(String(40))

class Credential(Base):
    __tablename__ = 'cv_credentials'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    owner_id: Mapped[str] = mapped_column(ForeignKey('cv_users.id'), index=True)
    issuer_id: Mapped[str | None] = mapped_column(ForeignKey('cv_organizations.id'), index=True)
    key_id: Mapped[str | None] = mapped_column(ForeignKey('cv_issuer_keys.id'))
    title: Mapped[str] = mapped_column(String(160))
    type: Mapped[str] = mapped_column(String(40))
    category: Mapped[str] = mapped_column(String(40))
    issued_at: Mapped[str] = mapped_column(String(40))
    expires_at: Mapped[str | None] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(24), default='VALID', index=True)
    auto_fetch: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    version: Mapped[int] = mapped_column(Integer, default=1)
    replaces_id: Mapped[str | None] = mapped_column(ForeignKey('cv_credentials.id'))
    claims_encrypted: Mapped[str] = mapped_column(Text)
    signature: Mapped[str | None] = mapped_column(Text)
    file_name: Mapped[str | None] = mapped_column(String(80))
    file_type: Mapped[str | None] = mapped_column(String(80))
    file_hash: Mapped[str | None] = mapped_column(String(64))
    revoke_reason: Mapped[str | None] = mapped_column(String(500))
    assessment_date: Mapped[str | None] = mapped_column(String(40))
    proof_version: Mapped[int] = mapped_column(Integer, default=2)
    created_at: Mapped[str] = mapped_column(String(40), default=now)

class Draft(Base):
    __tablename__ = 'cv_drafts'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    issuer_id: Mapped[str] = mapped_column(ForeignKey('cv_organizations.id'), index=True)
    payload_encrypted: Mapped[str] = mapped_column(Text)
    updated_at: Mapped[str] = mapped_column(String(40), default=now)

class ConsentRule(Base):
    __tablename__ = 'cv_rules'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    owner_id: Mapped[str] = mapped_column(ForeignKey('cv_users.id'), index=True)
    verifier_id: Mapped[str | None] = mapped_column(ForeignKey('cv_organizations.id'))
    credential_id: Mapped[str | None] = mapped_column(ForeignKey('cv_credentials.id'))
    credential_type: Mapped[str | None] = mapped_column(String(40))
    field: Mapped[str] = mapped_column(String(80))
    action: Mapped[str] = mapped_column(String(20))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    expires_at: Mapped[str | None] = mapped_column(String(40))
    version: Mapped[int] = mapped_column(Integer, default=1)
    updated_at: Mapped[str] = mapped_column(String(40), default=now)
    __table_args__ = (CheckConstraint("action IN ('AUTO_APPROVE','ASK','DENY')"),)

class ShareToken(Base):
    __tablename__ = 'cv_share_tokens'
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey('cv_users.id'), index=True)
    vault_id: Mapped[str] = mapped_column(String(39))
    verifier_id: Mapped[str | None] = mapped_column(ForeignKey('cv_organizations.id'))
    created_at: Mapped[str] = mapped_column(String(40), default=now)
    expires_at: Mapped[str] = mapped_column(String(40))
    consumed: Mapped[bool] = mapped_column(Boolean, default=False)


class VerificationRequest(Base):
    __tablename__ = 'cv_requests'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    owner_id: Mapped[str] = mapped_column(ForeignKey('cv_users.id'), index=True)
    verifier_id: Mapped[str] = mapped_column(ForeignKey('cv_organizations.id'), index=True)
    actor_id: Mapped[str] = mapped_column(ForeignKey('cv_users.id'))
    credential_id: Mapped[str] = mapped_column(ForeignKey('cv_credentials.id'), index=True)
    purpose: Mapped[str] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(24), default='PENDING', index=True)
    expires_at: Mapped[str] = mapped_column(String(40))
    created_at: Mapped[str] = mapped_column(String(40), default=now)
    revision: Mapped[int] = mapped_column(Integer, default=1)
    idempotency_key: Mapped[str] = mapped_column(String(80))
    fingerprint: Mapped[str] = mapped_column(String(64))
    __table_args__ = (UniqueConstraint('verifier_id', 'idempotency_key'),)

class RequestField(Base):
    __tablename__ = 'cv_request_fields'
    request_id: Mapped[str] = mapped_column(ForeignKey('cv_requests.id'), primary_key=True)
    field: Mapped[str] = mapped_column(String(80), primary_key=True)
    decision: Mapped[str] = mapped_column(String(20))
    method: Mapped[str] = mapped_column(String(20))
    rules: Mapped[list] = mapped_column(JSON, default=list)
    decided_at: Mapped[str] = mapped_column(String(40), default=now)

class DecisionHistory(Base):
    __tablename__ = 'cv_decision_history'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    request_id: Mapped[str] = mapped_column(ForeignKey('cv_requests.id'), index=True)
    field: Mapped[str] = mapped_column(String(80))
    decision: Mapped[str] = mapped_column(String(20))
    method: Mapped[str] = mapped_column(String(20))
    rules: Mapped[list] = mapped_column(JSON)
    created_at: Mapped[str] = mapped_column(String(40), default=now)

class Notification(Base):
    __tablename__ = 'cv_notifications'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey('cv_users.id'), index=True)
    message: Mapped[str] = mapped_column(String(300))
    link: Mapped[str] = mapped_column(String(200))
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[str] = mapped_column(String(40), default=now)

class AuditLog(Base):
    __tablename__ = 'cv_audit'
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_id: Mapped[str] = mapped_column(String(36), unique=True, default=uid)
    created_at: Mapped[str] = mapped_column(String(40), default=now)
    actor_id: Mapped[str] = mapped_column(ForeignKey('cv_users.id'))
    organization_id: Mapped[str | None] = mapped_column(ForeignKey('cv_organizations.id'))
    owner_id: Mapped[str | None] = mapped_column(ForeignKey('cv_users.id'), index=True)
    credential_id: Mapped[str | None] = mapped_column(ForeignKey('cv_credentials.id'))
    request_id: Mapped[str | None] = mapped_column(ForeignKey('cv_requests.id'))
    action: Mapped[str] = mapped_column(String(60))
    requested: Mapped[list] = mapped_column(JSON, default=list)
    shared: Mapped[list] = mapped_column(JSON, default=list)
    outcome: Mapped[str] = mapped_column(String(60))
    method: Mapped[str] = mapped_column(String(60))
    previous_hash: Mapped[str] = mapped_column(String(64))
    hash: Mapped[str] = mapped_column(String(64))

class OAuthClient(Base):
    __tablename__ = 'cv_oauth_clients'
    id: Mapped[str] = mapped_column(String(80), primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey('cv_organizations.id'), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey('cv_users.id'))
    secret_hash: Mapped[str] = mapped_column(Text)
    name: Mapped[str] = mapped_column(String(120))
    scopes: Mapped[str] = mapped_column(String(160), default='requests:read requests:write results:read')
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)

class OAuthToken(Base):
    __tablename__ = 'cv_oauth_tokens'
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    client_id: Mapped[str] = mapped_column(ForeignKey('cv_oauth_clients.id'), index=True)
    scopes: Mapped[str] = mapped_column(String(160))
    expires_at: Mapped[str] = mapped_column(String(40))

class Idempotency(Base):
    __tablename__ = 'cv_idempotency'
    scope: Mapped[str] = mapped_column(String(100), primary_key=True)
    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    fingerprint: Mapped[str] = mapped_column(String(64))
    result_id: Mapped[str] = mapped_column(ForeignKey('cv_credentials.id'))

class LiveRevision(Base):
    __tablename__ = 'cv_live_revisions'
    user_id: Mapped[str] = mapped_column(ForeignKey('cv_users.id'), primary_key=True)
    revision: Mapped[int] = mapped_column(Integer, default=0)
