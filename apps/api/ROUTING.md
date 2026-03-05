# Turion RouteLLM — Developer Reference

> **Maintained by:** Turion Network engineering team
> **Last updated:** March 2026
> **Key files:** `app/services/router.py`, `app/services/pricing.py`

---

## How it works

Every user message goes through 3 stages:

```
User message → Classify complexity → Select model chain → Stream response
                (HIGH/MEDIUM/LOW)      (cheapest first)
```

The router tries models in order. If one fails (rate limit, outage, error), it
automatically falls back to the next one. The user never sees an error unless
ALL models fail.

---

## Complexity tiers

| Tier | Triggers | Examples |
|------|----------|---------|
| **HIGH** | Keywords: build, create, generate, crie, desenvolva + code signals | "Build a dashboard", "Create a SaaS landing page" |
| **MEDIUM** | Keywords: fix, edit, explain, refactor + code blocks | "Fix this bug", "Explain this function" |
| **LOW** | Everything else | "Hello", "What is React?", "Thanks" |

Free-plan users always use the **FREE tier chain** regardless of complexity.

---

## Model chains (March 2026 costs)

### HIGH complexity

| Priority | Model | Input $/M | Output $/M | Notes |
|----------|-------|-----------|------------|-------|
| 1 | `grok-4-fast-non-reasoning` | $0.20 | $0.50 | Best value frontier, 2M context |
| 2 | `grok-code-fast-1` | $0.20 | $1.50 | xAI code specialist |
| 3 | `glm-5-code` (Z.ai) | $1.20 | $5.00 | Zhipu code champion, top SWE-bench |
| 4 | `gpt-4o` | $2.50 | $10.00 | Proven quality fallback |
| 5 | `claude-sonnet-4-6` | $3.00 | $15.00 | Premium Anthropic fallback |
| 6 | `grok-3` | $3.00 | $15.00 | xAI premium fallback |

### MEDIUM complexity

| Priority | Model | Input $/M | Output $/M | Notes |
|----------|-------|-----------|------------|-------|
| 1 | `grok-4-fast-non-reasoning` | $0.20 | $0.50 | Fast + capable |
| 2 | `gpt-4o-mini` | $0.15 | $0.60 | Lightweight, cheap |
| 3 | `glm-4.7` (Z.ai) | $0.60 | $2.20 | Z.ai quality mid-tier |
| 4 | `claude-haiku-4-5` | $1.00 | $5.00 | Reliable Anthropic mid |
| 5 | `gpt-4o` | $2.50 | $10.00 | Last resort quality |

### LOW complexity

| Priority | Model | Input $/M | Output $/M | Notes |
|----------|-------|-----------|------------|-------|
| 1 | `glm-4.7-flash` (Z.ai) | **FREE** | **FREE** | Primary, zero cost |
| 2 | `gpt-4o-mini` | $0.15 | $0.60 | OpenAI cheap fallback |
| 3 | `grok-3-mini` | $0.30 | $0.50 | xAI cheap fallback |
| 4 | `glm-4.7-flashx` (Z.ai) | $0.07 | $0.40 | Ultra-cheap Z.ai |

### FREE plan users (all tiers)

| Priority | Model | Cost |
|----------|-------|------|
| 1 | `glm-4.7-flash` | FREE |
| 2 | `glm-4.5-flash` | FREE |
| 3 | `gpt-4o-mini` | $0.15/$0.60 (last resort) |

---

## Token & Credit System

### Monthly plan allocations

| Plan | Tokens/month | Price |
|------|-------------|-------|
| Free | 50,000 | £0 |
| Pro | 3,000,000 | £49/month |
| Team | 10,000,000 | £129/month |

### Top-up packs (one-time, never expire)

| Pack ID | Tokens | GBP | BRL | Our cost (est.) | Margin |
|---------|--------|-----|-----|-----------------|--------|
| `starter` | 500K | £4 | R$ 25 | ~$0.25 | ~93% |
| `growth` | 2M | £14 | R$ 85 | ~$1.00 | ~93% |
| `pro_pack` | 5M | £30 | R$ 180 | ~$2.50 | ~92% |
| `scale` | 15M | £75 | R$ 450 | ~$7.50 | ~90% |

### Token accounting

Users have two token buckets:
- `tokens_used_month` — monthly included tokens consumed (resets on billing cycle)
- `tokens_topup_balance` — purchased tokens (never expires)

Monthly tokens are consumed first. When the monthly limit is reached, topup
balance is used instead.

---

## Adding a new AI provider

1. Add the API key to `.env` and `app/core/config.py`
2. Look up the model name in LiteLLM docs (or use `openai/MODEL_NAME` for OpenAI-compatible APIs)
3. Add the model entry in `app/services/router.py` inside `_chains()`
4. Update the cost table in `app/services/pricing.py` (top docstring)
5. Update `app/api/v1/endpoints/health.py` providers dict
6. Update this file

---

## Updating prices / token packs

All pricing lives in `app/services/pricing.py`:

```python
# Change monthly token allocations:
MONTHLY_TOKEN_LIMITS = {
    PlanType.free: 50_000,   # change this number
    PlanType.pro:  3_000_000,
    PlanType.team: 10_000_000,
}

# Change top-up pack prices (in smallest currency unit: pence/centavos):
TOPUP_PACKS = {
    "starter": {
        "tokens": 500_000,
        "prices": {"GBP": 400, "BRL": 2_500},   # 400 pence = £4
        ...
    },
}
```

No Stripe Dashboard changes needed for top-up packs — prices are passed
inline to Stripe Checkout (`price_data`). For subscription price changes,
you must also update Stripe prices and the `.env` `STRIPE_PRICE_*` keys.

---

## Stripe webhook events handled

| Event | Action |
|-------|--------|
| `checkout.session.completed` (subscription) | Upgrade user plan |
| `checkout.session.completed` (topup) | Add tokens to `tokens_topup_balance` |
| `customer.subscription.deleted` | Downgrade to free plan |
| `customer.subscription.paused` | Downgrade to free plan |
| `customer.subscription.updated` | Update plan from metadata |

---

## Environment variables required

```bash
# AI Providers (add keys to activate models)
XAI_API_KEY=           # xAI Grok models
OPENAI_API_KEY=        # OpenAI GPT models
ANTHROPIC_API_KEY=     # Claude models
ZAI_API_KEY=           # Z.ai / Zhipu GLM models
GROQ_API_KEY=          # Groq (optional, not in active chains yet)
GOOGLE_API_KEY=        # Gemini (optional, not in active chains yet)

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_PRO_GBP=
STRIPE_PRICE_PRO_BRL=
STRIPE_PRICE_TEAM_GBP=
STRIPE_PRICE_TEAM_BRL=
```
