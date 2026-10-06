import asyncio
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.database.database import SessionLocal, Base, engine
from app.schemas.user import UserCreate, UserRole
from app.schemas.issuer import IssuerType
from app.schemas.document import DocumentIssue, DocumentCategory, DocumentType
from app.models.issuer import Issuer
from app.models.user import User
from app.models.document import Document
from app.services.auth_service import create_user, get_user_by_email
from app.services.signature_service import ensure_keys_exist
from app.services.document_service import create_document
from app.services.consent_service import create_consent_rule
from app.schemas.consent import ConsentRuleCreate, ConsentAction
from app.core.config import settings

async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    async with SessionLocal() as db:
        # Check if already seeded
        owner = await get_user_by_email(db, "owner@credvault.local")
        if owner:
            print("Database already seeded.")
            return

        print("Seeding Users...")
        owner_user = await create_user(db, UserCreate(name="Ayush Das", email="owner@credvault.local", role=UserRole.OWNER, password="Demo@123"))
        owner_id = owner_user.id
        uni_issuer_user = await create_user(db, UserCreate(name="XYZ University - Demo", email="issuer@credvault.local", role=UserRole.ISSUER, password="Demo@123"))
        uni_issuer_id = uni_issuer_user.id
        gov_issuer_user = await create_user(db, UserCreate(name="Government Authority - Demo", email="gov@credvault.local", role=UserRole.ISSUER, password="Demo@123"))
        gov_issuer_id = gov_issuer_user.id
        verifier_user = await create_user(db, UserCreate(name="ABC Technologies - Demo", email="verifier@credvault.local", role=UserRole.VERIFIER, password="Demo@123"))
        verifier_id = verifier_user.id
        
        print("Seeding Issuers...")
        ensure_keys_exist()
        with open(settings.PUBLIC_KEY_PATH, "r") as f:
            pub_key = f.read()

        uni_issuer = Issuer(user_id=uni_issuer_id, name="XYZ University - Demo", issuer_type=IssuerType.EDUCATIONAL, public_key=pub_key, verified=True)
        gov_issuer = Issuer(user_id=gov_issuer_id, name="Government Authority - Demo", issuer_type=IssuerType.GOVERNMENT, public_key=pub_key, verified=True)
        db.add_all([uni_issuer, gov_issuer])
        await db.commit()
        await db.refresh(uni_issuer)
        await db.refresh(gov_issuer)

        print("Seeding Documents...")
        
        # 1. Aadhaar
        aadhaar = DocumentIssue(
            owner_id=owner_id,
            name="Aadhaar Card",
            category=DocumentCategory.GOVERNMENT,
            document_type=DocumentType.AADHAAR_STYLE,
            fields={"name": "Ayush Das", "dob": "2000-01-01", "gender": "Male", "address": "123 Secure St, India", "document_number": "111122223333"}
        )
        db_aadhaar, _ = await create_document(db, aadhaar, gov_issuer_id)
        
        # 2. PAN
        pan = DocumentIssue(
            owner_id=owner_id,
            name="PAN Card",
            category=DocumentCategory.GOVERNMENT,
            document_type=DocumentType.PAN_STYLE,
            fields={"name": "Ayush Das", "dob": "2000-01-01", "pan_number": "ABCDE1234F"}
        )
        db_pan, _ = await create_document(db, pan, gov_issuer_id)
        
        # 3. Passport
        passport = DocumentIssue(
            owner_id=owner_id,
            name="Passport",
            category=DocumentCategory.GOVERNMENT,
            document_type=DocumentType.PASSPORT,
            fields={"name": "Ayush Das", "nationality": "Indian", "dob": "2000-01-01", "passport_number": "Z1234567", "expiry_date": "2036-01-01", "address": "123 Secure St, India"}
        )
        db_passport, _ = await create_document(db, passport, gov_issuer_id)
        passport_id = db_passport.id
        
        # 4. Driving Licence
        dl = DocumentIssue(
            owner_id=owner_id,
            name="Driving Licence",
            category=DocumentCategory.GOVERNMENT,
            document_type=DocumentType.DRIVING_LICENSE,
            fields={"name": "Ayush Das", "dob": "2000-01-01", "licence_number": "DL-123456", "vehicle_class": "LMV", "valid_until": "2040-01-01"}
        )
        db_dl, _ = await create_document(db, dl, gov_issuer_id)
        
        # 5. B.Tech Degree Certificate
        degree = DocumentIssue(
            owner_id=owner_id,
            name="Degree Certificate",
            category=DocumentCategory.EDUCATION,
            document_type=DocumentType.DEGREE_CERTIFICATE,
            fields={"name": "Ayush Das", "degree": "B.Tech", "university": "XYZ University", "cgpa": "8.7", "roll_number": "2026CS001", "issue_year": "2024"}
        )
        db_degree, _ = await create_document(db, degree, uni_issuer_id)
        degree_id = db_degree.id
        
        # 6. Marksheet
        marksheet = DocumentIssue(
            owner_id=owner_id,
            name="Final Marksheet",
            category=DocumentCategory.EDUCATION,
            document_type=DocumentType.MARKSHEET,
            fields={"name": "Ayush Das", "university": "XYZ University - Demo", "course": "Computer Science", "semester": "8", "subject": "Distributed Systems", "marks": "95", "cgpa": "9.5", "year": "2024"}
        )
        db_marksheet, _ = await create_document(db, marksheet, uni_issuer_id)

        print("Seeding Consent Rules...")
        
        # Degree Rules for ABC Technologies
        await create_consent_rule(db, ConsentRuleCreate(document_id=degree_id, verifier_id=verifier_id, field_name="degree", action=ConsentAction.AUTO_APPROVE), owner_id)
        await create_consent_rule(db, ConsentRuleCreate(document_id=degree_id, verifier_id=verifier_id, field_name="university", action=ConsentAction.AUTO_APPROVE), owner_id)
        await create_consent_rule(db, ConsentRuleCreate(document_id=degree_id, verifier_id=verifier_id, field_name="cgpa", action=ConsentAction.ASK), owner_id)
        await create_consent_rule(db, ConsentRuleCreate(document_id=degree_id, verifier_id=verifier_id, field_name="roll_number", action=ConsentAction.DENY), owner_id)

        # Passport Rules for ABC Technologies
        await create_consent_rule(db, ConsentRuleCreate(document_id=passport_id, verifier_id=verifier_id, field_name="nationality", action=ConsentAction.AUTO_APPROVE), owner_id)
        await create_consent_rule(db, ConsentRuleCreate(document_id=passport_id, verifier_id=verifier_id, field_name="dob", action=ConsentAction.ASK), owner_id)
        await create_consent_rule(db, ConsentRuleCreate(document_id=passport_id, verifier_id=verifier_id, field_name="passport_number", action=ConsentAction.DENY), owner_id)

        print("Database seeding completed perfectly!")

if __name__ == "__main__":
    asyncio.run(seed())
