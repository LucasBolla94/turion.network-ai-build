from sqlalchemy import Column, String, Boolean, DateTime, Enum, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
import enum
from app.db.database import Base


class AppStatus(str, enum.Enum):
    draft = "draft"
    building = "building"
    online = "online"
    stopped = "stopped"
    error = "error"


class AppProject(Base):
    __tablename__ = "app_projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    name = Column(String(80), nullable=False)
    slug = Column(String(80), unique=True, index=True, nullable=False)  # e.g. "my-app"
    description = Column(Text, nullable=True)

    status = Column(Enum(AppStatus), default=AppStatus.draft, nullable=False)

    # Subdomain: slug.turion.network
    subdomain = Column(String(80), unique=True, nullable=True)
    custom_domain = Column(String(255), nullable=True)

    # Build info
    framework = Column(String(40), default="nextjs")  # nextjs, fastapi, static
    build_logs = Column(Text, nullable=True)

    is_public = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    deployed_at = Column(DateTime(timezone=True), nullable=True)
