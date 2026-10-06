import enum
import datetime
from sqlalchemy import Integer, String, Boolean, DateTime, Enum
from sqlalchemy.orm import Mapped, mapped_column
from ..database.database import Base

class UserRole(str, enum.Enum):
    OWNER = "OWNER"
    ISSUER = "ISSUER"
    VERIFIER = "VERIFIER"

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.OWNER)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
