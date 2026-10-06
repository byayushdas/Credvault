from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
import json
from ..schemas.document import DocumentIssue, DocumentResponse, DocumentIssueResponse, DocumentDetailsResponse
from ..services.document_service import create_document, get_document
from ..services.audit_service import create_audit_event
from ..services.encryption_service import decrypt_fields
from ..utils.file_storage import save_upload_file
from ..utils.file_validator import validate_and_generate_filename
from ..core.dependencies import get_current_active_user, require_issuer, require_owner
from ..database.database import get_db
from ..models.user import User, UserRole
from ..models.audit_log import AuditAction
from ..models.document import Document, DocumentStatus
from ..models.issuer import Issuer
from ..services.signature_service import verify_signature
from ..utils.hashing import calculate_integrity_hash
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/documents", tags=["Documents"])
issuer_doc_router = APIRouter(prefix="/api/v1/issuer", tags=["Documents"])

@issuer_doc_router.get("/documents", response_model=List[DocumentResponse], summary="List Issued Documents", description="Returns a list of all documents issued by the current issuer.\n\nAuth Required: ISSUER JWT")
async def get_issuer_documents(
    current_user: User = Depends(require_issuer),
    db: AsyncSession = Depends(get_db)
):
    issuer_res = await db.execute(select(Issuer).filter(Issuer.user_id == current_user.id))
    issuer = issuer_res.scalars().first()
    if not issuer: return []
    result = await db.execute(select(Document).filter(Document.issuer_id == issuer.id))
    return result.scalars().all()

@issuer_doc_router.post("/documents", response_model=DocumentIssueResponse, summary="Issue Document (JSON)", description="Cryptographically issues a new document with JSON fields.\n\nAuth Required: ISSUER JWT")
async def issue_document_api(
    document: DocumentIssue, 
    current_user: User = Depends(require_issuer), 
    db: AsyncSession = Depends(get_db)
):
    user_id = current_user.id
    user_role = current_user.role
    try:
        db_document, issuer = await create_document(db, document, user_id)
        
        core_data = {
            "name": db_document.name,
            "document_type": db_document.document_type.value,
            "category": db_document.category.value,
            "owner_id": db_document.owner_id,
            "issuer_id": db_document.issuer_id
        }
        current_hash = calculate_integrity_hash(core_data, None)
        integrity_valid = current_hash == db_document.document_hash
        signature_valid = verify_signature({"hash": db_document.document_hash}, db_document.signature, issuer.public_key)
        
        
        doc_id = db_document.id
        issuer_name = issuer.name
        
        response_data = {
            "id": db_document.id,
            "status": db_document.status.value,
            "issuer_verified": issuer.verified,
            "signature_valid": signature_valid,
            "integrity_valid": integrity_valid
        }
        await create_audit_event(db, AuditAction.DOCUMENT_ISSUED, actor_id=user_id, actor_role=user_role, document_id=response_data["id"])
        
        logger.info(f"Document issued successfully: ID {doc_id} by Issuer {issuer_name}")
        return response_data
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@issuer_doc_router.post("/documents/{document_id}/revoke", summary="Revoke Document", description="Revokes a document previously issued by the current issuer.\n\nAuth Required: ISSUER JWT")
async def revoke_document_api(
    document_id: int, 
    current_user: User = Depends(require_issuer), 
    db: AsyncSession = Depends(get_db)
):
    user_id = current_user.id
    user_role = current_user.role
    document = await get_document(db, document_id)
    if not document: raise HTTPException(status_code=404)
    
    issuer_res = await db.execute(select(Issuer).filter(Issuer.user_id == user_id))
    issuer = issuer_res.scalars().first()
    if not issuer or document.issuer_id != issuer.id:
        raise HTTPException(status_code=403, detail="Can only revoke documents you issued")
        
    doc_id = document.id
    document.status = DocumentStatus.REVOKED
    await db.commit()
    await create_audit_event(db, AuditAction.DOCUMENT_REVOKED, actor_id=user_id, actor_role=user_role, document_id=doc_id)
    return {"document_revoked": True}

@router.post("/upload", response_model=DocumentIssueResponse, summary="Issue Document (File Upload)", description="Issues a document accompanied by a physical file (e.g. PDF). File is AES encrypted natively.\n\nAuth Required: ISSUER JWT")
async def upload_document_api(
    document_json: str = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(require_issuer), 
    db: AsyncSession = Depends(get_db)
):
    user_id = current_user.id
    user_role = current_user.role
    try:
        document = DocumentIssue(**json.loads(document_json))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
        
    unique_filename = await validate_and_generate_filename(file)
    file_path = save_upload_file(file, f"storage/encrypted/{unique_filename}")
    
    try:
        db_document, issuer = await create_document(db, document, user_id, file_path)
        
        core_data = {
            "name": db_document.name,
            "document_type": db_document.document_type.value,
            "category": db_document.category.value,
            "owner_id": db_document.owner_id,
            "issuer_id": db_document.issuer_id
        }
        current_hash = calculate_integrity_hash(core_data, file_path)
        integrity_valid = current_hash == db_document.document_hash
        signature_valid = verify_signature({"hash": db_document.document_hash}, db_document.signature, issuer.public_key)
        
        doc_id = db_document.id
        issuer_name = issuer.name
        
        response_data = {
            "id": db_document.id,
            "status": db_document.status.value,
            "issuer_verified": issuer.verified,
            "signature_valid": signature_valid,
            "integrity_valid": integrity_valid
        }
        await create_audit_event(db, AuditAction.DOCUMENT_ISSUED, actor_id=user_id, actor_role=user_role, document_id=response_data["id"])
        
        logger.info(f"Document with file issued successfully: ID {doc_id} by Issuer {issuer_name}")
        return response_data
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/", response_model=List[DocumentResponse], summary="List My Documents", description="Retrieve all documents owned by the current user.\n\nAuth Required: OWNER JWT")
async def list_documents_api(
    current_user: User = Depends(require_owner), 
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Document).filter(Document.owner_id == current_user.id))
    return result.scalars().all()

@router.get("/{document_id}", response_model=DocumentDetailsResponse, summary="Get Document Details", description="Retrieves the fully decrypted metadata fields for a specific document owned by the user.\n\nAuth Required: OWNER JWT")
async def get_document_details_api(
    document_id: int, 
    current_user: User = Depends(require_owner), 
    db: AsyncSession = Depends(get_db)
):
    document = await get_document(db, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
        
    if document.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden: You do not own this document")
        
    encrypted_fields = {f.field_name: f.field_value_encrypted for f in document.fields}
    decrypted_fields = decrypt_fields(encrypted_fields)
    
    core_data = {
        "name": document.name,
        "document_type": document.document_type.value,
        "category": document.category.value,
        "owner_id": document.owner_id,
        "issuer_id": document.issuer_id
    }
    
    # We need to calculate integrity and signature status
    current_hash = calculate_integrity_hash(core_data, None)
    integrity_valid = current_hash == document.document_hash
    signature_valid = verify_signature({"hash": document.document_hash}, document.signature, document.issuer.public_key)
    
    return {
        "id": document.id,
        "name": document.name,
        "category": document.category.value,
        "document_type": document.document_type.value,
        "issuer": {
            "id": document.issuer.id,
            "name": document.issuer.name,
            "verified": document.issuer.verified
        },
        "status": document.status.value,
        "issued_date": document.issued_date,
        "expiry_date": document.expiry_date,
        "verification": {
            "signature_valid": signature_valid,
            "integrity_valid": integrity_valid,
            "issuer_verified": document.issuer.verified
        },
        "fields": decrypted_fields
    }
