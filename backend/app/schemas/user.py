from pydantic import BaseModel, ConfigDict
from enum import Enum
from datetime import datetime

class UserRole(str, Enum):
    OWNER = "OWNER"
    ISSUER = "ISSUER"
    VERIFIER = "VERIFIER"

class UserBase(BaseModel):
    name: str
    email: str
    role: UserRole

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
