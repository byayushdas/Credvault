import secrets
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Response, Request
from sqlalchemy import select, delete
from sqlalchemy.orm import Session as DBSession
from ..database.database import get_db
from ..models import User, Membership, Organization, Session, ResetToken, now
from ..schemas.contracts import Login, Register, OrganizationRegister, Email, Reset, Password
from ..core.security import digest, hash_password, verify_password, DUMMY_HASH, future
from ..core.dependencies import current, browser, Principal, user_view
from ..core.config import settings
from ..core.files import write_private_text
from ..services.audit_service import audit

router = APIRouter(prefix='/api/v1/auth', tags=['Authentication'])

@router.post('/register', status_code=201)
def register(data: Register, db: DBSession = Depends(get_db)):
    email = str(data.email).lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(409, 'Email is already registered')
    user = User(email=email, name=data.name, password_hash=hash_password(data.password))
    db.add(user)
    db.flush()
    db.add(Membership(user_id=user.id, role='OWNER'))
    audit(db, user, 'ACCOUNT_REGISTERED', owner_id=user.id)
    db.commit()
    return {'message': 'Owner account created. Sign in to continue.'}

@router.post('/register-organization', status_code=201)
def register_organization(data: OrganizationRegister, db: DBSession = Depends(get_db)):
    email = data.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(409, 'Email is already registered. Use a separate account for this organisation.')
    user = User(email=email, name=data.name, password_hash=hash_password(data.password))
    org = Organization(name=data.organization, kind=data.role, approved=False)
    db.add_all([user, org]); db.flush()
    db.add(Membership(user_id=user.id, role=data.role, organization_id=org.id))
    audit(db, user, 'ORGANIZATION_REGISTRATION_REQUESTED', outcome='PENDING_APPROVAL')
    db.commit()
    return {'role': data.role, 'status': 'PENDING_APPROVAL',
        'message': data.role.title() + ' account created. Your organisation is awaiting administrator approval. Sign in after approval.'}

@router.post('/login')
def login(data: Login, response: Response, request: Request, db: DBSession = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == str(data.email).lower()))
    valid = verify_password(data.password, user.password_hash if user else DUMMY_HASH)
    if not user or not valid or not user.active:
        raise HTTPException(401, 'Incorrect email or password')
    membership = db.get(Membership, user.id)
    if membership and membership.role != 'OWNER':
        org = db.get(Organization, membership.organization_id)
        if not org or not org.approved:
            raise HTTPException(403, 'Your ' + membership.role.lower() + ' organisation is awaiting administrator approval. Your account has been created; sign in after approval.')
    old = request.cookies.get('cv_session')
    if old:
        db.execute(delete(Session).where(Session.token_hash == digest(old)))
    raw, csrf = secrets.token_urlsafe(48), secrets.token_urlsafe(32)
    s = Session(token_hash=digest(raw), user_id=user.id, csrf=csrf, expires_at=future(hours=settings.SESSION_HOURS))
    db.add(s)
    db.commit()
    response.set_cookie('cv_session', raw, httponly=True, secure=settings.SECURE_COOKIES, samesite='lax', path='/', max_age=settings.SESSION_HOURS*3600)
    return {'message': 'Signed in', 'csrf': csrf}

@router.get('/me')
def me(p: Principal = Depends(browser)):
    return user_view(p)

@router.post('/logout')
def logout(response: Response, p: Principal = Depends(browser), db: DBSession = Depends(get_db)):
    # Invalidate all browser sessions; other tabs/devices cannot restore access.
    db.execute(delete(Session).where(Session.user_id == p.user.id))
    audit(db, p.user, 'LOGOUT', owner_id=p.user.id if p.role == 'OWNER' else None)
    db.commit()
    response.delete_cookie('cv_session', path='/', secure=settings.SECURE_COOKIES, httponly=True, samesite='lax')
    return {'message': 'Signed out'}

@router.post('/forgot-password')
def forgot(data: Email, db: DBSession = Depends(get_db)):
    if settings.ENVIRONMENT != 'development':
        raise HTTPException(503, 'Password reset mail delivery has not been configured')
    user = db.scalar(select(User).where(User.email == str(data.email).lower(), User.active.is_(True)))
    if user:
        token = secrets.token_urlsafe(40)
        db.execute(delete(ResetToken).where(ResetToken.user_id == user.id))
        db.add(ResetToken(token_hash=digest(token), user_id=user.id, expires_at=future(minutes=30)))
        folder = Path(settings.MAILBOX_PATH)
        mail = folder / (secrets.token_hex(12) + '.txt')
        write_private_text(mail,
            'Development mail sink ONLY\nTo: ' + user.email + '\nReset link (30 minutes): ' + settings.APP_ORIGIN + '/reset?token=' + token)
        db.info.setdefault('file_rollbacks', []).append(lambda: mail.unlink(missing_ok=True))
    db.commit()
    db.info.pop('file_rollbacks', None)
    return {'message': 'If this account exists, a reset link was saved in the local development mail sink. No email was sent.'}

@router.post('/reset-password')
def reset(data: Reset, db: DBSession = Depends(get_db)):
    record = db.get(ResetToken, digest(data.token))
    if not record or record.used or record.expires_at <= now():
        raise HTTPException(400, 'Reset link is invalid, expired or already used')
    user = db.get(User, record.user_id)
    user.password_hash = hash_password(data.password)
    record.used = True
    db.execute(delete(Session).where(Session.user_id == user.id))
    audit(db, user, 'PASSWORD_RESET')
    db.commit()
    return {'message': 'Password updated. Sign in with your new password.'}

@router.post('/change-password')
def change(data: Password, response: Response, p: Principal = Depends(browser), db: DBSession = Depends(get_db)):
    if not verify_password(data.current_password, p.user.password_hash):
        raise HTTPException(400, 'Current password is incorrect')
    p.user.password_hash = hash_password(data.password)
    db.execute(delete(Session).where(Session.user_id == p.user.id))
    audit(db, p.user, 'PASSWORD_CHANGED')
    db.commit()
    response.delete_cookie('cv_session', path='/')
    return {'message': 'Password changed. Sign in again.'}
