from datetime import timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import bad_request, unauthorized
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    sha256,
    utcnow,
    verify_password,
)
from app.db.models import RefreshToken, User
from app.repositories.users import RefreshTokenRepository, UserRepository


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.users = UserRepository(db)
        self.refresh_tokens = RefreshTokenRepository(db)

    async def signup(self, email: str, password: str, full_name: str | None):
        existing = await self.users.get_by_email(email)
        if existing:
            raise bad_request("EMAIL_ALREADY_REGISTERED", "Email is already registered")
        user = await self.users.create(
            User(email=email.lower(), password_hash=hash_password(password), full_name=full_name)
        )
        refresh = await self._issue_refresh_token(user)
        await self.db.commit()
        return user, create_access_token(user.id, user.role), refresh

    async def login(self, email: str, password: str):
        user = await self.users.get_by_email(email)
        if not user or not verify_password(password, user.password_hash):
            raise unauthorized("Invalid email or password")
        if not user.is_active:
            raise unauthorized("User account is disabled")
        refresh = await self._issue_refresh_token(user)
        await self.db.commit()
        return user, create_access_token(user.id, user.role), refresh

    async def refresh(self, refresh_token: str):
        token = await self.refresh_tokens.get_by_hash(sha256(refresh_token))
        now = utcnow()
        if not token or token.revoked_at:
            raise unauthorized("Invalid refresh token")
        # Handle both timezone-aware and naive datetimes (SQLite returns naive)
        expires = token.expires_at
        if expires.tzinfo is None:
            from datetime import timezone
            expires = expires.replace(tzinfo=timezone.utc)
        if expires <= now:
            raise unauthorized("Invalid refresh token")
        user = await self.users.get(token.user_id)
        if not user or not user.is_active:
            raise unauthorized("Invalid refresh token")
        token.revoked_at = now
        new_refresh = await self._issue_refresh_token(user)
        await self.db.commit()
        return user, create_access_token(user.id, user.role), new_refresh

    async def _issue_refresh_token(self, user: User) -> str:
        from app.core.config import settings

        raw = create_refresh_token()
        expires_at = utcnow() + timedelta(days=settings.refresh_token_expire_days)
        await self.refresh_tokens.create(
            RefreshToken(user_id=user.id, token_hash=sha256(raw), expires_at=expires_at)
        )
        return raw
