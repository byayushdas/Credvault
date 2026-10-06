from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from ..models.verification_request import VerificationRequest, VerificationStatus
from ..schemas.verification import VerificationRequestCreate
from ..services.encryption_service import decrypt_fields

async def create_verification_request(db: AsyncSession, req: VerificationRequestCreate, verifier_id: int, owner_id: int, status: VerificationStatus, decision_reason: str = None):
    db_req = VerificationRequest(
        document_id=req.document_id,
        verifier_id=verifier_id,
        owner_id=owner_id,
        requested_fields=req.requested_fields,
        status=status,
        decision_reason=decision_reason
    )
    db.add(db_req)
    await db.commit()
    await db.refresh(db_req)
    return db_req

async def get_verification_request(db: AsyncSession, request_id: int):
    result = await db.execute(select(VerificationRequest).filter(VerificationRequest.id == request_id))
    return result.scalars().first()

async def update_verification_request_status(db: AsyncSession, request_id: int, status: VerificationStatus, decision_reason: str = None):
    req = await get_verification_request(db, request_id)
    if req:
        req.status = status
        if decision_reason:
            req.decision_reason = decision_reason
        await db.commit()
        await db.refresh(req)
    return req

def create_selective_disclosure(document, requested_fields: list[str], approved_fields: list[str]) -> dict:
    # Process ONLY approved fields.
    # Do NOT decrypt the entire document and then filter it.
    
    # 1. requested field -> authorization
    authorized_keys = [f for f in requested_fields if f in approved_fields]
    
    # 2. Extract strictly authorized fields without touching unrelated fields
    encrypted_fields = {f.field_name: f.field_value_encrypted for f in document.fields if f.field_name in authorized_keys}
    
    # 3. decrypt that field -> return claim
    disclosed_data = decrypt_fields(encrypted_fields)
    
    return disclosed_data
