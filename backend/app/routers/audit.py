from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from ..schemas.audit import AuditLogResponse
from ..core.dependencies import require_owner
from ..database.database import get_db
from ..models.user import User
from ..models.audit_log import AuditLog

router = APIRouter(prefix="/api/v1/audit", tags=["Audit"])
from ..models.document import Document
from sqlalchemy import or_

from ..core.dependencies import get_current_active_user
from ..models.user import UserRole
from ..models.issuer import Issuer

@router.get("/", response_model=List[AuditLogResponse], summary="List Audit Logs", description="Returns append-only audit events tied to the current user (role-based filter).\n\nAuth Required: Any JWT")
async def get_audit_logs(
    current_user: User = Depends(get_current_active_user), 
    db: AsyncSession = Depends(get_db)
):
    if current_user.role == UserRole.OWNER:
        # Owner sees actions they performed + actions on their documents
        doc_result = await db.execute(select(Document.id).filter(Document.owner_id == current_user.id))
        owner_doc_ids = doc_result.scalars().all()
        query = select(AuditLog).filter(
            or_(
                AuditLog.actor_id == current_user.id,
                AuditLog.document_id.in_(owner_doc_ids) if owner_doc_ids else False
            )
        ).order_by(AuditLog.created_at.desc())
        
    elif current_user.role == UserRole.VERIFIER:
        # Verifier sees only their own requests
        query = select(AuditLog).filter(AuditLog.actor_id == current_user.id).order_by(AuditLog.created_at.desc())
        
    elif current_user.role == UserRole.ISSUER:
        # Issuer sees actions they performed + actions on documents they issued
        issuer_res = await db.execute(select(Issuer.id).filter(Issuer.user_id == current_user.id))
        issuer_id = issuer_res.scalars().first()
        if not issuer_id: return []
        
        doc_result = await db.execute(select(Document.id).filter(Document.issuer_id == issuer_id))
        issuer_doc_ids = doc_result.scalars().all()
        
        query = select(AuditLog).filter(
            or_(
                AuditLog.actor_id == current_user.id,
                AuditLog.document_id.in_(issuer_doc_ids) if issuer_doc_ids else False
            )
        ).order_by(AuditLog.created_at.desc())
        
    else:
        return []
        
    result = await db.execute(query)
    return result.scalars().all()
