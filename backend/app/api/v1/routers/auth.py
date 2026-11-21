from fastapi import APIRouter, Depends, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.schemas.auth_schemas import (
    RegisterRequest, LoginRequest, RefreshRequest,
    TokenResponse, MeResponse,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: AsyncIOMotorDatabase = Depends(get_db)):
    svc = AuthService(db)
    tokens = await svc.register(body.email, body.password, body.display_name)
    return tokens


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncIOMotorDatabase = Depends(get_db)):
    svc = AuthService(db)
    tokens = await svc.login(body.email, body.password)
    return tokens


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, db: AsyncIOMotorDatabase = Depends(get_db)):
    svc = AuthService(db)
    tokens = await svc.refresh(body.refresh_token)
    return tokens


@router.get("/me", response_model=MeResponse)
async def me(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    svc = AuthService(db)
    return await svc.get_me(current_user)
