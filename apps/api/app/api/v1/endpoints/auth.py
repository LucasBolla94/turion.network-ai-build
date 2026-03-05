import secrets
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as pg_insert
from pydantic import BaseModel

from app.db.database import get_db
from app.schemas.user import UserRegister, UserLogin, TokenResponse, UserPublic
from app.services.user_service import register_user, authenticate_user, create_token_for_user
from app.services.email import send_password_reset, send_verification, _is_configured
from app.api.v1.deps import get_current_user
from app.models.user import User, CurrencyType
from app.models.password_reset import PasswordResetToken
from app.models.email_verification import EmailVerificationToken
from app.models.usage_log import TokenUsageDaily
from app.core.security import hash_password

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class UserUpdateSettings(BaseModel):
    name: Optional[str] = None
    locale: Optional[str] = None
    currency: Optional[CurrencyType] = None


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class UsageDayOut(BaseModel):
    date: str
    tokens_used: int


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_reset_token(db: Session, user: User) -> str:
    # Invalidate any existing tokens
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used == False,
    ).delete()
    token = secrets.token_urlsafe(48)
    prt = PasswordResetToken(
        user_id=user.id,
        token=token,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )
    db.add(prt)
    db.commit()
    return token


def _make_verification_token(db: Session, user: User) -> str:
    # Remove old tokens
    db.query(EmailVerificationToken).filter(
        EmailVerificationToken.user_id == user.id,
    ).delete()
    token = secrets.token_urlsafe(48)
    evt = EmailVerificationToken(
        user_id=user.id,
        token=token,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    db.add(evt)
    db.commit()
    return token


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/register", response_model=TokenResponse, status_code=201)
def register(data: UserRegister, db: Session = Depends(get_db)):
    user = register_user(db, data)
    # Send verification email (non-blocking — failure doesn't break registration)
    try:
        token = _make_verification_token(db, user)
        sent = send_verification(user.email, user.name, token)
        if not sent:
            logger.info(f"[VERIFY-TOKEN] user={user.email} token={token}")
    except Exception as e:
        logger.error(f"Verification email error: {e}")
    jwt = create_token_for_user(user)
    return TokenResponse(access_token=jwt, user=UserPublic.model_validate(user))


@router.post("/login", response_model=TokenResponse)
def login(data: UserLogin, db: Session = Depends(get_db)):
    user = authenticate_user(db, data.email, data.password)
    jwt = create_token_for_user(user)
    return TokenResponse(access_token=jwt, user=UserPublic.model_validate(user))


@router.get("/me", response_model=UserPublic)
def me(current_user: User = Depends(get_current_user)):
    return UserPublic.model_validate(current_user)


@router.patch("/me", response_model=UserPublic)
def update_me(
    data: UserUpdateSettings,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if data.name is not None and data.name.strip():
        current_user.name = data.name.strip()
    if data.locale is not None:
        current_user.locale = data.locale
    if data.currency is not None:
        current_user.currency = data.currency
    db.commit()
    db.refresh(current_user)
    return UserPublic.model_validate(current_user)


# ── Password Reset ────────────────────────────────────────────────────────────

@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """
    Sends a password reset email. Always returns 200 to avoid email enumeration.
    If SMTP is not configured the token is logged to server console.
    """
    from app.services.user_service import get_user_by_email
    user = get_user_by_email(db, body.email)
    if not user:
        return {"message": "If that email exists, a reset link has been sent."}

    token = _make_reset_token(db, user)
    sent = send_password_reset(user.email, user.name, token)
    if not sent:
        # Dev fallback: log the link so it can be tested without SMTP
        logger.info(f"[RESET-LINK] https://turion.network/reset-password?token={token}")

    return {"message": "If that email exists, a reset link has been sent."}


@router.post("/reset-password")
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    prt = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == body.token,
        PasswordResetToken.used == False,
    ).first()

    if not prt:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    if datetime.now(timezone.utc) > prt.expires_at:
        raise HTTPException(status_code=400, detail="Reset token has expired")

    user = db.query(User).filter(User.id == prt.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = hash_password(body.new_password)
    prt.used = True
    db.commit()

    return {"message": "Password updated successfully. You can now log in."}


# ── Email Verification ────────────────────────────────────────────────────────

@router.post("/send-verification")
def send_verification_email(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.is_verified:
        return {"message": "Email already verified"}

    token = _make_verification_token(db, current_user)
    sent = send_verification(current_user.email, current_user.name, token)
    if not sent:
        logger.info(f"[VERIFY-LINK] https://turion.network/verify-email?token={token}")

    return {"message": "Verification email sent"}


@router.get("/verify-email")
def verify_email(token: str = Query(...), db: Session = Depends(get_db)):
    evt = db.query(EmailVerificationToken).filter(
        EmailVerificationToken.token == token,
    ).first()

    if not evt:
        raise HTTPException(status_code=400, detail="Invalid verification token")

    if datetime.now(timezone.utc) > evt.expires_at:
        raise HTTPException(status_code=400, detail="Verification token has expired")

    user = db.query(User).filter(User.id == evt.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_verified = True
    db.delete(evt)
    db.commit()

    return {"message": "Email verified successfully"}


# ── Usage Stats ───────────────────────────────────────────────────────────────

@router.get("/usage", response_model=List[UsageDayOut])
def get_usage(
    days: int = Query(default=30, le=90),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns daily token usage for the last N days."""
    from datetime import date, timedelta as td
    today = date.today()
    since = today - td(days=days - 1)

    rows = (
        db.query(TokenUsageDaily)
        .filter(
            TokenUsageDaily.user_id == current_user.id,
            TokenUsageDaily.date >= since,
        )
        .order_by(TokenUsageDaily.date.asc())
        .all()
    )

    # Build complete day range (fill missing days with 0)
    usage_map = {r.date: r.tokens_used for r in rows}
    result = []
    for i in range(days):
        d = since + td(days=i)
        result.append(UsageDayOut(date=d.isoformat(), tokens_used=usage_map.get(d, 0)))

    return result
