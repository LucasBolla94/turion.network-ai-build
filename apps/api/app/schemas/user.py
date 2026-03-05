from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from uuid import UUID
from datetime import datetime
from app.models.user import PlanType, CurrencyType


# --- Input schemas (what the API receives) ---

class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    locale: Optional[str] = "en"
    currency: Optional[CurrencyType] = CurrencyType.GBP

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Name cannot be empty")
        return v.strip()


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdateLocale(BaseModel):
    locale: str


# --- Output schemas (what the API returns) ---

class UserPublic(BaseModel):
    id: UUID
    name: str
    email: str
    plan: PlanType
    currency: CurrencyType
    locale: str
    is_verified: bool
    tokens_used_month: int
    tokens_topup_balance: int
    apps_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Auth responses ---

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class MessageResponse(BaseModel):
    message: str
