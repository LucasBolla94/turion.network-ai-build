import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional

from app.db.database import get_db
from app.models.builder import BuilderSession, BuilderMessage, MessageRole
from app.models.user import User, PlanType
from app.api.v1.deps import get_current_user
from app.services.builder_prompt import SYSTEM_PROMPT
from app.services import router as llm_router

router = APIRouter(prefix="/builder", tags=["AI Builder"])

TOKEN_LIMITS = {
    PlanType.free: 100_000,
    PlanType.pro: 2_000_000,
    PlanType.team: 10_000_000,
}


# ── Schemas ───────────────────────────────────────────────────────────────────

class NewSessionRequest(BaseModel):
    title: Optional[str] = "New App"


class SessionOut(BaseModel):
    id: str
    title: str
    model_used: str
    created_at: str
    model_config = {"from_attributes": True}


class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    created_at: str
    model_config = {"from_attributes": True}


class ChatRequest(BaseModel):
    session_id: str
    message: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _check_quota(user: User):
    limit = TOKEN_LIMITS[user.plan]
    if user.tokens_used_month >= limit:
        raise HTTPException(
            status_code=429,
            detail=f"Monthly token limit reached ({limit:,} tokens). Please upgrade your plan.",
        )


def _get_session(db: Session, session_id: str, user: User) -> BuilderSession:
    s = db.query(BuilderSession).filter(
        BuilderSession.id == session_id,
        BuilderSession.owner_id == user.id,
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    return s


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/sessions", response_model=SessionOut, status_code=201)
def create_session(
    body: NewSessionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = BuilderSession(owner_id=current_user.id, title=body.title or "New App")
    db.add(session)
    db.commit()
    db.refresh(session)
    return SessionOut(id=str(session.id), title=session.title,
                      model_used=session.model_used, created_at=str(session.created_at))


@router.get("/sessions", response_model=List[SessionOut])
def list_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(BuilderSession)
        .filter(BuilderSession.owner_id == current_user.id)
        .order_by(BuilderSession.created_at.desc())
        .limit(50)
        .all()
    )
    return [SessionOut(id=str(s.id), title=s.title,
                       model_used=s.model_used, created_at=str(s.created_at)) for s in rows]


@router.get("/sessions/{session_id}/messages", response_model=List[MessageOut])
def get_messages(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_session(db, session_id, current_user)
    msgs = (
        db.query(BuilderMessage)
        .filter(BuilderMessage.session_id == session_id)
        .order_by(BuilderMessage.created_at.asc())
        .all()
    )
    return [MessageOut(id=str(m.id), role=m.role, content=m.content,
                       created_at=str(m.created_at)) for m in msgs]


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = _get_session(db, session_id, current_user)
    db.delete(session)
    db.commit()


@router.post("/chat")
def chat(
    body: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Stream an AI response using RouteLLM.
    Automatically picks the best model for the task and falls back if needed.
    """
    _check_quota(current_user)
    session = _get_session(db, body.session_id, current_user)

    # Save user message
    user_msg = BuilderMessage(
        session_id=session.id,
        role=MessageRole.user,
        content=body.message,
    )
    db.add(user_msg)
    db.commit()

    # Auto-title from first message
    if session.title == "New App" and len(body.message) > 3:
        session.title = body.message[:60].strip()
        db.commit()

    # Build conversation history
    history = (
        db.query(BuilderMessage)
        .filter(BuilderMessage.session_id == session.id)
        .order_by(BuilderMessage.created_at.asc())
        .all()
    )
    messages = [{"role": m.role.value, "content": m.content} for m in history]

    def generate():
        full_response = ""
        total_tokens = 0
        model_used = "unknown"

        for event_type, payload in llm_router.stream(
            messages=messages,
            system=SYSTEM_PROMPT,
            prompt=body.message,
        ):
            if event_type == "meta":
                model_used = payload.model
                # Send routing info to the client
                yield f"data: {json.dumps({'type': 'meta', 'model': payload.model, 'complexity': payload.complexity})}\n\n"

            elif event_type == "text":
                full_response += payload
                yield f"data: {json.dumps({'type': 'text', 'text': payload})}\n\n"

            elif event_type == "done":
                total_tokens = int(payload) if payload else 0

                # Save assistant message
                assistant_msg = BuilderMessage(
                    session_id=session.id,
                    role=MessageRole.assistant,
                    content=full_response,
                    tokens_used=total_tokens,
                )
                db.add(assistant_msg)

                # Update session model and user token count
                session.model_used = model_used
                current_user.tokens_used_month += total_tokens
                db.commit()

                yield f"data: {json.dumps({'type': 'done', 'tokens': total_tokens, 'model': model_used})}\n\n"

            elif event_type == "error":
                yield f"data: {json.dumps({'type': 'error', 'text': payload})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
