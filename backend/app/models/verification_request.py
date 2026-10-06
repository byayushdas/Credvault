import enum
import datetime
from typing import Optional
from sqlalchemy import Integer, String, ForeignKey, DateTime, JSON, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database.database import Base

class VerificationStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    DENIED = "DENIED"

class VerificationRequest(Base):
    __tablename__ = "verification_requests"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    verifier_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    owner_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    document_id: Mapped[int] = mapped_column(Integer, ForeignKey("documents.id"))
    requested_fields: Mapped[list] = mapped_column(JSON)
    status: Mapped[VerificationStatus] = mapped_column(Enum(VerificationStatus), default=VerificationStatus.PENDING)
    decision_reason: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    verifier = relationship("User", foreign_keys=[verifier_id])
    owner = relationship("User", foreign_keys=[owner_id])
    document = relationship("Document")
