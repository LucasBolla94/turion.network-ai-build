"""
TURION ROUTELLM v2
==================
Two-dimensional routing: TaskType × Complexity.

TaskType determines WHICH chain to use (optimized per task kind).
Complexity determines the POSITION within that chain (cheap → expensive).

Plan Mode + Build Mode
----------------------
Plan Mode:  cheap model generates a structured plan (~400 token output)
Build Mode: right model for the task executes guided by the approved plan

Key improvements over v1:
- TaskType routing: edit/explain/chat use much cheaper models
- Adaptive system prompt: follow-ups use a compact prompt (saves ~1K tokens/msg)
- Output validation: detects malformed code blocks for auto-retry
- Code context extraction: strips explanation text, keeps only current code
"""

import re
import os
from enum import Enum
from typing import Generator
import litellm

litellm.drop_params = True
litellm.set_verbose = False


# ── Enums ─────────────────────────────────────────────────────────────────────

class Complexity(str, Enum):
    HIGH   = "high"
    MEDIUM = "medium"
    LOW    = "low"


class TaskType(str, Enum):
    CREATE_STATIC    = "create_static"     # landing page, portfolio, tool
    CREATE_FULLSTACK = "create_fullstack"  # with auth/DB/API routes
    EDIT_CODE        = "edit"              # modify existing code
    EXPLAIN          = "explain"           # no code output
    DEBUG            = "debug"             # fix a specific bug
    CHAT             = "chat"              # just talking, greetings


# ── Keyword sets ──────────────────────────────────────────────────────────────

_CREATE_KEYWORDS = {
    "build", "create", "generate", "make", "develop", "design",
    "full app", "full-stack", "complete", "entire", "from scratch",
    "landing page", "dashboard", "saas", "platform", "system",
    "website", "web app", "portfolio", "calculator", "tool",
    # PT-BR
    "crie", "construa", "desenvolva", "gere", "cria", "faz",
    "pagina", "site", "aplicativo",
    # ES / FR
    "crea", "crée", "créer", "construire",
}

_FULLSTACK_SIGNALS = {
    "login", "register", "signup", "sign up", "authentication", "auth",
    "database", "supabase", "prisma", "drizzle", "mongodb",
    "stripe", "payment", "checkout", "subscription",
    "api route", "server action", "webhook", "backend",
    "next.js", "nextjs",
    # PT-BR
    "cadastro", "autenticacao", "banco de dados", "pagamento",
}

_EDIT_KEYWORDS = {
    "fix", "edit", "update", "change", "modify", "refactor", "improve",
    "add", "remove", "adjust", "rename", "move", "convert", "replace",
    "make it", "change the", "update the", "add a", "remove the",
    "swap", "switch", "tweak", "alter",
    # PT-BR
    "corrige", "edite", "atualize", "mude", "adicione", "remova",
    "troque", "altere", "ajuste", "melhore",
    # ES / FR
    "corriger", "modifier", "ajouter", "arregla", "cambia",
}

_EXPLAIN_KEYWORDS = {
    "explain", "how does", "what is", "why does", "help me understand",
    "what does", "how do", "can you explain", "tell me about",
    "describe", "walk me through",
    # PT-BR
    "explica", "como funciona", "o que e", "por que", "me ajuda",
    "descreva", "como faz",
}

_DEBUG_KEYWORDS = {
    "bug", "error", "broken", "not working", "doesn't work", "crash",
    "fix this", "debug", "issue", "problem", "wrong", "failed",
    "undefined", "null", "exception", "traceback",
    # PT-BR
    "erro", "quebrado", "nao funciona", "problema", "falha",
}

_CODE_SIGNALS = {
    "```", "html", "css", "javascript", "typescript", "python",
    "function", "class", "component", "api", "endpoint",
    "sql", "hook", "usestate", "useeffect", "react",
}


# ── Classifiers ───────────────────────────────────────────────────────────────

def classify_task(prompt: str, has_code_context: bool = False) -> TaskType:
    """Determine WHAT kind of task the user is requesting."""
    p = prompt.lower()
    words = set(re.split(r"\W+", p))

    # Check for greetings / very short messages first
    if len(prompt) < 30 and not any(sig in p for sig in _CODE_SIGNALS):
        greetings = {"hi", "hello", "hey", "ola", "oi", "thanks", "thank", "ok", "obrigado"}
        if words & greetings or len(words) <= 4:
            return TaskType.CHAT

    # Debug: user is reporting a bug or error
    if _DEBUG_KEYWORDS & words:
        return TaskType.DEBUG

    # Explain: user wants understanding, not code
    if _EXPLAIN_KEYWORDS & words and not (_CREATE_KEYWORDS & words) and not (_EDIT_KEYWORDS & words):
        return TaskType.EXPLAIN

    # Edit: user wants to modify existing code (especially if code context exists)
    if has_code_context and (_EDIT_KEYWORDS & words):
        return TaskType.EDIT_CODE

    # Edit: even without code context, if it's clearly an edit request
    edit_phrases = ["make it", "change the", "update the", "add a", "remove the",
                    "mude a", "troque a", "adicione um", "remova o"]
    if any(phrase in p for phrase in edit_phrases):
        return TaskType.EDIT_CODE

    # Create fullstack: needs auth/DB/payments
    if (_CREATE_KEYWORDS & words) and any(sig in p for sig in _FULLSTACK_SIGNALS):
        return TaskType.CREATE_FULLSTACK

    # Create static: generic build request
    if _CREATE_KEYWORDS & words:
        return TaskType.CREATE_STATIC

    # Fallback: if there's code context and none of the above, treat as edit
    if has_code_context:
        return TaskType.EDIT_CODE

    return TaskType.CHAT


def classify_complexity(prompt: str) -> Complexity:
    """Determine HOW complex the task is (independent of type)."""
    p = prompt.lower()
    words = set(re.split(r"\W+", p))

    # Long creative prompts with build keywords → HIGH
    if len(prompt) > 200:
        return Complexity.HIGH

    # Multi-page or complex architecture signals
    high_signals = {"multi", "several", "multiple", "complete", "entire",
                    "full", "complex", "advanced", "professional"}
    if high_signals & words and len(prompt) > 80:
        return Complexity.HIGH

    # Short or simple prompts → LOW
    if len(prompt) < 50:
        return Complexity.LOW

    return Complexity.MEDIUM


# ── Model chain builder ──────────────────────────────────────────────────────

def _build_model(model: str, api_key: str, api_base: str | None = None) -> dict:
    entry = {"model": model, "api_key": api_key}
    if api_base:
        entry["api_base"] = api_base
    return entry


def _get_models():
    """Build all model entries from env vars. Returns dict of model objects."""
    ant = os.getenv("ANTHROPIC_API_KEY", "")
    oai = os.getenv("OPENAI_API_KEY", "")
    xai = os.getenv("XAI_API_KEY", "")
    zai = os.getenv("ZAI_API_KEY", "")

    XAI_BASE = "https://api.x.ai/v1"
    ZAI_BASE = "https://api.z.ai/api/paas/v4"

    m = {}
    # xAI
    if xai:
        m["grok4fast"]  = _build_model("openai/grok-4-fast-non-reasoning", xai, XAI_BASE)
        m["grok_code"]  = _build_model("openai/grok-code-fast-1", xai, XAI_BASE)
        m["grok3"]      = _build_model("openai/grok-3", xai, XAI_BASE)
        m["grok3mini"]  = _build_model("openai/grok-3-mini", xai, XAI_BASE)
    # OpenAI
    if oai:
        m["gpt4o"]      = _build_model("openai/gpt-4o", oai)
        m["gpt4omini"]  = _build_model("openai/gpt-4o-mini", oai)
    # Anthropic
    if ant:
        m["claude_s"]   = _build_model("anthropic/claude-sonnet-4-6", ant)
        m["claude_h"]   = _build_model("anthropic/claude-haiku-4-5", ant)
    # Z.ai
    if zai:
        m["glm5code"]   = _build_model("openai/glm-5-code", zai, ZAI_BASE)
        m["glm47"]      = _build_model("openai/glm-4.7", zai, ZAI_BASE)
        m["glm47flashx"]= _build_model("openai/glm-4.7-flashx", zai, ZAI_BASE)
        m["glm47flash"] = _build_model("openai/glm-4.7-flash", zai, ZAI_BASE)
        m["glm45flash"] = _build_model("openai/glm-4.5-flash", zai, ZAI_BASE)

    return m


def _chain(models: dict, *keys) -> list[dict]:
    """Build a chain from model keys, skipping any that aren't available."""
    return [models[k] for k in keys if k in models]


def get_chain(task_type: TaskType, complexity: Complexity, free_plan: bool = False) -> list[dict]:
    """
    Get the optimal model chain for a given task type and complexity.
    Free-plan users always get zero-cost models.
    """
    m = _get_models()

    if free_plan:
        return _chain(m, "glm47flash", "glm45flash", "gpt4omini")

    if task_type == TaskType.CHAT:
        # Greetings, thanks, simple questions → cheapest possible
        return _chain(m, "glm47flash", "gpt4omini", "grok3mini")

    if task_type == TaskType.EXPLAIN:
        # No code generation needed → cheap models are fine
        return _chain(m, "glm47flash", "gpt4omini", "grok4fast", "glm47")

    if task_type == TaskType.EDIT_CODE:
        # Small code changes → fast cheap models first
        if complexity == Complexity.LOW:
            return _chain(m, "gpt4omini", "glm47flash", "grok3mini")
        # Medium edits
        return _chain(m, "grok4fast", "gpt4omini", "glm47", "claude_h")

    if task_type == TaskType.DEBUG:
        # Debugging needs reasoning but not necessarily the most expensive
        return _chain(m, "grok4fast", "gpt4omini", "claude_h", "gpt4o")

    if task_type == TaskType.CREATE_STATIC:
        # Static HTML/CSS/JS — grok is excellent and cheap
        if complexity == Complexity.LOW:
            return _chain(m, "grok4fast", "gpt4omini", "glm5code")
        return _chain(m, "grok4fast", "grok_code", "glm5code", "gpt4o", "claude_s")

    if task_type == TaskType.CREATE_FULLSTACK:
        # Full-stack with auth/DB/payments — needs the best models
        return _chain(m, "grok4fast", "grok_code", "glm5code", "gpt4o", "claude_s", "grok3")

    # Fallback: generic chain
    return _chain(m, "grok4fast", "gpt4omini", "glm47", "gpt4o", "claude_s")


# ── Output validation ─────────────────────────────────────────────────────────

def validate_output(text: str) -> tuple[bool, str]:
    """
    Validate that AI output has properly formatted code blocks.
    Returns (is_valid, error_description).
    """
    if not text.strip():
        return False, "Empty response"

    # Count opening and closing code fences
    fences = re.findall(r"```", text)
    if len(fences) % 2 != 0:
        return False, "Unclosed code block (odd number of ``` fences)"

    # If there are code blocks, check they have the lang:path format
    code_blocks = re.findall(r"```([\w-]*):?([^\n]*)\n", text)
    if code_blocks:
        # At least some blocks should have the lang:path format
        formatted = [b for b in code_blocks if b[0] and b[1].strip()]
        if not formatted and len(code_blocks) > 0:
            return False, "Code blocks missing lang:path format"

    return True, ""


def extract_code_context(messages: list[dict]) -> str | None:
    """
    Extract the CURRENT code files from conversation history.
    Returns a compact string with just the latest version of each file.
    More efficient than sending raw chat history for edit requests.
    """
    # Walk messages in reverse to find the latest code from assistant
    latest_files: dict[str, str] = {}

    for msg in reversed(messages):
        if msg.get("role") != "assistant":
            continue
        content = msg.get("content", "")
        blocks = re.findall(r"```([\w-]+):([^\n]+)\n([\s\S]*?)```", content)
        for lang, path, code in blocks:
            path = path.strip()
            if path not in latest_files:
                latest_files[path] = f"```{lang}:{path}\n{code}```"

        # Once we have files, stop looking further back
        if latest_files:
            break

    if not latest_files:
        return None

    return "\n\n".join(latest_files.values())


# ── Plan generator ────────────────────────────────────────────────────────────

PLAN_SYSTEM = """You are a project planner for an AI app builder called Turion Network.
Given a user's app idea, generate a structured build plan. Be specific and decisive.

Output format (ALWAYS use this exact format):

**Type:** [Static HTML/CSS/JS] or [Next.js App]
**Files:** [comma-separated list of files to create]
**Features:**
- [specific feature 1]
- [specific feature 2]
- [specific feature 3]

**Design:** [1 sentence: color scheme, layout style, visual approach]
**Estimated tokens:** [number — rough estimate: static ~5K-12K, fullstack ~15K-40K]

Rules:
- Max 120 words total
- Be decisive: pick specific features, colors, layout
- Default to Static HTML/CSS/JS unless the user clearly needs auth/DB/API
- Never ask questions — just plan based on what was described
- If the description is vague, fill in sensible defaults
- Always respond in the same language the user writes in"""


def generate_plan(prompt: str, free_plan: bool = False) -> Generator[tuple[str, object], None, None]:
    """
    Generate a build plan using the cheapest available model.
    Yields: ("plan_text", chunk) and ("plan_done", full_text)
    """
    m = _get_models()

    # Use cheapest models for planning — it's a small task
    if free_plan:
        plan_chain = _chain(m, "glm47flash", "glm45flash", "gpt4omini")
    else:
        plan_chain = _chain(m, "glm47flash", "grok4fast", "gpt4omini", "glm47")

    if not plan_chain:
        yield ("plan_error", "No AI models configured")
        return

    for entry in plan_chain:
        try:
            kwargs = dict(
                model=entry["model"],
                messages=[
                    {"role": "system", "content": PLAN_SYSTEM},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=400,
                stream=True,
                api_key=entry.get("api_key"),
            )
            if "api_base" in entry:
                kwargs["api_base"] = entry["api_base"]

            full_text = ""
            response = litellm.completion(**kwargs)

            for chunk in response:
                delta = chunk.choices[0].delta
                text = getattr(delta, "content", None) or ""
                if text:
                    full_text += text
                    yield ("plan_text", text)

            if full_text.strip():
                yield ("plan_done", {"text": full_text.strip(), "model": entry["model"]})
                return

        except Exception as exc:
            print(f"[PlanMode] {entry['model']} failed: {str(exc)[:120]}")
            continue

    yield ("plan_error", "Failed to generate plan")


# ── Conversation summarizer ───────────────────────────────────────────────────

_SUMMARY_SYSTEM = """You are a conversation summarizer for an AI app builder.
Given a sequence of chat messages between a user and an AI developer assistant,
write a COMPACT structured summary that lets the AI continue the conversation
correctly without seeing the original messages.

Output format (always use these exact headers):
## Project
[1-2 sentence description of what is being built]

## Files already generated
[comma-separated list of filenames, or "none yet"]

## Key decisions & requirements
- [bullet: e.g. "uses Supabase for auth and database"]
- [bullet: e.g. "dark theme, blue brand color"]
- [bullet: e.g. "target audience: restaurant owners"]

## Integrations & credentials
[e.g. "Stripe configured (publishable key provided)", "Supabase URL provided", or "none"]
NEVER include actual key values — only note that they were provided.

## Current state
[What was last built or discussed — 1-2 sentences]

Rules:
- Max 250 words total
- Be precise, not vague — include specific feature names, page names, color choices
- If no code was generated yet, say "no files generated yet"
- Never hallucinate details not in the conversation"""


def summarize(messages: list[dict]) -> str:
    """
    Summarize a list of older messages into a compact context string.
    Uses the cheapest available model.
    """
    if not messages:
        return ""

    m = _get_models()
    candidates = _chain(m, "glm47flash", "gpt4omini", "grok3mini")

    if not candidates:
        return ""

    # Build compact transcript
    lines = []
    for msg in messages:
        role = msg.get("role", "user").upper()
        content = msg.get("content", "")
        if len(content) > 600:
            content = content[:600] + "…[truncated]"
        lines.append(f"{role}: {content}")
    transcript = "\n\n".join(lines)

    for entry in candidates:
        try:
            kwargs = dict(
                model=entry["model"],
                messages=[
                    {"role": "system", "content": _SUMMARY_SYSTEM},
                    {"role": "user",   "content": transcript},
                ],
                max_tokens=450,
                stream=False,
                api_key=entry["api_key"],
            )
            if "api_base" in entry:
                kwargs["api_base"] = entry["api_base"]

            resp = litellm.completion(**kwargs)
            text = resp.choices[0].message.content or ""
            if text.strip():
                return text.strip()
        except Exception as exc:
            print(f"[Summarizer] {entry['model']} failed: {str(exc)[:80]}")
            continue

    return ""


# ── Public API ────────────────────────────────────────────────────────────────

class RouterResult:
    def __init__(self, model: str, complexity: Complexity, task_type: TaskType):
        self.model = model
        self.complexity = complexity
        self.task_type = task_type


def stream(
    messages: list[dict],
    system: str,
    prompt: str,
    free_plan: bool = False,
    token_context: str | None = None,
    conversation_context: str | None = None,
    task_type: TaskType | None = None,
    max_tokens: int = 8192,
) -> Generator[tuple[str, RouterResult | None], None, None]:
    """
    Classifies the prompt, picks the best available model, and streams.

    Now uses two-dimensional routing: TaskType × Complexity.
    """
    effective_system = system

    if conversation_context:
        effective_system += (
            "\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "EARLIER CONVERSATION SUMMARY (auto-compressed)\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            + conversation_context
            + "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        )

    if token_context:
        effective_system += f"\n\nRUNTIME CONTEXT:\n{token_context}"

    # Two-dimensional classification
    has_code = extract_code_context(messages) is not None
    detected_task = task_type or classify_task(prompt, has_code_context=has_code)
    complexity = classify_complexity(prompt)

    model_chain = get_chain(detected_task, complexity, free_plan=free_plan)

    if not model_chain:
        yield ("error", "No AI models configured. Add at least one API key to .env")
        return

    for entry in model_chain:
        model    = entry["model"]
        api_key  = entry.get("api_key")
        api_base = entry.get("api_base")

        try:
            yield ("meta", RouterResult(model=model, complexity=complexity, task_type=detected_task))

            input_text = system + " ".join(
                msg.get("content", "") for msg in messages
            )

            kwargs = dict(
                model=model,
                messages=[{"role": "system", "content": effective_system}] + messages,
                max_tokens=max_tokens,
                stream=True,
                stream_options={"include_usage": True},
                api_key=api_key,
            )
            if api_base:
                kwargs["api_base"] = api_base

            full_text     = ""
            input_tokens  = 0
            output_tokens = 0

            response = litellm.completion(**kwargs)

            for chunk in response:
                delta = chunk.choices[0].delta
                text = getattr(delta, "content", None) or ""
                if text:
                    full_text += text
                    yield ("text", text)

                usage = getattr(chunk, "usage", None)
                if usage:
                    pt = getattr(usage, "prompt_tokens", 0) or 0
                    ct = getattr(usage, "completion_tokens", 0) or 0
                    if pt > 0 or ct > 0:
                        input_tokens  = pt
                        output_tokens = ct

            # Fallback token estimation
            if input_tokens == 0 and output_tokens == 0:
                input_tokens  = max(1, int(len(input_text) / 3.5))
                output_tokens = max(1, int(len(full_text)  / 3.5))

            total = input_tokens + output_tokens
            if total == 0 and full_text:
                total = max(1, int(len(full_text) / 3.5))
                input_tokens  = total // 2
                output_tokens = total - input_tokens

            yield ("done", {"total": total, "input": input_tokens, "output": output_tokens})
            return

        except Exception as exc:
            print(f"[RouteLLM] {model} failed: {str(exc)[:120]}")
            continue

    yield ("error", "All AI models failed. Please try again later.")
