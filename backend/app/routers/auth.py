from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from ..schemas.auth import Token
from ..schemas.user import UserCreate, UserResponse
from ..services.auth_service import get_user_by_email, create_user
from ..core.security import verify_password, create_access_token
from ..database.database import get_db
from ..core.dependencies import get_current_active_user
from ..models.user import User
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])

@router.post("/login", response_model=Token, summary="Login", description="Authenticates a user via OAuth2 credentials (email and password) and returns a JWT Bearer token.\n\nAuth Required: None")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    user = await get_user_by_email(db, email=form_data.username)
    if not user or not verify_password(form_data.password, user.password_hash):
        logger.warning(f"Failed login attempt for user: {form_data.username}")
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    logger.info(f"Successful login for user: {user.email}")
    access_token = create_access_token(data={"sub": user.email})
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user": user
    }

@router.post("/register", response_model=UserResponse, summary="Register User", description="Registers a new user in the system.\n\nAuth Required: None")
async def register(user: UserCreate, db: AsyncSession = Depends(get_db)):
    db_user = await get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    return await create_user(db, user)

@router.get("/me", response_model=UserResponse, summary="Get Current User (Auth)", description="Fetches the profile of the currently authenticated user (Legacy path).\n\nAuth Required: Any JWT")
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    return current_user
