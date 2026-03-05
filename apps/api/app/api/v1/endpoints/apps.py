from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.db.database import get_db
from app.models.user import User
from app.models.app_project import AppProject, AppStatus
from app.models.app_file import AppFile
from app.models.builder import BuilderSession, BuilderMessage, MessageRole
from app.api.v1.deps import get_current_user
from app.services.deploy import (
    parse_code_blocks, slugify, write_app_files,
    delete_app_files, preview_url,
)

router = APIRouter(prefix="/apps", tags=["Apps"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class AppFileOut(BaseModel):
    id: str
    path: str
    content: str


class AppOut(BaseModel):
    id: str
    name: str
    slug: str
    description: Optional[str]
    status: str
    framework: str
    is_public: bool
    preview_url: Optional[str]
    files_count: int
    created_at: str
    deployed_at: Optional[str]


class AppDetailOut(AppOut):
    files: List[AppFileOut]


class CreateAppFromSession(BaseModel):
    session_id: str
    name: Optional[str] = None


class UpdateAppRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_public: Optional[bool] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_unique_slug(db: Session, base: str) -> str:
    slug = slugify(base)
    candidate = slug
    i = 2
    while db.query(AppProject).filter(AppProject.slug == candidate).first():
        candidate = f"{slug}-{i}"
        i += 1
    return candidate


def _app_to_out(app: AppProject, files_count: int) -> AppOut:
    return AppOut(
        id=str(app.id),
        name=app.name,
        slug=app.slug,
        description=app.description,
        status=app.status.value if app.status else "draft",
        framework=app.framework or "static",
        is_public=app.is_public,
        preview_url=preview_url(app.slug) if app.status == AppStatus.online else None,
        files_count=files_count,
        created_at=str(app.created_at),
        deployed_at=str(app.deployed_at) if app.deployed_at else None,
    )


def _get_app(db: Session, app_id: str, user: User) -> AppProject:
    app = db.query(AppProject).filter(
        AppProject.id == app_id,
        AppProject.owner_id == user.id,
    ).first()
    if not app:
        raise HTTPException(status_code=404, detail="App not found")
    return app


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/from-session", status_code=201, response_model=AppDetailOut)
def create_app_from_session(
    body: CreateAppFromSession,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Parse the last AI message in a builder session and save as an app project."""
    session = db.query(BuilderSession).filter(
        BuilderSession.id == body.session_id,
        BuilderSession.owner_id == current_user.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get last assistant message that has code
    msgs = (
        db.query(BuilderMessage)
        .filter(
            BuilderMessage.session_id == session.id,
            BuilderMessage.role == MessageRole.assistant,
        )
        .order_by(BuilderMessage.created_at.desc())
        .all()
    )

    parsed_files: dict = {}
    for msg in msgs:
        parsed_files = parse_code_blocks(msg.content)
        if parsed_files:
            break

    if not parsed_files:
        raise HTTPException(
            status_code=400,
            detail="No code files found in this session. Ask the AI to build an app first.",
        )

    name = body.name or session.title
    slug = _make_unique_slug(db, name)

    app = AppProject(
        owner_id=current_user.id,
        name=name,
        slug=slug,
        subdomain=slug,
        framework="static",
        status=AppStatus.draft,
    )
    db.add(app)
    db.flush()

    file_records = []
    for path, content in parsed_files.items():
        f = AppFile(app_id=app.id, path=path, content=content)
        db.add(f)
        file_records.append(f)

    current_user.apps_count = (current_user.apps_count or 0) + 1
    db.commit()
    db.refresh(app)

    return AppDetailOut(
        **_app_to_out(app, len(file_records)).model_dump(),
        files=[AppFileOut(id=str(f.id), path=f.path, content=f.content) for f in file_records],
    )


@router.get("", response_model=List[AppOut])
def list_apps(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    apps = (
        db.query(AppProject)
        .filter(AppProject.owner_id == current_user.id)
        .order_by(AppProject.created_at.desc())
        .all()
    )
    result = []
    for app in apps:
        count = db.query(AppFile).filter(AppFile.app_id == app.id).count()
        result.append(_app_to_out(app, count))
    return result


@router.get("/{app_id}", response_model=AppDetailOut)
def get_app(
    app_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    app = _get_app(db, app_id, current_user)
    files = db.query(AppFile).filter(AppFile.app_id == app.id).all()
    return AppDetailOut(
        **_app_to_out(app, len(files)).model_dump(),
        files=[AppFileOut(id=str(f.id), path=f.path, content=f.content) for f in files],
    )


@router.patch("/{app_id}", response_model=AppOut)
def update_app(
    app_id: str,
    body: UpdateAppRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    app = _get_app(db, app_id, current_user)
    if body.name is not None:
        app.name = body.name
    if body.description is not None:
        app.description = body.description
    if body.is_public is not None:
        app.is_public = body.is_public
    db.commit()
    db.refresh(app)
    count = db.query(AppFile).filter(AppFile.app_id == app.id).count()
    return _app_to_out(app, count)


@router.delete("/{app_id}", status_code=204)
def delete_app(
    app_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    app = _get_app(db, app_id, current_user)
    delete_app_files(app.slug)
    db.delete(app)
    current_user.apps_count = max(0, (current_user.apps_count or 1) - 1)
    db.commit()


@router.post("/{app_id}/deploy", response_model=AppOut)
def deploy_app(
    app_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Write files to disk and make the app live at /preview/{slug}/."""
    app = _get_app(db, app_id, current_user)
    files = db.query(AppFile).filter(AppFile.app_id == app.id).all()

    if not files:
        raise HTTPException(status_code=400, detail="No files to deploy")

    try:
        write_app_files(app.slug, {f.path: f.content for f in files})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Deploy failed: {e}")

    app.status = AppStatus.online
    app.deployed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(app)

    return _app_to_out(app, len(files))


@router.post("/{app_id}/stop", response_model=AppOut)
def stop_app(
    app_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Take the app offline."""
    app = _get_app(db, app_id, current_user)
    delete_app_files(app.slug)
    app.status = AppStatus.stopped
    db.commit()
    db.refresh(app)
    count = db.query(AppFile).filter(AppFile.app_id == app.id).count()
    return _app_to_out(app, count)
