from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import RefreshToken, User


class UserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_email(self, email: str) -> User | None:
        return await self.db.scalar(select(User).where(User.email == email.lower()))

    async def get(self, user_id) -> User | None:
        return await self.db.get(User, user_id)

    async def get_by_id_str(self, user_id_str: str) -> User | None:
        import uuid
        try:
            uid = uuid.UUID(user_id_str)
        except ValueError:
            return None
        return await self.db.get(User, uid)

    async def create(self, user: User) -> User:
        self.db.add(user)
        await self.db.flush()
        return user


class RefreshTokenRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, token: RefreshToken) -> RefreshToken:
        self.db.add(token)
        await self.db.flush()
        return token

    async def get_by_hash(self, token_hash: str) -> RefreshToken | None:
        return await self.db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
