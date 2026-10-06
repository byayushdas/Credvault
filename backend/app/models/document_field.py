import datetime
from sqlalchemy import Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database.database import Base

class DocumentField(Base):
    __tablename__ = "document_fields"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    document_id: Mapped[int] = mapped_column(Integer, ForeignKey("documents.id"))
    field_name: Mapped[str] = mapped_column(String)
    field_value_encrypted: Mapped[str] = mapped_column(String)
    field_type: Mapped[str] = mapped_column(String, default="STRING")
    is_sensitive: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
    
    document = relationship("Document", back_populates="fields")
