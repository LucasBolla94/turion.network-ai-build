"""
TURION ROUTELLM
===============
Classifies each prompt and routes it to the best model.
Falls back automatically if a model fails or is unavailable.

Complexity tiers
----------------
HIGH   → Build full apps, complex architecture, multi-file generation
MEDIUM → Edit/fix code, add a feature, explain code
LOW    → Short questions, simple text, greetings

Model priority (per tier)
-------------------------
HIGH:   grok-3  →  gpt-4o          →  claude-sonnet-4-6
MEDIUM: gpt-4o  →  grok-3          →  gpt-4o-mini
LOW:    gpt-4o-mini  →  grok-3-mini
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


# ── keyword sets ─────────────────────────────────────────────────────────────

_HIGH_KEYWORDS = {
    "build", "create", "generate", "make", "develop", "design",
    "full app", "full-stack", "complete", "entire", "from scratch",
    "landing page", "dashboard", "saas", "platform", "system",
    "website", "web app", "crie", "construa", "desenvolva", "gere",
    "crea", "crée", "créer", "construire",
}

_MEDIUM_KEYWORDS = {
    "fix", "edit", "update", "change", "modify", "refactor", "improve",
    "add", "remove", "adjust", "rename", "move", "convert",
    "corrige", "edite", "atualize", "mude", "adicione", "remova",
    "corriger", "modifier", "ajouter", "arregla", "cambia",
    "explain", "how does", "what is", "why does", "help me",
}

_CODE_SIGNALS = {
    "```", "html", "css", "javascript", "python", "function",
    "class", "component", "api", "endpoint", "database", "sql",
    "hook", "useState", "useEffect",
}


def classify(prompt: str) -> Complexity:
    """Determine prompt complexity based on keywords and heuristics."""
    p = prompt.lower()
    words = set(re.split(r"\W+", p))

    # Long prompts building something → HIGH
    if len(prompt) > 200 and _HIGH_KEYWORDS & words:
        return Complexity.HIGH

    if _HIGH_KEYWORDS & words:
        return Complexity.HIGH

    # Code snippets or medium-length edit requests
    has_code = any(sig in p for sig in _CODE_SIGNALS)
    if has_code or (_MEDIUM_KEYWORDS & words):
        return Complexity.MEDIUM

    return Complexity.LOW


# ── model chains per tier ─────────────────────────────────────────────────────

def _chains() -> dict[Complexity, list[dict]]:
    """
    Returns model chains.  Each entry has:
      - model: LiteLLM model string
      - api_key: from env
      - api_base: optional (for xAI)
    Only includes models whose keys are actually set.
    """
    ant  = os.getenv("ANTHROPIC_API_KEY", "")
    oai  = os.getenv("OPENAI_API_KEY", "")
    xai  = os.getenv("XAI_API_KEY", "")

    grok3      = {"model": "xai/grok-3",          "api_key": xai,  "api_base": "https://api.x.ai/v1"} if xai else None
    grok3mini  = {"model": "xai/grok-3-mini",      "api_key": xai,  "api_base": "https://api.x.ai/v1"} if xai else None
    gpt4o      = {"model": "openai/gpt-4o",         "api_key": oai} if oai else None
    gpt4omini  = {"model": "openai/gpt-4o-mini",    "api_key": oai} if oai else None
    claude     = {"model": "anthropic/claude-sonnet-4-6", "api_key": ant} if ant else None

    def chain(*models):
        return [m for m in models if m is not None]

    return {
        Complexity.HIGH:   chain(grok3, gpt4o, claude, gpt4omini),
        Complexity.MEDIUM: chain(gpt4o, grok3, claude, gpt4omini, grok3mini),
        Complexity.LOW:    chain(gpt4omini, grok3mini, gpt4o),
    }


# ── public API ────────────────────────────────────────────────────────────────

class RouterResult:
    def __init__(self, model: str, complexity: Complexity):
        self.model = model
        self.complexity = complexity


def stream(
    messages: list[dict],
    system: str,
    prompt: str,
) -> Generator[tuple[str, RouterResult | None], None, None]:
    """
    Classifies the prompt, picks the best available model, and streams the
    response token-by-token.

    Yields:
        ("text",  chunk_text)       — while streaming
        ("meta",  RouterResult)     — once, at the start, with routing info
        ("done",  total_tokens)     — at the end
        ("error", error_message)    — if all models fail
    """
    complexity = classify(prompt)
    chains = _chains()
    model_chain = chains.get(complexity, [])

    if not model_chain:
        yield ("error", "No AI models configured. Please add at least one API key.")
        return

    for entry in model_chain:
        model      = entry["model"]
        api_key    = entry.get("api_key")
        api_base   = entry.get("api_base")

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

            full_text    = ""
            input_tokens = 0
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
            # Log and try next model in chain
            err = str(exc)
            short = err[:120]
            print(f"[RouteLLM] {model} failed: {short}")
            continue  # try next

    yield ("error", "All AI models failed. Please try again later.")
