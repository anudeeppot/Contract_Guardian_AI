"""
FastAPI dependency injection (CO3).
Provides: current_user, require_role, rate limiting, db session.
"""
from fastapi import Depends, Header, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db.models import User
from app.db.session import get_db
from app.repositories.users import UserRepository


async def current_user(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract and validate JWT, return current User. CO3: JWT authentication."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.split(" ", 1)[1]
    payload = decode_access_token(token)
    user = await UserRepository(db).get_by_id_str(payload["sub"])
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


def require_role(*roles: str):
    """
    Role-based access control dependency factory.
    CO3: RBAC - restrict endpoint to specific roles.
    Usage: Depends(require_role("ADMIN", "ANALYST"))
    """
    async def _check(user: User = Depends(current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied. Required roles: {', '.join(roles)}"
            )
        return user
    return _check


async def admin_user(user: User = Depends(require_role("ADMIN"))) -> User:
    """Shortcut: ADMIN only."""
    return user


async def analyst_user(user: User = Depends(require_role("ADMIN", "ANALYST"))) -> User:
    """Shortcut: ADMIN or ANALYST."""
    return user
