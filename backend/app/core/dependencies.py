from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from .config import settings
from ..database.database import get_db
from ..models.user import User, UserRole
from ..schemas.auth import TokenData

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = TokenData(email=email)
    except JWTError:
        raise credentials_exception
        
    result = await db.execute(select(User).filter(User.email == token_data.email))
    user = result.scalars().first()
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

async def require_owner(current_user: User = Depends(get_current_active_user)) -> User:
    if current_user.role != UserRole.OWNER:
        raise HTTPException(status_code=403, detail="Operation requires OWNER role")
    return current_user

async def require_issuer(current_user: User = Depends(get_current_active_user)) -> User:
    if current_user.role != UserRole.ISSUER:
        raise HTTPException(status_code=403, detail="Operation requires ISSUER role")
    return current_user

async def require_verifier(current_user: User = Depends(get_current_active_user)) -> User:
    if current_user.role != UserRole.VERIFIER:
        raise HTTPException(status_code=403, detail="Operation requires VERIFIER role")
    return current_user
