import pytest
import pytest_asyncio
import os
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.database.database import Base, get_db

# Use an isolated test DB file
TEST_DB_URL = "sqlite+aiosqlite:///./test.db"
test_engine = create_async_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine, class_=AsyncSession)

async def override_get_db():
    async with TestingSessionLocal() as session:
        yield session

app.dependency_overrides[get_db] = override_get_db

@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    # Setup test DB
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Teardown
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

@pytest.mark.asyncio
async def test_full_workflow(client):
    # 1. Registration
    # Owner
    res = await client.post("/api/v1/auth/register", json={"name": "Owner", "email": "o@o.com", "password": "pwd", "role": "OWNER"})
    assert res.status_code == 200, res.text
    # Issuer
    res = await client.post("/api/v1/auth/register", json={"name": "Issuer", "email": "i@i.com", "password": "pwd", "role": "ISSUER"})
    assert res.status_code == 200
    # Verifier
    res = await client.post("/api/v1/auth/register", json={"name": "Verifier", "email": "v@v.com", "password": "pwd", "role": "VERIFIER"})
    assert res.status_code == 200
    
    # 2. Login & 3. JWT auth
    async def get_token(email):
        res = await client.post("/api/v1/auth/login", data={"username": email, "password": "pwd"})
        return res.json()["data"]["access_token"]
        
    owner_token = await get_token("o@o.com")
    issuer_token = await get_token("i@i.com")
    verifier_token = await get_token("v@v.com")

    # Fetch Owner ID
    res = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {owner_token}"})
    owner_id = res.json()["data"]["id"]
    
    # 4. Role Authorization (Owner trying to register issuer profile should fail)
    res = await client.post("/api/v1/issuers/", json={"name": "Fake", "issuer_type": "EDUCATIONAL", "public_key": "fake"}, headers={"Authorization": f"Bearer {owner_token}"})
    assert res.status_code == 403, "Role authorization failed"
    
    # Register Issuer profile properly
    with open("keys/issuer_public.pem", "r") as f:
        real_pub_key = f.read()
    res = await client.post("/api/v1/issuers/", json={"name": "Real", "issuer_type": "EDUCATIONAL", "public_key": real_pub_key}, headers={"Authorization": f"Bearer {issuer_token}"})
    assert res.status_code == 200
    
    # Manually verify issuer for the test
    from app.models.issuer import Issuer
    from sqlalchemy.future import select
    async with TestingSessionLocal() as session:
        result = await session.execute(select(Issuer).filter(Issuer.name == "Real"))
        test_issuer = result.scalars().first()
        test_issuer.verified = True
        await session.commit()
    
    
    # 5. Document creation & 6. Document encryption & 7. Signature generation & 8. Signature verification & 9. Hash verification
    doc_payload = {
        "owner_id": owner_id,
        "name": "Degree",
        "category": "EDUCATION",
        "document_type": "DEGREE_CERTIFICATE",
        "fields": {
            "name": "Ayush Das",
            "dob": "2000-01-01",
            "address": "123 Street",
            "degree": "B.Tech",
            "university": "XYZ University",
            "cgpa": "9.5"
        }
    }
    res = await client.post("/api/v1/issuer/documents", json=doc_payload, headers={"Authorization": f"Bearer {issuer_token}"})
    assert res.status_code == 200, res.text
    doc_id = res.json()["data"]["id"]
    assert res.json()["data"]["signature_valid"] is True
    assert res.json()["data"]["integrity_valid"] is True

    # 10, 11, 12. Consent AUTO_APPROVE, ASK, DENY
    res = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {verifier_token}"})
    verifier_id = res.json()["data"]["id"]

    # AUTO_APPROVE for degree and university
    await client.post("/api/v1/consent/rules/", json={"document_id": doc_id, "verifier_id": verifier_id, "field_name": "degree", "action": "AUTO_APPROVE"}, headers={"Authorization": f"Bearer {owner_token}"})
    await client.post("/api/v1/consent/rules/", json={"document_id": doc_id, "verifier_id": verifier_id, "field_name": "university", "action": "AUTO_APPROVE"}, headers={"Authorization": f"Bearer {owner_token}"})
    # DENY for cgpa
    await client.post("/api/v1/consent/rules/", json={"document_id": doc_id, "verifier_id": verifier_id, "field_name": "cgpa", "action": "DENY"}, headers={"Authorization": f"Bearer {owner_token}"})
    # ASK for name
    await client.post("/api/v1/consent/rules/", json={"document_id": doc_id, "verifier_id": verifier_id, "field_name": "name", "action": "ASK"}, headers={"Authorization": f"Bearer {owner_token}"})

    # Verifier requests AUTO_APPROVE fields only
    res = await client.post("/api/v1/verification/requests/", json={"owner_id": owner_id, "document_id": doc_id, "requested_fields": ["degree", "university"]}, headers={"Authorization": f"Bearer {verifier_token}"})
    assert res.json()["data"]["status"] == "APPROVED"
    req_id_auto = res.json()["data"]["request_id"]
    
    # Check Result (Selective Disclosure!)
    res = await client.get(f"/api/v1/verification/requests/{req_id_auto}/result", headers={"Authorization": f"Bearer {verifier_token}"})
    disclosed = res.json()["data"]["disclosed_fields"]
    
    # CRITICAL TEST: 13. Selective disclosure logic MUST NOT leak unrequested fields
    assert "degree" in disclosed
    assert "university" in disclosed
    assert "name" not in disclosed
    assert "dob" not in disclosed
    assert "address" not in disclosed
    assert "cgpa" not in disclosed
    assert res.json()["data"]["protected_field_count"] == 4

    # Verifier requests DENY field (cgpa)
    res = await client.post("/api/v1/verification/requests/", json={"owner_id": owner_id, "document_id": doc_id, "requested_fields": ["degree", "cgpa"]}, headers={"Authorization": f"Bearer {verifier_token}"})
    assert res.json()["data"]["status"] == "DENIED"

    # Verifier requests ASK field (name)
    res = await client.post("/api/v1/verification/requests/", json={"owner_id": owner_id, "document_id": doc_id, "requested_fields": ["name", "degree"]}, headers={"Authorization": f"Bearer {verifier_token}"})
    assert res.json()["data"]["status"] == "PENDING"
    req_id_ask = res.json()["data"]["request_id"]

    # Owner approves the ASK request
    res = await client.post(f"/api/v1/verification/requests/{req_id_ask}/approve", json="Looks good", headers={"Authorization": f"Bearer {owner_token}"})
    assert res.status_code == 200
    
    # 14. Audit creation check
    res = await client.get("/api/v1/audit/", headers={"Authorization": f"Bearer {owner_token}"})
    audit_logs = res.json()["data"]
    assert len(audit_logs) > 0
    actions = [log["action"] for log in audit_logs]
    assert "REQUEST_CREATED" in actions
    assert "AUTO_APPROVED" in actions
    assert "REQUEST_DENIED" in actions
    assert "USER_APPROVED" in actions

    # 15. Revoked document cannot be verified
    res = await client.post(f"/api/v1/issuer/documents/{doc_id}/revoke", headers={"Authorization": f"Bearer {issuer_token}"})
    assert res.status_code == 200

    res = await client.post("/api/v1/verification/requests/", json={"owner_id": owner_id, "document_id": doc_id, "requested_fields": ["degree"]}, headers={"Authorization": f"Bearer {verifier_token}"})
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "REVOKED_DOCUMENT"
