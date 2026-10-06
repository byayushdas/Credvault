from pydantic import BaseModel, ConfigDict
from enum import Enum
from datetime import datetime

class IssuerType(str, Enum):
    GOVERNMENT = "GOVERNMENT"
    EDUCATIONAL = "EDUCATIONAL"

class IssuerCreate(BaseModel):
    name: str
    issuer_type: IssuerType
    public_key: str

class IssuerResponse(BaseModel):
    id: int
    user_id: int
    name: str
    issuer_type: IssuerType
    public_key: str
    verified: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
