from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime

class VerificationStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    DENIED = "DENIED"

class VerificationRequestCreate(BaseModel):
    owner_id: int
    document_id: int
    requested_fields: List[str]

class VerificationDetails(BaseModel):
    issuer_verified: bool
    signature_valid: bool
    integrity_valid: bool

class DocumentDetails(BaseModel):
    type: str
    issuer: str

class VerificationResponse(BaseModel):
    request_id: int
    status: VerificationStatus
    decision_reason: Optional[str] = None
    verification: VerificationDetails
    document: DocumentDetails
    disclosed_fields: Optional[Dict[str, Any]] = None
    protected_field_count: Optional[int] = 0
    timestamp: datetime
