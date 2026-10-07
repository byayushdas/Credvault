"""Explicit development-only idempotent fictional fixtures. Never resets data."""
import json
import secrets
from pathlib import Path
from sqlalchemy import select
from app.core.config import settings, ROOT
from app.core.files import write_private_text
from app.core.security import hash_password, future
from app.core.dependencies import Principal
from app.database.database import SessionLocal, lock_transaction
from app.models import *
from app.schemas.contracts import Issue
from app.services.document_service import issue
from app.services.signature_service import create_key
from app.services.consent_service import evaluate, finalize
from app.services.audit_service import audit

EMAILS = ['owner.a@demo.test','owner.b@demo.test','issuer@demo.test','verifier.a@demo.test','verifier.b@demo.test']

def seed(db, password):
    users=[]
    roles=['OWNER','OWNER','ISSUER','VERIFIER','VERIFIER']
    names=['Asha Demo','Rohan Demo','Demo Registrar','ABC Reviewer','XYZ Reviewer']
    orgnames=['Demo Academic Institute','ABC Technologies (Demo)','XYZ Verification (Demo)']
    for i,email in enumerate(EMAILS):
        user=db.scalar(select(User).where(User.email==email))
        if user:
            users.append(user)
            continue
        user=User(email=email,name=names[i],password_hash=hash_password(password))
        db.add(user);db.flush()
        org=None
        if i>=2:
            org=Organization(name=orgnames[i-2],kind=roles[i],approved=True,demo=True)
            db.add(org);db.flush()
        db.add(Membership(user_id=user.id,role=roles[i],organization_id=org.id if org else None));db.flush()
        if i==2:create_key(db,org.id)
        users.append(user)
    issuer=users[2];membership=db.get(Membership,issuer.id);org=db.get(Organization,membership.organization_id)
    p=Principal(issuer,'ISSUER',org,None)
    if not db.scalar(select(Credential).where(Credential.issuer_id==org.id)):
        issued=future(days=-1)
        records=[
            (users[0],'Demo Bachelor of Technology','DEGREE',{'degree':'B.Tech — fictional sample','universityId':'DEMO-UNI-001','cgpa':8.7,'rollNumber':'DEMO-ROLL-A'}),
            (users[0],'Demo Semester Marksheet','MARKSHEET',{'course':'Computer Science (Demo)','semester':6,'percentage':86.4,'rollNumber':'DEMO-ROLL-A'}),
            (users[0],'Demo Age Threshold','AGE',{'over18':True,'assessmentDate':issued[:10]}),
            (users[1],'Demo Bachelor of Science','DEGREE',{'degree':'B.Sc — fictional sample','universityId':'DEMO-UNI-002','cgpa':8.1,'rollNumber':'DEMO-ROLL-B'}),
            (users[0],'Demo Revoked Credential','DEGREE',{'degree':'Superseded sample','universityId':'DEMO-UNI-001','cgpa':7.5,'rollNumber':'DEMO-OLD-A'}),
        ]
        docs=[]
        for owner,title,kind,claims in records:
            docs.append(issue(db,p,Issue(owner_id=owner.id,title=title,type=kind,claims=claims,issued_at=issued,expires_at=future(days=180))))
        docs[-1].status='REVOKED';docs[-1].revoke_reason='Fictional revocation example'
        audit(db,issuer,'CREDENTIAL_REVOKED',users[0].id,docs[-1].id,outcome='REVOKED')
        verifier_org=db.get(Membership,users[3].id).organization_id
        for field,action in [('degree','AUTO_APPROVE'),('universityId','AUTO_APPROVE'),('cgpa','ASK'),('rollNumber','DENY')]:
            db.add(ConsentRule(owner_id=users[0].id,verifier_id=verifier_org,credential_id=docs[0].id,field=field,action=action))
        db.flush()
        for state in ['PENDING','APPROVED','DENIED','PARTIAL','EXPIRED','CANCELLED']:
            req=VerificationRequest(owner_id=users[0].id,verifier_id=verifier_org,actor_id=users[3].id,
                credential_id=docs[1].id,purpose='Fictional '+state.lower()+' verification example',
                expires_at=future(hours=-1 if state=='EXPIRED' else 72),idempotency_key='seed-'+state,fingerprint=state)
            db.add(req);db.flush()
            for i,field in enumerate(['course','percentage']):
                decision='PENDING' if state=='PENDING' else 'DENIED' if state=='DENIED' or (state=='PARTIAL' and i==1) else 'APPROVED'
                db.add(RequestField(request_id=req.id,field=field,decision=decision,method='MANUAL',rules=[]))
            req.status=state
            audit(db,users[3],'DEMO_REQUEST_CREATED',users[0].id,docs[1].id,req.id,['course','percentage'],outcome=state,method='DEMO_FIXTURE')
        db.add(Notification(user_id=users[0].id,message='A demonstration request is waiting for your decision.',link='/owner/requests'))
    db.commit()
    return users

def main():
    if settings.ENVIRONMENT!='development':raise RuntimeError('Demo seeding is allowed only in development')
    file=ROOT/'demo.credentials.json'
    if file.exists():credentials=json.loads(file.read_text())
    else:
        credentials={'password':secrets.token_urlsafe(20),'accounts':EMAILS}
        write_private_text(file, json.dumps(credentials,indent=2))
    with SessionLocal() as db:
        lock_transaction(db)
        seed(db,credentials['password'])
    print('Demo accounts ready. Read backend/demo.credentials.json locally for the password. Existing accounts/data were preserved.')
if __name__=='__main__':main()
