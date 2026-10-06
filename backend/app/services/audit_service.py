from sqlalchemy.ext.asyncio import AsyncSession
from ..models.audit_log import AuditLog, AuditAction
from ..models.user import UserRole

async def create_audit_event(
    db: AsyncSession, 
    action: AuditAction, 
    actor_id: int, 
    actor_role: UserRole,
    request_id: int = None,
    document_id: int = None, 
    fields_requested: list = None,
    fields_shared: list = None,
    decision: str = None,
    approval_method: str = None
):
    db_log = AuditLog(
        action=action,
        actor_id=actor_id,
        actor_role=actor_role,
        request_id=request_id,
        document_id=document_id,
        fields_requested=fields_requested,
        fields_shared=fields_shared,
        decision=decision,
        approval_method=approval_method
    )
    db.add(db_log)
    await db.commit()
    await db.refresh(db_log)
    return db_log
