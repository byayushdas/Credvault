from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum
from .issuer import IssuerResponse

class DocumentCategory(str, Enum):
    GOVERNMENT = "GOVERNMENT"
    EDUCATION = "EDUCATION"

class DocumentType(str, Enum):
    AADHAAR_STYLE = "AADHAAR_STYLE"
    PAN_STYLE = "PAN_STYLE"
    PASSPORT = "PASSPORT"
    DRIVING_LICENSE = "DRIVING_LICENSE"
    DEGREE_CERTIFICATE = "DEGREE_CERTIFICATE"
    MARKSHEET = "MARKSHEET"

class DocumentIssue(BaseModel):
    owner_id: int
    name: str
    category: DocumentCategory
    document_type: DocumentType
    issued_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    fields: Dict[str, Any]

class DocumentResponse(BaseModel):
    id: int
    owner_id: int
    issuer_id: int
    name: str
    category: DocumentCategory
    document_type: DocumentType
    document_hash: str
    status: str
    issued_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None

class DocumentIssueResponse(BaseModel):
    id: int
    status: str
    issuer_verified: bool
    signature_valid: bool
    integrity_valid: bool

class IssuerBasicInfo(BaseModel):
    id: int
    name: str
    verified: bool

class VerificationInfo(BaseModel):
    signature_valid: bool
    integrity_valid: bool
    issuer_verified: bool

class DocumentDetailsResponse(BaseModel):
    id: int
    name: str
    category: str
    document_type: str
    issuer: IssuerBasicInfo
    status: str
    issued_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    verification: VerificationInfo
    fields: Dict[str, Any]
