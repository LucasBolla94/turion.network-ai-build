from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.db.database import get_db
from app.schemas.user import UserRegister, UserLogin, TokenResponse, UserPublic
from app.services.user_service import register_user, authenticate_user, create_token_for_user
from app.api.v1.deps import get_current_user
from app.models.user import User, CurrencyType

router = APIRouter(prefix="/auth", tags=["Authentication"])


class UserUpdateSettings(BaseModel):
    name: Optional[str] = None
    locale: Optional[str] = None
    currency: Optional[CurrencyType] = None


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(data: UserRegister, db: Session = Depends(get_db)):
    """
    Create a new user account.
    Returns a JWT token immediately so the user is logged in right after registering.
    """
    user = register_user(db, data)
    token = create_token_for_user(user)
    return TokenResponse(access_token=token, user=UserPublic.model_validate(user))


@router.post("/login", response_model=TokenResponse)
def login(data: UserLogin, db: Session = Depends(get_db)):
    """
    Authenticate with email and password.
    Returns a JWT token valid for 7 days.
    """
    user = authenticate_user(db, data.email, data.password)
    token = create_token_for_user(user)
    return TokenResponse(access_token=token, user=UserPublic.model_validate(user))


@router.get("/me", response_model=UserPublic)
def me(current_user: User = Depends(get_current_user)):
    """
    Returns the currently authenticated user's profile.
    Requires a valid Bearer token in the Authorization header.
    """
    return UserPublic.model_validate(current_user)


@router.patch("/me", response_model=UserPublic)
def update_me(
    data: UserUpdateSettings,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the current user's name, locale and/or currency."""
    if data.name is not None and data.name.strip():
        current_user.name = data.name.strip()
    if data.locale is not None:
        current_user.locale = data.locale
    if data.currency is not None:
        current_user.currency = data.currency
    db.commit()
    db.refresh(current_user)
    return UserPublic.model_validate(current_user)
