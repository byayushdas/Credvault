import enum
import datetime
from typing import Optional
from sqlalchemy import Integer, String, ForeignKey, DateTime, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database.database import Base

class DocumentCategory(str, enum.Enum):
    GOVERNMENT = "GOVERNMENT"
    EDUCATION = "EDUCATION"

class DocumentType(str, enum.Enum):
    AADHAAR_STYLE = "AADHAAR_STYLE"
    PAN_STYLE = "PAN_STYLE"
    PASSPORT = "PASSPORT"
    DRIVING_LICENSE = "DRIVING_LICENSE"
    DEGREE_CERTIFICATE = "DEGREE_CERTIFICATE"
    MARKSHEET = "MARKSHEET"

class DocumentStatus(str, enum.Enum):
    VERIFIED = "VERIFIED"
    PENDING = "PENDING"
    REVOKED = "REVOKED"

class Document(Base):
    __tablename__ = "documents"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    owner_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    issuer_id: Mapped[int] = mapped_column(Integer, ForeignKey("issuers.id"))
    name: Mapped[str] = mapped_column(String)
    category: Mapped[DocumentCategory] = mapped_column(Enum(DocumentCategory))
    document_type: Mapped[DocumentType] = mapped_column(Enum(DocumentType))
    file_path: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    document_hash: Mapped[str] = mapped_column(String)
    signature: Mapped[str] = mapped_column(String)
    issued_date: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
    expiry_date: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime, nullable=True)
    status: Mapped[DocumentStatus] = mapped_column(Enum(DocumentStatus), default=DocumentStatus.PENDING)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    owner = relationship("User", foreign_keys=[owner_id])
    issuer = relationship("Issuer", foreign_keys=[issuer_id])
    
    # Relationship to dynamic fields
    fields = relationship("DocumentField", back_populates="document", cascade="all, delete-orphan")
