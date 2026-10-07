from ..models import Membership, Organization
from .signature_service import create_key
from .audit_service import audit

def approve_membership(db, user, role, organization):
    """Local administrator only; never expose this operation as public signup."""
    member = db.get(Membership, user.id)
    if member.role == 'OWNER':
        org = Organization(name=organization, kind=role, approved=True)
        db.add(org); db.flush()
        member.role, member.organization_id = role, org.id
    else:
        org = db.get(Organization, member.organization_id)
        if not org or org.approved or member.role != role or org.kind != role:
            raise ValueError('Membership already approved or requested role does not match. Refusing to replace it.')
        org.name, org.approved = organization, True
    if role == 'ISSUER':
        create_key(db, org.id)
    audit(db, user, 'MEMBERSHIP_APPROVED', method='LOCAL_ADMIN')
    return org
