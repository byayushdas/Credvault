from pydantic import BaseModel, ConfigDict
from enum import Enum
from datetime import datetime

class ConsentAction(str, Enum):
    AUTO_APPROVE = "AUTO_APPROVE"
    ASK = "ASK"
    DENY = "DENY"

class ConsentRuleCreate(BaseModel):
    document_id: int
    verifier_id: int
    field_name: str
    action: ConsentAction

class ConsentRuleResponse(BaseModel):
    id: int
    owner_id: int
    verifier_id: int
    document_id: int
    field_name: str
    action: ConsentAction
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
