from fastapi import APIRouter, Depends
from ..schemas.user import UserResponse
from ..core.dependencies import get_current_active_user
from ..models.user import User

router = APIRouter(prefix="/api/v1/users", tags=["Authentication"])

@router.get("/me", response_model=UserResponse, summary="Get Current User", description="Fetches the profile of the currently authenticated user.\n\nAuth Required: Any JWT")
async def get_users_me(current_user: User = Depends(get_current_active_user)):
    return current_user
