"""
TURION NETWORK — PRICING CONFIGURATION
=======================================
This file is the single source of truth for:

  1. AI provider costs (what WE pay)
  2. Our markup and credit system
  3. Token top-up packs (what USERS pay)
  4. Monthly included tokens per subscription plan

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOW THE CREDIT SYSTEM WORKS (READ THIS FIRST)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

We sell "Turion Tokens" (TT) to users. 1 TT = 1 AI token (input or output).

Users get tokens in two ways:
  A) Monthly allocation — included in their subscription plan (resets each month)
  B) Top-up packs — one-time purchase, never expire

Token accounting (per user row):
  - tokens_used_month   → how many monthly-included tokens consumed so far this month
  - tokens_topup_balance → purchased tokens remaining (never reset)

Priority: monthly tokens are consumed first, then topup balance.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AI PROVIDER COSTS (per 1M tokens, USD, March 2026)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Update these whenever a provider changes their prices.
Source: provider API docs, pricepertoken.com

Provider         | Model                        | Input $/M | Output $/M | Notes
-----------------|------------------------------|-----------|------------|----------------------------
Z.ai (Zhipu)     | glm-4.7-flash                | FREE      | FREE       | Use for free-plan users
Z.ai (Zhipu)     | glm-4.5-flash                | FREE      | FREE       | Fallback free model
Z.ai (Zhipu)     | glm-4.7-flashx               | 0.07      | 0.40       | Ultra-cheap, fast
Z.ai (Zhipu)     | glm-4.7                      | 0.60      | 2.20       | Good quality, reasonable cost
Z.ai (Zhipu)     | glm-5                        | 1.00      | 3.20       | Flagship, frontier quality
Z.ai (Zhipu)     | glm-5-code                   | 1.20      | 5.00       | Code specialist (SWE-bench top)
OpenAI           | gpt-4o-mini                  | 0.15      | 0.60       | Best budget OpenAI model
OpenAI           | gpt-4o                       | 2.50      | 10.00      | Premium quality
xAI              | grok-3-mini                  | 0.30      | 0.50       | Fast, cheap reasoning
xAI              | grok-4-fast-non-reasoning    | 0.20      | 0.50       | *** BEST VALUE *** frontier speed
xAI              | grok-code-fast-1             | 0.20      | 1.50       | Code-optimised fast model
xAI              | grok-3                       | 3.00      | 15.00      | Premium (avoid unless needed)
Anthropic        | claude-haiku-4-5             | 1.00      | 5.00       | Reliable, mid-tier
Anthropic        | claude-sonnet-4-6            | 3.00      | 15.00      | Premium quality fallback

Estimated blended avg cost per 1K tokens (input+output combined):
  LOW tasks    → ~$0.0001  (using free GLM models)
  MEDIUM tasks → ~$0.0003  (using grok-4-fast)
  HIGH tasks   → ~$0.0007  (using grok-4-fast / GLM-5-Code)
  Blended avg  → ~$0.0005 per 1K tokens

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUR MARKUP & PROFITABILITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

We charge users $0.003 per 1K tokens = 6x blended cost markup.
This covers: AI costs + infrastructure + Stripe fees (2.9%) + profit.

Subscription economics (example at 50 Pro subscribers):
  Revenue:  50 × £49  = £2,450/month
  AI cost:  50 × 3M tokens × $0.0005/K = $75/month (~£60)
  Margin:   ~97%  (before infra, Stripe, support)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TO ADJUST PRICES IN THE FUTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Update MONTHLY_TOKEN_LIMITS to change subscription allocations
2. Update TOPUP_PACKS to change pack sizes or prices
3. Update the cost table above for reference
4. Run: python scripts/create_stripe_prices.py  (if subscription price changed)
5. Update STRIPE_PRICE_* keys in .env if subscription pricing changed
6. No code changes needed for topup packs — prices are inline via Stripe price_data
"""

from app.models.user import PlanType

# ── Monthly token allocations per plan ───────────────────────────────────────
# These reset on the 1st of each month via the Stripe webhook (or cron job).

MONTHLY_TOKEN_LIMITS: dict[PlanType, int] = {
    PlanType.free: 50_000,       # 50K  — served by FREE GLM models (zero AI cost)
    PlanType.pro:  3_000_000,    # 3M   — priced at £49/month
    PlanType.team: 10_000_000,   # 10M  — priced at £129/month
}

# ── Token Top-up Packs ────────────────────────────────────────────────────────
# One-time purchases. Tokens never expire.
# Prices are in the SMALLEST currency unit (pence for GBP, centavos for BRL).
#
# Cost breakdown (approximate, assuming $0.0005/K blended AI cost):
#   500K  tokens → ~$0.25 AI cost  → we charge £4    → ~93% gross margin
#   2M    tokens → ~$1.00 AI cost  → we charge £14   → ~93% gross margin
#   5M    tokens → ~$2.50 AI cost  → we charge £30   → ~92% gross margin
#   15M   tokens → ~$7.50 AI cost  → we charge £75   → ~90% gross margin
#
# Note: BRL prices assume 1 GBP ≈ 6.5 BRL (adjust if FX changes significantly)

TOPUP_PACKS: dict[str, dict] = {
    "starter": {
        "tokens":  500_000,
        "label":   "500K tokens",
        "prices":  {"GBP": 400,   "BRL": 2_500},   # pence / centavos
        "display": {"GBP": "£4",  "BRL": "R$ 25"},
    },
    "growth": {
        "tokens":  2_000_000,
        "label":   "2M tokens",
        "prices":  {"GBP": 1_400,  "BRL": 8_500},
        "display": {"GBP": "£14", "BRL": "R$ 85"},
    },
    "pro_pack": {
        "tokens":  5_000_000,
        "label":   "5M tokens",
        "prices":  {"GBP": 3_000,  "BRL": 18_000},
        "display": {"GBP": "£30", "BRL": "R$ 180"},
    },
    "scale": {
        "tokens":  15_000_000,
        "label":   "15M tokens",
        "prices":  {"GBP": 7_500,  "BRL": 45_000},
        "display": {"GBP": "£75", "BRL": "R$ 450"},
    },
}

# ── Currency metadata ─────────────────────────────────────────────────────────
CURRENCY_CONFIG: dict[str, dict] = {
    "GBP": {"stripe_code": "gbp", "symbol": "£"},
    "BRL": {"stripe_code": "brl", "symbol": "R$"},
}
