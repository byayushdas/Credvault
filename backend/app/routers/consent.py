from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from ..schemas.consent import ConsentRuleCreate, ConsentRuleResponse, ConsentAction
from ..services.consent_service import create_consent_rule
from ..core.dependencies import require_owner
from ..database.database import get_db
from ..models.user import User
from ..models.consent_rule import ConsentRule
from ..services.audit_service import create_audit_event
from ..models.audit_log import AuditAction

router = APIRouter(prefix="/api/v1/consent/rules", tags=["Consent"])

@router.post("/", response_model=ConsentRuleResponse, summary="Create Consent Rule", description="Creates a new consent rule (AUTO_APPROVE, ASK, DENY) for a specific document, verifier, and field.\n\nAuth Required: OWNER JWT")
async def create_consent_rule_api(
    rule: ConsentRuleCreate, 
    current_user: User = Depends(require_owner), 
    db: AsyncSession = Depends(get_db)
):
    db_rule = await create_consent_rule(db, rule, current_user.id)
    return db_rule

@router.get("/", response_model=List[ConsentRuleResponse], summary="List Consent Rules", description="Returns all consent rules configured by the current owner. Can filter by document_id.\n\nAuth Required: OWNER JWT")
async def list_consent_rules_api(
    document_id: Optional[int] = None,
    current_user: User = Depends(require_owner), 
    db: AsyncSession = Depends(get_db)
):
    query = select(ConsentRule).filter(ConsentRule.owner_id == current_user.id)
    if document_id:
        query = query.filter(ConsentRule.document_id == document_id)
    result = await db.execute(query)
    return result.scalars().all()

@router.put("/{rule_id}", response_model=ConsentRuleResponse, summary="Update Consent Rule", description="Updates the action (AUTO_APPROVE, ASK, DENY) of an existing consent rule.\n\nAuth Required: OWNER JWT")
async def update_consent_rule_api(
    rule_id: int,
    action: ConsentAction,
    current_user: User = Depends(require_owner), 
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(ConsentRule).filter(ConsentRule.id == rule_id))
    db_rule = result.scalars().first()
    if not db_rule or db_rule.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Consent rule not found")
        
    db_rule.action = action
    await db.commit()
    await db.refresh(db_rule)
    return db_rule

@router.delete("/{rule_id}", summary="Delete Consent Rule", description="Deletes an existing consent rule.\n\nAuth Required: OWNER JWT")
async def delete_consent_rule_api(
    rule_id: int,
    current_user: User = Depends(require_owner), 
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(ConsentRule).filter(ConsentRule.id == rule_id))
    db_rule = result.scalars().first()
    if not db_rule or db_rule.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Consent rule not found")
        
    await db.delete(db_rule)
    await db.commit()
    return {"message": "Rule deleted"}
