import json
from datetime import date, timezone, datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as pg_insert
from pydantic import BaseModel
from typing import List, Optional

from app.db.database import get_db
from app.models.builder import BuilderSession, BuilderMessage, MessageRole
from app.models.usage_log import TokenUsageDaily
from app.models.user import User, PlanType
from app.api.v1.deps import get_current_user
from app.services.builder_prompt import SYSTEM_PROMPT, get_system_prompt
from app.services import router as llm_router
from app.services.router import TaskType, validate_output, extract_code_context
from app.services.pricing import MONTHLY_TOKEN_LIMITS

router = APIRouter(prefix="/builder", tags=["AI Builder"])


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
    approved_plan: Optional[str] = None  # If set, this is Build Mode (plan was approved)


class PlanRequest(BaseModel):
    session_id: str
    message: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _check_quota(user: User):
    monthly_limit     = MONTHLY_TOKEN_LIMITS[user.plan]
    monthly_remaining = max(0, monthly_limit - user.tokens_used_month)
    total_available   = monthly_remaining + user.tokens_topup_balance

    if total_available <= 0:
        raise HTTPException(
            status_code=429,
            detail=(
                f"No tokens available. Monthly limit ({monthly_limit:,}) reached "
                "and no top-up balance. Please upgrade or buy more tokens."
            ),
        )


def _deduct_tokens(db: Session, user: User, tokens_used: int):
    """Deduct tokens: monthly allocation first, then topup balance. Also logs daily usage."""
    monthly_limit     = MONTHLY_TOKEN_LIMITS[user.plan]
    monthly_remaining = max(0, monthly_limit - user.tokens_used_month)

    if tokens_used <= monthly_remaining:
        user.tokens_used_month += tokens_used
    else:
        overflow = tokens_used - monthly_remaining
        user.tokens_used_month = monthly_limit
        user.tokens_topup_balance = max(0, user.tokens_topup_balance - overflow)

    # Log to daily usage table (upsert)
    today = date.today()
    stmt = pg_insert(TokenUsageDaily).values(
        user_id=user.id,
        date=today,
        tokens_used=tokens_used,
    ).on_conflict_do_update(
        constraint="uq_token_usage_user_date",
        set_={"tokens_used": TokenUsageDaily.tokens_used + tokens_used,
              "updated_at": datetime.now(timezone.utc)},
    )
    db.execute(stmt)


# How many recent messages to always keep verbatim
_KEEP_RECENT = 16
# Compress when total messages exceed this
_COMPRESS_THRESHOLD = 28
# Re-summarize every N new messages after first compression
_RESUMMARY_INTERVAL = 12


def _build_context(
    db: Session,
    session,
    all_messages: list[dict],
) -> tuple[list[dict], str | None]:
    """
    Smart context management with auto-compression.
    """
    total = len(all_messages)

    if total <= _COMPRESS_THRESHOLD:
        return all_messages, None

    recent = all_messages[-_KEEP_RECENT:]
    older  = all_messages[:-_KEEP_RECENT]

    messages_since_summary = total - (session.messages_count or 0)
    needs_summary = (
        not session.context_summary
        or messages_since_summary >= _RESUMMARY_INTERVAL
    )

    if needs_summary and older:
        new_summary = llm_router.summarize(older)
        if new_summary:
            session.context_summary = new_summary
            session.messages_count  = total
            db.commit()

    return recent, session.context_summary or None


def _build_edit_context(all_messages: list[dict]) -> list[dict]:
    """
    For edit/debug requests, build an optimized context:
    - Extract the current code files from the last assistant message
    - Include only the last few user/assistant exchanges
    - Inject code as a "current codebase" system-like message

    This saves tokens by not sending the full raw chat history.
    """
    code_context = extract_code_context(all_messages)
    if not code_context:
        # No code found — fall back to recent messages
        return all_messages[-8:]

    # Build a focused context: code snapshot + last 4 messages
    code_msg = {
        "role": "user",
        "content": (
            "[CURRENT CODEBASE — these are the files as they exist now]\n\n"
            + code_context
            + "\n\n[END OF CURRENT CODEBASE]"
        ),
    }

    # Keep only the last 4 messages (2 exchanges) for edit context
    recent = all_messages[-4:]

    return [code_msg] + recent


def _get_session(db: Session, session_id: str, user: User) -> BuilderSession:
    s = db.query(BuilderSession).filter(
        BuilderSession.id == session_id,
        BuilderSession.owner_id == user.id,
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    return s


def _get_token_context(user: User) -> str | None:
    """Build token availability context for the AI."""
    monthly_limit     = MONTHLY_TOKEN_LIMITS[user.plan]
    monthly_remaining = max(0, monthly_limit - user.tokens_used_month)
    total_available   = monthly_remaining + user.tokens_topup_balance

    if total_available < 5_000:
        return (
            "The user has very few tokens remaining. "
            "Propose only a minimal, single-page MVP. "
            "Be explicit: 'You have limited credits — I'll build you a lean MVP first. "
            "Once you top up, we can expand it.' "
            "Keep the build as small as possible while still being useful."
        )
    elif total_available < 25_000:
        return (
            "The user has a moderate token balance. "
            "Prioritize building a focused MVP (1-2 pages, core feature only). "
            "After delivering, suggest what can be added next. "
            "Do not build large multi-page apps in this session."
        )
    return None


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


# ── Plan Mode ─────────────────────────────────────────────────────────────────

@router.post("/plan")
def plan(
    body: PlanRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generate a build plan before executing. Uses cheapest model (~400 tokens).
    Returns SSE stream with plan_text and plan_done events.
    """
    _check_quota(current_user)
    _get_session(db, body.session_id, current_user)

    def generate():
        for event_type, payload in llm_router.generate_plan(
            prompt=body.message,
            free_plan=(current_user.plan == PlanType.free),
        ):
            if event_type == "plan_text":
                yield f"data: {json.dumps({'type': 'plan_text', 'text': payload})}\n\n"
            elif event_type == "plan_done":
                yield f"data: {json.dumps({'type': 'plan_done', 'text': payload['text'], 'model': payload['model']})}\n\n"
            elif event_type == "plan_error":
                yield f"data: {json.dumps({'type': 'plan_error', 'text': payload})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── Chat (Build Mode) ────────────────────────────────────────────────────────

@router.post("/chat")
def chat(
    body: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Stream an AI response using RouteLLM v2.

    Now supports:
    - TaskType routing (edit/explain/chat use cheaper models)
    - Adaptive system prompts (full vs compact)
    - Code context extraction for edits (sends code, not chat history)
    - Plan-guided builds (when approved_plan is provided)
    - Output validation + 1 auto-retry on malformed output
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
    all_messages = [{"role": m.role.value, "content": m.content} for m in history]

    # ── Classify the task ──────────────────────────────────────────────────
    has_code = extract_code_context(all_messages) is not None
    task_type = llm_router.classify_task(body.message, has_code_context=has_code)

    # ── Select the right system prompt ─────────────────────────────────────
    system_prompt = get_system_prompt(task_type.value)

    # If plan was approved, inject it into the system prompt
    if body.approved_plan:
        system_prompt += (
            "\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "APPROVED BUILD PLAN — Follow this exactly\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            + body.approved_plan
            + "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "Build EXACTLY what is described in the plan above. "
            "Do not ask questions — the user already approved this plan."
        )
        # Force CREATE task type when plan is approved
        task_type = TaskType.CREATE_STATIC
        system_prompt = SYSTEM_PROMPT + system_prompt[len(get_system_prompt(task_type.value)):]

    # ── Build context based on task type ───────────────────────────────────
    if task_type in (TaskType.EDIT_CODE, TaskType.DEBUG) and has_code:
        # For edits: use optimized code context instead of full history
        messages = _build_edit_context(all_messages)
        conversation_context = None
    else:
        # For builds and other tasks: use standard context management
        messages, conversation_context = _build_context(db, session, all_messages)

    token_context = _get_token_context(current_user)

    def generate():
        full_response = ""
        total_tokens = 0
        model_used = "unknown"

        for event_type, payload in llm_router.stream(
            messages=messages,
            system=system_prompt,
            prompt=body.message,
            free_plan=(current_user.plan == PlanType.free),
            token_context=token_context,
            conversation_context=conversation_context,
            task_type=task_type,
        ):
            if event_type == "meta":
                model_used = payload.model
                yield f"data: {json.dumps({'type': 'meta', 'model': payload.model, 'complexity': payload.complexity, 'task_type': payload.task_type})}\n\n"

            elif event_type == "text":
                full_response += payload
                yield f"data: {json.dumps({'type': 'text', 'text': payload})}\n\n"

            elif event_type == "done":
                if isinstance(payload, dict):
                    total_tokens  = int(payload.get("total",  0))
                    input_tokens  = int(payload.get("input",  0))
                    output_tokens = int(payload.get("output", 0))
                else:
                    total_tokens  = int(payload) if payload else 0
                    input_tokens  = 0
                    output_tokens = 0

                if total_tokens == 0 and full_response:
                    total_tokens  = max(1, len(full_response) // 4)
                    output_tokens = total_tokens
                    input_tokens  = 0

                # ── Output validation ──────────────────────────────────
                is_valid, validation_error = validate_output(full_response)
                validation_warning = ""
                if not is_valid and task_type in (TaskType.CREATE_STATIC, TaskType.CREATE_FULLSTACK):
                    validation_warning = validation_error

                # Save assistant message
                assistant_msg = BuilderMessage(
                    session_id=session.id,
                    role=MessageRole.assistant,
                    content=full_response,
                    tokens_used=total_tokens,
                )
                db.add(assistant_msg)

                session.model_used = model_used
                _deduct_tokens(db, current_user, total_tokens)
                db.commit()

                done_payload = {
                    'type': 'done',
                    'tokens': total_tokens,
                    'input_tokens': input_tokens,
                    'output_tokens': output_tokens,
                    'model': model_used,
                    'task_type': task_type.value,
                }
                if validation_warning:
                    done_payload['validation_warning'] = validation_warning

                yield f"data: {json.dumps(done_payload)}\n\n"

            elif event_type == "error":
                yield f"data: {json.dumps({'type': 'error', 'text': payload})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
