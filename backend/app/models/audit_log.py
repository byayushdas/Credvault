import enum
import datetime
from typing import Optional
from sqlalchemy import Integer, String, ForeignKey, DateTime, JSON, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database.database import Base
from .user import UserRole

class AuditAction(str, enum.Enum):
    REQUEST_CREATED = "REQUEST_CREATED"
    AUTO_APPROVED = "AUTO_APPROVED"
    USER_APPROVED = "USER_APPROVED"
    USER_DENIED = "USER_DENIED"
    REQUEST_DENIED = "REQUEST_DENIED"
    SELECTIVE_DISCLOSURE = "SELECTIVE_DISCLOSURE"
    DOCUMENT_ISSUED = "DOCUMENT_ISSUED"
    DOCUMENT_REVOKED = "DOCUMENT_REVOKED"
    CONSENT_RULE_CREATED = "CONSENT_RULE_CREATED"

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    request_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("verification_requests.id"), nullable=True)
    actor_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    actor_role: Mapped[UserRole] = mapped_column(Enum(UserRole))
    action: Mapped[AuditAction] = mapped_column(Enum(AuditAction))
    document_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("documents.id"), nullable=True)
    fields_requested: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    fields_shared: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    decision: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    approval_method: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
