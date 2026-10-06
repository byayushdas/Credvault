from app.services.verification_service import create_selective_disclosure
from app.services.encryption_service import encrypt_fields
from typing import Any

class MockField:
    def __init__(self, name: str, encrypted_val: str):
        self.field_name = name
        self.field_value_encrypted = encrypted_val

class MockDocument:
    def __init__(self, raw_fields: dict[str, Any]):
        encrypted = encrypt_fields(raw_fields)
        self.fields = [MockField(k, v) for k, v in encrypted.items()]

def test_selective_disclosure_does_not_leak_fields():
    # Given document fields
    raw_fields = {
        "name": "Ayush Das",
        "dob": "15/04/2003",
        "address": "Kolkata",
        "degree": "B.Tech",
        "university": "XYZ University",
        "cgpa": "8.7"
    }
    
    document = MockDocument(raw_fields)
    
    # Request
    requested_fields = [
        "degree",
        "university"
    ]
    
    # Assuming these fields are approved
    approved_fields = requested_fields.copy()
    
    # Run the disclosure engine
    response = create_selective_disclosure(document, requested_fields, approved_fields)
    
    # Response must contain
    assert "degree" in response
    assert response["degree"] == "B.Tech"
    assert "university" in response
    assert response["university"] == "XYZ University"
    
    # Response must NOT contain
    assert "name" not in response
    assert "dob" not in response
    assert "address" not in response
    assert "cgpa" not in response

    print("Privacy test passed: Selective disclosure successfully prevented field leakage.")
