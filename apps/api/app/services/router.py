"""
TURION ROUTELLM
===============
Classifies each prompt and routes it to the best model.
Falls back automatically if a model fails or is unavailable.

Routing philosophy
------------------
1. QUALITY-TIER is determined by the prompt complexity classifier.
2. Within each tier the chain is ordered: best-value first, most-expensive last.
3. Free-plan users are served exclusively by zero-cost GLM Flash models.
4. The system falls back to the next model in the chain on any error.

Complexity tiers
----------------
HIGH   → Build full apps, complex architecture, multi-file generation
MEDIUM → Edit/fix code, add a feature, explain code with detail
LOW    → Short questions, simple text, greetings

Model chains (see pricing.py for full cost breakdown)
-----------------------------------------------------
HIGH:
  1. grok-4-fast-non-reasoning  ($0.20/$0.50 /M) — frontier speed, best value
  2. grok-code-fast-1           ($0.20/$1.50 /M) — code specialist
  3. glm-5-code                 ($1.20/$5.00 /M) — Z.ai code champion
  4. gpt-4o                     ($2.50/$10.0 /M) — proven quality
  5. claude-sonnet-4-6          ($3.00/$15.0 /M) — premium fallback

MEDIUM:
  1. grok-4-fast-non-reasoning  ($0.20/$0.50 /M) — fast + capable
  2. gpt-4o-mini                ($0.15/$0.60 /M) — lightweight & cheap
  3. glm-4.7                    ($0.60/$2.20 /M) — Z.ai quality mid-tier
  4. claude-haiku-4-5           ($1.00/$5.00 /M) — reliable Anthropic mid
  5. gpt-4o                     ($2.50/$10.0 /M) — last resort quality

LOW:
  1. glm-4.7-flash              (FREE)            — free-plan & cost save
  2. gpt-4o-mini                ($0.15/$0.60 /M) — cheap OpenAI fallback
  3. grok-3-mini                ($0.30/$0.50 /M) — cheap xAI fallback
  4. glm-4.7-flashx             ($0.07/$0.40 /M) — ultra-cheap Z.ai

FREE plan users:
  All tiers     → glm-4.7-flash (FREE) → glm-4.5-flash (FREE)

To add a new model: add an entry in _chains() and update pricing.py docs.
"""

import re
import os
from enum import Enum
from typing import Generator
import litellm

litellm.drop_params = True   # ignore unsupported params silently
litellm.set_verbose = False


class Complexity(str, Enum):
    HIGH   = "high"
    MEDIUM = "medium"
    LOW    = "low"


# ── Keyword classifiers ───────────────────────────────────────────────────────

_HIGH_KEYWORDS = {
    "build", "create", "generate", "make", "develop", "design",
    "full app", "full-stack", "complete", "entire", "from scratch",
    "landing page", "dashboard", "saas", "platform", "system",
    "website", "web app",
    # PT-BR
    "crie", "construa", "desenvolva", "gere", "cria", "faz",
    # ES / FR
    "crea", "crée", "créer", "construire",
}

_MEDIUM_KEYWORDS = {
    "fix", "edit", "update", "change", "modify", "refactor", "improve",
    "add", "remove", "adjust", "rename", "move", "convert",
    "explain", "how does", "what is", "why does", "help me",
    # PT-BR
    "corrige", "edite", "atualize", "mude", "adicione", "remova", "explica",
    # ES / FR
    "corriger", "modifier", "ajouter", "arregla", "cambia",
}

_CODE_SIGNALS = {
    "```", "html", "css", "javascript", "typescript", "python",
    "function", "class", "component", "api", "endpoint", "database",
    "sql", "hook", "usestate", "useeffect", "react", "nextjs",
}


def classify(prompt: str) -> Complexity:
    """Determine prompt complexity using keyword + heuristic rules."""
    p = prompt.lower()
    words = set(re.split(r"\W+", p))

    # Long creative/build prompts → HIGH
    if len(prompt) > 200 and _HIGH_KEYWORDS & words:
        return Complexity.HIGH

    if _HIGH_KEYWORDS & words:
        return Complexity.HIGH

    # Code snippets or edit requests → MEDIUM
    has_code = any(sig in p for sig in _CODE_SIGNALS)
    if has_code or (_MEDIUM_KEYWORDS & words):
        return Complexity.MEDIUM

    return Complexity.LOW


# ── Model chain builder ───────────────────────────────────────────────────────

def _build_model(model: str, api_key: str, api_base: str | None = None) -> dict:
    entry = {"model": model, "api_key": api_key}
    if api_base:
        entry["api_base"] = api_base
    return entry


def _chains(free_plan: bool = False) -> dict[Complexity, list[dict]]:
    """
    Returns per-tier model chains.
    If free_plan=True, returns only zero-cost models regardless of tier.
    Only includes models whose API keys are actually set.
    """
    ant = os.getenv("ANTHROPIC_API_KEY", "")
    oai = os.getenv("OPENAI_API_KEY", "")
    xai = os.getenv("XAI_API_KEY", "")
    zai = os.getenv("ZAI_API_KEY", "")

    XAI_BASE = "https://api.x.ai/v1"
    ZAI_BASE = "https://api.z.ai/api/paas/v4"

    # ── Individual model entries ──────────────────────────────────────────────
    # xAI models
    grok4fast    = _build_model("openai/grok-4-fast-non-reasoning", xai, XAI_BASE) if xai else None
    grok_code    = _build_model("openai/grok-code-fast-1",          xai, XAI_BASE) if xai else None
    grok3        = _build_model("openai/grok-3",                    xai, XAI_BASE) if xai else None
    grok3mini    = _build_model("openai/grok-3-mini",               xai, XAI_BASE) if xai else None

    # OpenAI models
    gpt4o        = _build_model("openai/gpt-4o",      oai) if oai else None
    gpt4omini    = _build_model("openai/gpt-4o-mini", oai) if oai else None

    # Anthropic models
    claude_s     = _build_model("anthropic/claude-sonnet-4-6", ant) if ant else None
    claude_h     = _build_model("anthropic/claude-haiku-4-5",  ant) if ant else None

    # Z.ai models — note: free Flash models included regardless of paid plan
    glm5code     = _build_model("openai/glm-5-code",      zai, ZAI_BASE) if zai else None
    glm47        = _build_model("openai/glm-4.7",         zai, ZAI_BASE) if zai else None
    glm47flashx  = _build_model("openai/glm-4.7-flashx",  zai, ZAI_BASE) if zai else None
    glm47flash   = _build_model("openai/glm-4.7-flash",   zai, ZAI_BASE) if zai else None
    glm45flash   = _build_model("openai/glm-4.5-flash",   zai, ZAI_BASE) if zai else None

    def chain(*models):
        return [m for m in models if m is not None]

    # Free-plan users: only zero-cost GLM Flash models
    if free_plan:
        free_chain = chain(glm47flash, glm45flash, gpt4omini)
        return {
            Complexity.HIGH:   free_chain,
            Complexity.MEDIUM: free_chain,
            Complexity.LOW:    free_chain,
        }

    return {
        # HIGH: best-value frontier first, expensive last
        Complexity.HIGH: chain(
            grok4fast,   # $0.20/$0.50 — incredible value
            grok_code,   # $0.20/$1.50 — code specialist
            glm5code,    # $1.20/$5.00 — Z.ai code champion
            gpt4o,       # $2.50/$10.0 — proven quality
            claude_s,    # $3.00/$15.0 — premium fallback
            grok3,       # $3.00/$15.0 — xAI premium fallback
        ),

        # MEDIUM: balance speed + cost
        Complexity.MEDIUM: chain(
            grok4fast,   # $0.20/$0.50 — fast + capable
            gpt4omini,   # $0.15/$0.60 — lightweight cheap
            glm47,       # $0.60/$2.20 — Z.ai quality mid
            claude_h,    # $1.00/$5.00 — reliable Anthropic
            gpt4o,       # $2.50/$10.0 — last resort
        ),

        # LOW: cheapest first, free models preferred
        Complexity.LOW: chain(
            glm47flash,  # FREE
            gpt4omini,   # $0.15/$0.60
            grok3mini,   # $0.30/$0.50
            glm47flashx, # $0.07/$0.40
        ),
    }


# ── Public API ────────────────────────────────────────────────────────────────

class RouterResult:
    def __init__(self, model: str, complexity: Complexity):
        self.model = model
        self.complexity = complexity


def stream(
    messages: list[dict],
    system: str,
    prompt: str,
    free_plan: bool = False,
) -> Generator[tuple[str, RouterResult | None], None, None]:
    """
    Classifies the prompt, picks the best available model, and streams the
    response token-by-token.

    Args:
        messages:  Full conversation history (role/content dicts)
        system:    System prompt string
        prompt:    Latest user message (used for classification)
        free_plan: If True, only zero-cost models are used

    Yields:
        ("meta",  RouterResult)   — once at start with routing info
        ("text",  chunk_text)     — for each streamed token
        ("done",  total_tokens)   — at the end with token count
        ("error", error_message)  — if all models fail
    """
    complexity = classify(prompt)
    chains = _chains(free_plan=free_plan)
    model_chain = chains.get(complexity, [])

    if not model_chain:
        yield ("error", "No AI models configured. Add at least one API key to .env")
        return

    for entry in model_chain:
        model    = entry["model"]
        api_key  = entry.get("api_key")
        api_base = entry.get("api_base")

        try:
            yield ("meta", RouterResult(model=model, complexity=complexity))

            kwargs = dict(
                model=model,
                messages=[{"role": "system", "content": system}] + messages,
                max_tokens=8192,
                stream=True,
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

                # LiteLLM populates usage on the last chunk
                if hasattr(chunk, "usage") and chunk.usage:
                    input_tokens  = getattr(chunk.usage, "prompt_tokens", 0)
                    output_tokens = getattr(chunk.usage, "completion_tokens", 0)

            total = input_tokens + output_tokens
            yield ("done", total)
            return  # success — stop trying other models

        except Exception as exc:
            print(f"[RouteLLM] {model} failed: {str(exc)[:120]}")
            continue  # try next model in chain

    yield ("error", "All AI models failed. Please try again later.")
