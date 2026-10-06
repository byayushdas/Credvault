from pydantic import BaseModel
from typing import Optional
from .user import UserResponse

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class TokenData(BaseModel):
    email: Optional[str] = None
