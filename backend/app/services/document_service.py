from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from ..models.document import Document
from ..models.document_field import DocumentField
from ..models.issuer import Issuer
from ..models.user import User, UserRole
from ..schemas.document import DocumentIssue
from ..services.signature_service import sign_data
from ..services.encryption_service import encrypt_value
from ..utils.hashing import calculate_integrity_hash

def infer_type(value) -> str:
    if isinstance(value, int): return "INTEGER"
    if isinstance(value, float): return "FLOAT"
    if isinstance(value, bool): return "BOOLEAN"
    return "STRING"

async def create_document(db: AsyncSession, document: DocumentIssue, user_issuer_id: int, file_path: str = None) -> tuple[Document, Issuer]:
    # Confirm issuer is verified
    result = await db.execute(select(Issuer).filter(Issuer.user_id == user_issuer_id))
    issuer = result.scalars().first()
    if not issuer:
        raise ValueError("User does not have an active issuer profile")
    if not issuer.verified:
        raise ValueError("Issuer profile is not verified")
        
    # Validate owner
    result = await db.execute(select(User).filter(User.id == document.owner_id))
    owner = result.scalars().first()
    if not owner or owner.role != UserRole.OWNER:
        raise ValueError("Owner ID does not correspond to a valid owner user")
        
    core_data = {
        "name": document.name,
        "document_type": document.document_type.value,
        "category": document.category.value,
        "owner_id": document.owner_id,
        "issuer_id": issuer.id
    }
    
    integrity_hash = calculate_integrity_hash(core_data, file_path)
    digital_signature = sign_data({"hash": integrity_hash})
    
    db_document = Document(
        name=document.name,
        document_type=document.document_type,
        category=document.category,
        issuer_id=issuer.id,
        owner_id=document.owner_id,
        file_path=file_path,
        document_hash=integrity_hash,
        signature=digital_signature,
        issued_date=document.issued_date,
        expiry_date=document.expiry_date
    )
    db.add(db_document)
    await db.flush() # flush to get document ID
    
    # create fields dynamically
    for field_name, val in document.fields.items():
        enc_val = encrypt_value(val)
        f_type = infer_type(val)
        db_field = DocumentField(
            document_id=db_document.id, 
            field_name=field_name, 
            field_value_encrypted=enc_val,
            field_type=f_type,
            is_sensitive=True
        )
        db.add(db_field)
        
    await db.commit()
    await db.refresh(db_document)
    await db.refresh(issuer)
    return db_document, issuer

async def get_document(db: AsyncSession, document_id: int):
    result = await db.execute(
        select(Document).options(selectinload(Document.fields), selectinload(Document.issuer)).filter(Document.id == document_id)
    )
    return result.scalars().first()
