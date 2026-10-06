from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Optional, List
from datetime import datetime, timezone
from ..schemas.verification import VerificationRequestCreate, VerificationResponse, VerificationStatus
from ..schemas.audit import AuditLogResponse
from ..services.verification_service import create_verification_request, get_verification_request, update_verification_request_status, create_selective_disclosure
from ..services.consent_service import evaluate_request
from ..services.document_service import get_document
from ..services.signature_service import verify_signature
from ..services.audit_service import create_audit_event
from ..utils.hashing import calculate_integrity_hash
from ..core.dependencies import require_verifier, require_owner, get_current_active_user
from ..database.database import get_db
from ..models.user import User, UserRole
from ..models.audit_log import AuditAction, AuditLog
from ..models.verification_request import VerificationRequest
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/verification/requests", tags=["Verification"])
verifier_router = APIRouter(prefix="/api/v1/verifier", tags=["Verification"])

# Unified audit endpoint moved to audit.py

def generate_verification_response(document, requested_fields, approved_fields, request_id, status: VerificationStatus, decision_reason: str = None):
    disclosed_fields = None
    if status == VerificationStatus.APPROVED:
        disclosed_fields = create_selective_disclosure(document, requested_fields, approved_fields)
    
    disclosed_len = len(disclosed_fields) if disclosed_fields else 0
    protected_field_count = len(document.fields) - disclosed_len
            
    core_data = {
        "name": document.name,
        "document_type": document.document_type.value,
        "category": document.category.value,
        "owner_id": document.owner_id,
        "issuer_id": document.issuer_id
    }
    
    current_hash = calculate_integrity_hash(core_data, document.file_path)
    integrity_valid = current_hash == document.document_hash
    signature_valid = verify_signature({"hash": document.document_hash}, document.signature, document.issuer.public_key)
    issuer_verified = document.issuer.verified
    
    return {
        "request_id": request_id,
        "status": status,
        "decision_reason": decision_reason,
        "verification": {
            "issuer_verified": issuer_verified,
            "signature_valid": signature_valid,
            "integrity_valid": integrity_valid
        },
        "document": {
            "type": document.document_type.value,
            "issuer": document.issuer.name
        },
        "disclosed_fields": disclosed_fields,
        "protected_field_count": protected_field_count,
        "timestamp": datetime.now(timezone.utc)
    }

@router.get("/", summary="List Verification Requests", description="Lists all verification requests for the current Owner or Verifier.\n\nAuth Required: Any JWT")
async def list_verification_requests(
    current_user: User = Depends(get_current_active_user), 
    db: AsyncSession = Depends(get_db)
):
    if current_user.role == UserRole.OWNER:
        result = await db.execute(select(VerificationRequest).filter(VerificationRequest.owner_id == current_user.id))
        return result.scalars().all()
    elif current_user.role == UserRole.VERIFIER:
        result = await db.execute(select(VerificationRequest).filter(VerificationRequest.verifier_id == current_user.id))
        return result.scalars().all()
    else:
        return []

@router.get("/{request_id}", summary="Get Request Metadata", description="Fetches metadata about a specific verification request.\n\nAuth Required: Any JWT (Must be involved party)")
async def get_verification_request_info(
    request_id: int, 
    current_user: User = Depends(get_current_active_user), 
    db: AsyncSession = Depends(get_db)
):
    db_req = await get_verification_request(db, request_id)
    if not db_req: raise HTTPException(status_code=404, detail="Verification request not found")
    if current_user.role == UserRole.OWNER and db_req.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    if current_user.role == UserRole.VERIFIER and db_req.verifier_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return db_req

@router.get("/{request_id}/result", response_model=VerificationResponse, summary="Get Verification Result", description="Returns the selectively disclosed decrypted fields if the request was approved.\n\nAuth Required: VERIFIER JWT")
async def get_verification_result(
    request_id: int, 
    current_user: User = Depends(require_verifier), 
    db: AsyncSession = Depends(get_db)
):
    db_req = await get_verification_request(db, request_id)
    if not db_req or db_req.verifier_id != current_user.id: raise HTTPException(status_code=404, detail="Verification request not found")
    if db_req.status != VerificationStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Request is not approved")
        
    document = await get_document(db, db_req.document_id)
    return generate_verification_response(document, db_req.requested_fields, db_req.requested_fields, db_req.id, VerificationStatus.APPROVED, db_req.decision_reason)

@router.post("/", response_model=VerificationResponse, summary="Create Verification Request", description="Submits a new request for selective disclosure of document fields.\n\nAuth Required: VERIFIER JWT")
async def request_verification_api(
    req: VerificationRequestCreate, 
    current_user: User = Depends(require_verifier), 
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).filter(User.id == req.owner_id))
    owner = result.scalars().first()
    if not owner or owner.role != UserRole.OWNER:
        raise HTTPException(status_code=400, detail="Owner ID does not correspond to a valid owner user")

    document = await get_document(db, req.document_id)
    if not document: raise HTTPException(status_code=404, detail="Document not found")
        
    if document.status.value == "REVOKED":
        raise HTTPException(status_code=400, detail="Document has been revoked by the issuer")
        
    if document.owner_id != req.owner_id:
        raise HTTPException(status_code=403, detail="Document does not belong to the specified owner")
        
    if not document.issuer.verified:
        raise HTTPException(status_code=400, detail="Issuer profile is not verified")
        
    core_data = {
        "name": document.name,
        "document_type": document.document_type.value,
        "category": document.category.value,
        "owner_id": document.owner_id,
        "issuer_id": document.issuer_id
    }
    
    current_hash = calculate_integrity_hash(core_data, document.file_path)
    if current_hash != document.document_hash:
        raise HTTPException(status_code=400, detail="Document integrity validation failed")
        
    if not verify_signature({"hash": document.document_hash}, document.signature, document.issuer.public_key):
        raise HTTPException(status_code=400, detail="Document digital signature validation failed")

    doc_owner_id = document.owner_id
    doc_id = document.id
    doc_type = document.document_type.value
    doc_issuer = document.issuer.name
    doc_fields_count = len(document.fields)
    
    eval_result = await evaluate_request(db, doc_owner_id, current_user.id, doc_id, req.requested_fields)
    decision = eval_result["decision"]
    
    user_id = current_user.id
    user_role = current_user.role
    
    logger.info(f"Verification request created by Verifier {user_id} for Document {doc_id}")
    await create_audit_event(db, AuditAction.REQUEST_CREATED, actor_id=user_id, actor_role=user_role, document_id=doc_id, fields_requested=req.requested_fields)

    if decision == "DENIED":
        reason = "Requested information cannot be disclosed."
        db_req = await create_verification_request(db, req, user_id, doc_owner_id, status=VerificationStatus.DENIED, decision_reason=reason)
        req_id = db_req.id
        await create_audit_event(db, AuditAction.REQUEST_DENIED, actor_id=user_id, actor_role=user_role, request_id=req_id, document_id=doc_id, fields_requested=req.requested_fields, fields_shared=[], decision="DENIED", approval_method="AUTO")
        return {
            "request_id": req_id, 
            "status": VerificationStatus.DENIED, 
            "decision_reason": reason, 
            "verification": {"issuer_verified": True, "signature_valid": True, "integrity_valid": True},
            "document": {"type": doc_type, "issuer": doc_issuer},
            "disclosed_fields": None, 
            "protected_field_count": doc_fields_count, 
            "timestamp": datetime.now(timezone.utc)
        }

    if decision == "PENDING":
        db_req = await create_verification_request(db, req, user_id, doc_owner_id, status=VerificationStatus.PENDING)
        req_id = db_req.id
        return {
            "request_id": req_id, 
            "status": VerificationStatus.PENDING, 
            "verification": {"issuer_verified": True, "signature_valid": True, "integrity_valid": True},
            "document": {"type": doc_type, "issuer": doc_issuer},
            "disclosed_fields": None, 
            "protected_field_count": doc_fields_count, 
            "timestamp": datetime.now(timezone.utc)
        }

    db_req = await create_verification_request(db, req, user_id, doc_owner_id, status=VerificationStatus.APPROVED)
    req_id = db_req.id
    
    await create_audit_event(db, AuditAction.AUTO_APPROVED, actor_id=user_id, actor_role=user_role, request_id=req_id, document_id=doc_id, fields_requested=req.requested_fields, fields_shared=req.requested_fields, decision="APPROVED", approval_method="AUTO")
    await create_audit_event(db, AuditAction.SELECTIVE_DISCLOSURE, actor_id=user_id, actor_role=user_role, request_id=req_id, document_id=doc_id, fields_requested=req.requested_fields, fields_shared=req.requested_fields, decision="APPROVED", approval_method="AUTO")
    
    # We must fetch document cleanly again after all the commits above to generate response
    document = await get_document(db, doc_id)
    response = generate_verification_response(document, req.requested_fields, req.requested_fields, req_id, VerificationStatus.APPROVED)
    return response

@router.post("/{request_id}/approve", response_model=VerificationResponse, summary="Approve Request", description="Approves a PENDING verification request and grants access to requested fields.\n\nAuth Required: OWNER JWT")
async def approve_verification_request_api(
    request_id: int, 
    decision_reason: str = Body(None),
    current_user: User = Depends(require_owner), 
    db: AsyncSession = Depends(get_db)
):
    db_req = await get_verification_request(db, request_id)
    if not db_req: raise HTTPException(status_code=404, detail="Verification request not found")
    document = await get_document(db, db_req.document_id)
    if document.owner_id != current_user.id: raise HTTPException(status_code=403, detail="Forbidden")
        
    user_id = current_user.id
    user_role = current_user.role
    doc_id = document.id
    
    req_id = db_req.id
    requested_fields = db_req.requested_fields
    await update_verification_request_status(db, request_id, VerificationStatus.APPROVED, decision_reason)
    
    logger.info(f"Verification request {req_id} APPROVED by Owner {user_id}")
    await create_audit_event(db, AuditAction.USER_APPROVED, actor_id=user_id, actor_role=user_role, request_id=req_id, document_id=doc_id, fields_requested=requested_fields, fields_shared=requested_fields, decision="APPROVED", approval_method="MANUAL")
    await create_audit_event(db, AuditAction.SELECTIVE_DISCLOSURE, actor_id=user_id, actor_role=user_role, request_id=req_id, document_id=doc_id, fields_requested=requested_fields, fields_shared=requested_fields, decision="APPROVED", approval_method="MANUAL")
    
    document = await get_document(db, doc_id)
    response = generate_verification_response(document, requested_fields, requested_fields, req_id, VerificationStatus.APPROVED, decision_reason)
    return response

@router.post("/{request_id}/deny", response_model=VerificationResponse, summary="Deny Request", description="Denies a PENDING verification request.\n\nAuth Required: OWNER JWT")
async def deny_verification_request_api(
    request_id: int, 
    decision_reason: str = Body(None),
    current_user: User = Depends(require_owner), 
    db: AsyncSession = Depends(get_db)
):
    db_req = await get_verification_request(db, request_id)
    if not db_req: raise HTTPException(status_code=404, detail="Verification request not found")
    document = await get_document(db, db_req.document_id)
    if document.owner_id != current_user.id: raise HTTPException(status_code=403, detail="Forbidden")
        
    user_id = current_user.id
    user_role = current_user.role
    doc_id = document.id
    doc_type = document.document_type.value
    doc_issuer = document.issuer.name
    doc_fields_count = len(document.fields)
    req_id = db_req.id
    requested_fields = db_req.requested_fields
    
    await update_verification_request_status(db, request_id, VerificationStatus.DENIED, decision_reason)
    
    logger.info(f"Verification request {req_id} DENIED by Owner {user_id}")
    await create_audit_event(db, AuditAction.USER_DENIED, actor_id=user_id, actor_role=user_role, request_id=req_id, document_id=doc_id, fields_requested=requested_fields, fields_shared=[], decision="DENIED", approval_method="MANUAL")
    return {
        "request_id": req_id, 
        "status": VerificationStatus.DENIED, 
        "decision_reason": decision_reason, 
        "verification": {"issuer_verified": True, "signature_valid": True, "integrity_valid": True},
        "document": {"type": doc_type, "issuer": doc_issuer},
        "disclosed_fields": None, 
        "protected_field_count": doc_fields_count, 
        "timestamp": datetime.now(timezone.utc)
    }
