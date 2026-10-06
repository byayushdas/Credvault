import enum
import datetime
from sqlalchemy import Integer, String, Boolean, DateTime, Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database.database import Base

class IssuerType(str, enum.Enum):
    GOVERNMENT = "GOVERNMENT"
    EDUCATIONAL = "EDUCATIONAL"

class Issuer(Base):
    __tablename__ = "issuers"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String)
    issuer_type: Mapped[IssuerType] = mapped_column(Enum(IssuerType))
    public_key: Mapped[str] = mapped_column(String)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
    
    user = relationship("User")
