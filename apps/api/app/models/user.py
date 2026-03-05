from sqlalchemy import Column, String, Boolean, DateTime, Enum, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
import enum
from app.db.database import Base


class PlanType(str, enum.Enum):
    free = "free"
    pro = "pro"
    team = "team"


class CurrencyType(str, enum.Enum):
    GBP = "GBP"
    BRL = "BRL"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(120), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)

    # Plan & billing
    plan = Column(Enum(PlanType), default=PlanType.free, nullable=False)
    currency = Column(Enum(CurrencyType), default=CurrencyType.GBP, nullable=False)
    stripe_customer_id = Column(String(255), nullable=True)
    stripe_subscription_id = Column(String(255), nullable=True)

    # Usage
    tokens_used_month    = Column(Integer, default=0)  # resets monthly
    tokens_topup_balance = Column(Integer, default=0)  # purchased, never expires
    apps_count           = Column(Integer, default=0)

    # i18n preference
    locale = Column(String(10), default="en", nullable=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_login_at = Column(DateTime(timezone=True), nullable=True)
