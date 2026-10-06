import enum
import datetime
from sqlalchemy import Integer, String, ForeignKey, DateTime, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database.database import Base

class ConsentAction(str, enum.Enum):
    AUTO_APPROVE = "AUTO_APPROVE"
    ASK = "ASK"
    DENY = "DENY"

class ConsentRule(Base):
    __tablename__ = "consent_rules"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    owner_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    verifier_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    document_id: Mapped[int] = mapped_column(Integer, ForeignKey("documents.id"))
    field_name: Mapped[str] = mapped_column(String)
    action: Mapped[ConsentAction] = mapped_column(Enum(ConsentAction))
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    owner = relationship("User", foreign_keys=[owner_id])
    verifier = relationship("User", foreign_keys=[verifier_id])
    document = relationship("Document")
