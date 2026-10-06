from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from ..schemas.issuer import IssuerResponse, IssuerCreate
from ..core.dependencies import require_issuer
from ..database.database import get_db
from ..models.user import User
from ..models.issuer import Issuer

router = APIRouter(prefix="/api/v1/issuers", tags=["Issuers"])
issuer_router = APIRouter(prefix="/api/v1/issuer", tags=["Issuers"])

@router.get("/", response_model=List[IssuerResponse], summary="List Issuers", description="Retrieve a list of all registered issuers in the network.\n\nAuth Required: None")
async def list_issuers_api(
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Issuer))
    return result.scalars().all()

@router.post("/", response_model=IssuerResponse, summary="Register Issuer", description="Registers an issuer profile for the currently authenticated user.\n\nAuth Required: ISSUER JWT")
async def register_issuer_api(
    req: IssuerCreate,
    current_user: User = Depends(require_issuer),
    db: AsyncSession = Depends(get_db)
):
    existing = await db.execute(select(Issuer).filter(Issuer.user_id == current_user.id))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Issuer profile already exists")
        
    db_issuer = Issuer(
        user_id=current_user.id,
        name=req.name,
        issuer_type=req.issuer_type,
        public_key=req.public_key,
        verified=False
    )
    db.add(db_issuer)
    await db.commit()
    await db.refresh(db_issuer)
    return db_issuer

@router.get("/me", response_model=IssuerResponse, summary="Get My Issuer Profile", description="Returns the issuer profile for the current user.\n\nAuth Required: ISSUER JWT")
async def get_my_issuer_profile(
    current_user: User = Depends(require_issuer),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Issuer).filter(Issuer.user_id == current_user.id))
    issuer = result.scalars().first()
    if not issuer:
        raise HTTPException(status_code=404, detail="Issuer profile not found")
    return issuer

@router.get("/{issuer_id}", response_model=IssuerResponse, summary="Get Issuer Details", description="Retrieve details about a specific issuer by ID.\n\nAuth Required: None")
async def get_issuer_api(
    issuer_id: int, 
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Issuer).filter(Issuer.id == issuer_id))
    issuer = result.scalars().first()
    if not issuer:
        raise HTTPException(status_code=404, detail="Issuer not found")
    return issuer
