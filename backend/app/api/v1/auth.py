from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import current_user
from app.db.models import User
from app.db.session import get_db
from app.schemas.auth import LoginRequest, RefreshRequest, SignupRequest, TokenResponse, UserResponse
from app.services.auth import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])


def user_response(user: User) -> UserResponse:
    return UserResponse(id=str(user.id), email=user.email, full_name=user.full_name, role=user.role)


@router.post("/signup", response_model=TokenResponse)
async def signup(payload: SignupRequest, db: AsyncSession = Depends(get_db)):
    user, access, refresh = await AuthService(db).signup(
        payload.email, payload.password, payload.full_name
    )
    return TokenResponse(access_token=access, refresh_token=refresh, user=user_response(user))


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    user, access, refresh = await AuthService(db).login(payload.email, payload.password)
    return TokenResponse(access_token=access, refresh_token=refresh, user=user_response(user))


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    user, access, refresh_token = await AuthService(db).refresh(payload.refresh_token)
    return TokenResponse(access_token=access, refresh_token=refresh_token, user=user_response(user))


@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(current_user)):
    return user_response(user)
