from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from ..models.user import User
from ..schemas.user import UserCreate
from ..core.security import get_password_hash

async def get_user_by_email(db: AsyncSession, email: str):
    result = await db.execute(select(User).filter(User.email == email))
    return result.scalars().first()

async def create_user(db: AsyncSession, user: UserCreate):
    hashed_password = get_password_hash(user.password)
    db_user = User(
        name=user.name,
        email=user.email,
        role=user.role, 
        password_hash=hashed_password
    )
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    return db_user
