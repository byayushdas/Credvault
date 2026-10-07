from datetime import datetime, timezone
from typing import Literal, Any
from pydantic import BaseModel, ConfigDict, Field, field_validator
from email_validator import validate_email
from ..core.config import settings

class Input(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)

class Login(Input):
    email: str = Field(max_length=254)
    password: str = Field(min_length=1, max_length=256)

    @field_validator('email')
    @classmethod
    def email_address(cls, value):
        return validate_email(value, check_deliverability=False, test_environment=settings.ENVIRONMENT == 'development').normalized

class Register(Login):
    name: str = Field(min_length=2, max_length=120)
    password: str = Field(min_length=1, max_length=128)

class OrganizationRegister(Register):
    role: Literal['ISSUER', 'VERIFIER']
    organization: str = Field(min_length=3, max_length=160)

class Email(Input):
    email: str = Field(max_length=254)

    @field_validator('email')
    @classmethod
    def email_address(cls, value):
        return Login.email_address(value)

class Reset(Input):
    token: str = Field(min_length=20, max_length=150)
    password: str = Field(min_length=1, max_length=128)

class Password(Input):
    current_password: str = Field(min_length=1, max_length=256)
    password: str = Field(min_length=1, max_length=128)

class Profile(Input):
    name: str = Field(min_length=2, max_length=120)
    timezone: str = Field(min_length=1, max_length=80)
    notifications: bool

class Attachment(Input):
    content: str = Field(max_length=14000000)

class Issue(Input):
    owner_id: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=3, max_length=160)
    type: Literal['GENERAL', 'EMPLOYMENT', 'HEALTHCARE', 'DEGREE', 'MARKSHEET', 'SEMESTER_MARKSHEET', 'AGE', 'AADHAAR_STYLE', 'PAN_STYLE', 'PASSPORT', 'DRIVING_LICENSE']
    claims: dict[str, Any]
    issued_at: str
    expires_at: str | None = None
    attachment: Attachment | None = None
    replaces_id: str | None = None
    draft_id: str | None = None

class IssueToVault(Input):
    vault_id: str = Field(min_length=39, max_length=39)
    title: str = Field(min_length=3, max_length=160)
    type: Literal['GENERAL', 'EMPLOYMENT', 'HEALTHCARE', 'DEGREE', 'MARKSHEET', 'SEMESTER_MARKSHEET', 'AGE', 'AADHAAR_STYLE', 'PAN_STYLE', 'PASSPORT', 'DRIVING_LICENSE']
    claims: dict[str, Any]
    issued_at: str
    expires_at: str | None = None
    attachment: Attachment | None = None
    replaces_id: str | None = None


class ImportDocument(Input):
    title: str = Field(min_length=3, max_length=160)
    attachment: Attachment

class Rule(Input):
    verifier_id: str | None = None
    credential_id: str | None = None
    credential_type: Literal['GENERAL', 'EMPLOYMENT', 'HEALTHCARE', 'DEGREE', 'MARKSHEET', 'SEMESTER_MARKSHEET', 'AGE', 'AADHAAR_STYLE', 'PAN_STYLE', 'PASSPORT', 'DRIVING_LICENSE'] | None = None
    field: str = Field(min_length=1, max_length=80)
    action: Literal['AUTO_APPROVE', 'ASK', 'DENY']
    enabled: bool = True
    expires_at: str | None = None

class RuleUpdate(Rule):
    version: int = Field(ge=1)

class NewRequest(Input):
    owner_id: str = Field(min_length=1, max_length=100)
    credential_id: str = Field(min_length=1, max_length=36)
    fields: list[str] = Field(min_length=1, max_length=20)
    purpose: str = Field(min_length=8, max_length=500)
    lifetime_hours: int = Field(ge=1, le=168)

class VerificationFromVault(Input):
    vault_id: str = Field(min_length=39, max_length=39)
    credential_type: Literal['GENERAL', 'EMPLOYMENT', 'HEALTHCARE', 'DEGREE', 'MARKSHEET', 'SEMESTER_MARKSHEET', 'AGE', 'AADHAAR_STYLE', 'PAN_STYLE', 'PASSPORT', 'DRIVING_LICENSE']
    fields: list[str] = Field(min_length=1, max_length=20)
    purpose: str = Field(min_length=8, max_length=500)
    lifetime_hours: int = Field(ge=1, le=168)
    share_token: str | None = Field(default=None, max_length=120)

class ShareTokenCreate(Input):
    expires_in_minutes: int = Field(ge=1, le=1440)
    verifier_id: str | None = Field(default=None)


class Decision(Input):
    revision: int = Field(ge=1)
    decisions: dict[str, Literal['APPROVED', 'DENIED']]

class Reason(Input):
    reason: str = Field(min_length=5, max_length=500)

class OrgUpdate(Input):
    name: str = Field(min_length=3, max_length=160)

def timestamp(value):
    try:
        dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat(timespec='microseconds')
    except (ValueError, AttributeError):
        from fastapi import HTTPException
        raise HTTPException(422, 'Use an ISO date or date/time')
