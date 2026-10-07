import argparse
import json
import secrets
from pathlib import Path
from sqlalchemy import select, func
from app.database.database import SessionLocal, lock_transaction
from app.models import User, Membership, Organization, OAuthClient, IssuerKey, now
from app.core.security import hash_password
from app.core.files import write_private_text
from app.services.signature_service import create_key
from app.services.audit_service import check_chain, audit
from app.services.onboarding_service import approve_membership

parser=argparse.ArgumentParser(description='Local administrator; protect database and configuration access.')
parser.add_argument('command',choices=['audit','approve','client','rotate-key','revoke-key'])
parser.add_argument('--email');parser.add_argument('--role',choices=['ISSUER','VERIFIER']);parser.add_argument('--organization')
parser.add_argument('--key-id');parser.add_argument('--output')
args=parser.parse_args()
with SessionLocal() as db:
    lock_transaction(db)
    if args.command=='audit':print(json.dumps(check_chain(db),indent=2))
    else:
        user=db.scalar(select(User).where(func.lower(User.email)==(args.email or '').strip().lower()))
        if not user:raise SystemExit('Register the account first, then provide its exact --email.')
        member=db.get(Membership,user.id)
        if args.command=='approve':
            if not args.role or not args.organization:raise SystemExit('--role and --organization are required.')
            try:approve_membership(db,user,args.role,args.organization)
            except ValueError as exc:raise SystemExit(str(exc))
        elif args.command=='client':
            if member.role!='VERIFIER' or not args.output:raise SystemExit('Approved verifier and --output private-file.json required.')
            secret=secrets.token_urlsafe(48)
            c=OAuthClient(user_id=user.id,organization_id=member.organization_id,name='Local integration',secret_hash=hash_password(secret))
            db.add(c);db.flush()
            write_private_text(Path(args.output), json.dumps({'client_id':c.id,'client_secret':secret},indent=2))
            audit(db,user,'API_CLIENT_CREATED',method='LOCAL_ADMIN')
        else:
            if member.role!='ISSUER':raise SystemExit('Approved issuer account required.')
            if args.command=='rotate-key':
                for key in db.scalars(select(IssuerKey).where(IssuerKey.organization_id==member.organization_id,IssuerKey.valid_until.is_(None))):key.valid_until=now()
                create_key(db,member.organization_id)
            else:
                key=db.get(IssuerKey,args.key_id)
                if not key or key.organization_id!=member.organization_id:raise SystemExit('Key not found in issuer organisation.')
                key.revoked_at=now()
            audit(db,user,args.command.upper().replace('-','_'),method='LOCAL_ADMIN')
    db.commit()
