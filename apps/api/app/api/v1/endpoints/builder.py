import json
import anthropic
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from uuid import UUID

from app.core.config import settings
from app.db.database import get_db
from app.models.builder import BuilderSession, BuilderMessage, MessageRole
from app.models.user import User, PlanType
from app.api.v1.deps import get_current_user
from app.services.builder_prompt import SYSTEM_PROMPT

router = APIRouter(prefix="/builder", tags=["AI Builder"])

TOKEN_LIMITS = {
    PlanType.free: 100_000,
    PlanType.pro: 2_000_000,
    PlanType.team: 10_000_000,
}


# ── Schemas ──────────────────────────────────────────────

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


# ── Helpers ───────────────────────────────────────────────

def _check_quota(user: User):
    limit = TOKEN_LIMITS[user.plan]
    if user.tokens_used_month >= limit:
        raise HTTPException(
            status_code=429,
            detail=f"Monthly token limit reached ({limit:,}). Please upgrade your plan."
        )


def _get_session(db: Session, session_id: str, user: User) -> BuilderSession:
    s = db.query(BuilderSession).filter(
        BuilderSession.id == session_id,
        BuilderSession.owner_id == user.id,
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    return s


# ── Routes ────────────────────────────────────────────────

@router.post("/sessions", response_model=SessionOut, status_code=201)
def create_session(
    body: NewSessionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new AI builder chat session."""
    session = BuilderSession(
        owner_id=current_user.id,
        title=body.title or "New App",
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return SessionOut(
        id=str(session.id),
        title=session.title,
        model_used=session.model_used,
        created_at=str(session.created_at),
    )


@router.get("/sessions", response_model=List[SessionOut])
def list_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all sessions for the current user."""
    sessions = (
        db.query(BuilderSession)
        .filter(BuilderSession.owner_id == current_user.id)
        .order_by(BuilderSession.created_at.desc())
        .limit(50)
        .all()
    )
    return [SessionOut(id=str(s.id), title=s.title, model_used=s.model_used, created_at=str(s.created_at)) for s in sessions]


@router.get("/sessions/{session_id}/messages", response_model=List[MessageOut])
def get_messages(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all messages in a session."""
    _get_session(db, session_id, current_user)
    msgs = (
        db.query(BuilderMessage)
        .filter(BuilderMessage.session_id == session_id)
        .order_by(BuilderMessage.created_at.asc())
        .all()
    )
    return [MessageOut(id=str(m.id), role=m.role, content=m.content, created_at=str(m.created_at)) for m in msgs]


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a session and all its messages."""
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
    Send a message and get a streaming AI response (Server-Sent Events).
    The response streams token by token so the UI can display it in real time.
    """
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="AI service not configured. Please add ANTHROPIC_API_KEY to the server environment."
        )

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

    # Auto-update session title from first message
    if session.title == "New App":
        title = body.message[:60].strip()
        session.title = title if len(title) > 3 else "New App"
        db.commit()

    # Build conversation history for Claude
    history = (
        db.query(BuilderMessage)
        .filter(BuilderMessage.session_id == session.id)
        .order_by(BuilderMessage.created_at.asc())
        .all()
    )
    messages = [{"role": m.role.value, "content": m.content} for m in history]

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    def generate():
        full_response = ""
        input_tokens = 0
        output_tokens = 0

        try:
            with client.messages.stream(
                model="claude-sonnet-4-6",
                max_tokens=8192,
                system=SYSTEM_PROMPT,
                messages=messages,
            ) as stream:
                for text in stream.text_stream:
                    full_response += text
                    # SSE format
                    yield f"data: {json.dumps({'type': 'text', 'text': text})}\n\n"

                # Final usage stats
                msg = stream.get_final_message()
                input_tokens = msg.usage.input_tokens
                output_tokens = msg.usage.output_tokens

        except anthropic.APIError as e:
            yield f"data: {json.dumps({'type': 'error', 'text': str(e)})}\n\n"
            return

        # Save assistant message and update token count
        total_tokens = input_tokens + output_tokens
        assistant_msg = BuilderMessage(
            session_id=session.id,
            role=MessageRole.assistant,
            content=full_response,
            tokens_used=total_tokens,
        )
        db.add(assistant_msg)
        current_user.tokens_used_month += total_tokens
        db.commit()

        yield f"data: {json.dumps({'type': 'done', 'tokens': total_tokens})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disables Nginx buffering for SSE
        },
    )
