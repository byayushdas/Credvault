from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from ..models.consent_rule import ConsentRule
from ..schemas.consent import ConsentRuleCreate

async def create_consent_rule(db: AsyncSession, rule: ConsentRuleCreate, owner_id: int):
    result = await db.execute(
        select(ConsentRule).filter(
            ConsentRule.document_id == rule.document_id,
            ConsentRule.verifier_id == rule.verifier_id,
            ConsentRule.field_name == rule.field_name
        )
    )
    existing_rule = result.scalars().first()
    
    if existing_rule:
        existing_rule.action = rule.action
        await db.commit()
        await db.refresh(existing_rule)
        return existing_rule

    db_rule = ConsentRule(
        owner_id=owner_id,
        document_id=rule.document_id,
        verifier_id=rule.verifier_id,
        field_name=rule.field_name,
        action=rule.action
    )
    db.add(db_rule)
    await db.commit()
    await db.refresh(db_rule)
    return db_rule

async def get_active_consent_rules(db: AsyncSession, document_id: int, verifier_id: int):
    result = await db.execute(
        select(ConsentRule).filter(
            ConsentRule.document_id == document_id,
            ConsentRule.verifier_id == verifier_id
        )
    )
    return result.scalars().all()

async def evaluate_request(
    db: AsyncSession,
    owner_id: int,
    verifier_id: int,
    document_id: int,
    requested_fields: list[str]
) -> dict:
    rules = await get_active_consent_rules(db, document_id, verifier_id)
    rule_map = {r.field_name: r.action.value for r in rules}
    
    approved_fields = []
    ask_fields = []
    denied_fields = []
    
    for field in requested_fields:
        action = rule_map.get(field)
        if action == "AUTO_APPROVE":
            approved_fields.append(field)
        elif action == "DENY":
            denied_fields.append(field)
        else:
            # Default behavior is ASK
            ask_fields.append(field)
            
    if denied_fields:
        decision = "DENIED"
    elif ask_fields:
        decision = "PENDING"
    else:
        decision = "AUTO_APPROVE"
        
    return {
        "decision": decision,
        "approved_fields": approved_fields,
        "ask_fields": ask_fields,
        "denied_fields": denied_fields
    }
