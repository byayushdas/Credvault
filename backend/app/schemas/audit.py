from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime
from ..models.audit_log import AuditAction
from ..models.user import UserRole

class AuditLogResponse(BaseModel):
    id: int
    request_id: Optional[int]
    actor_id: int
    actor_role: UserRole
    action: AuditAction
    document_id: Optional[int]
    fields_requested: Optional[List[str]]
    fields_shared: Optional[List[str]]
    decision: Optional[str]
    approval_method: Optional[str]
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
