import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.core.config import settings
from app.db.database import get_db
from app.models.user import User, PlanType
from app.api.v1.deps import get_current_user
from app.services.pricing import TOPUP_PACKS, CURRENCY_CONFIG

stripe.api_key = settings.STRIPE_SECRET_KEY

router = APIRouter(prefix="/billing", tags=["Billing"])

PRICE_MAP = {
    ("pro", "GBP"):  settings.STRIPE_PRICE_PRO_GBP,
    ("pro", "BRL"):  settings.STRIPE_PRICE_PRO_BRL,
    ("team", "GBP"): settings.STRIPE_PRICE_TEAM_GBP,
    ("team", "BRL"): settings.STRIPE_PRICE_TEAM_BRL,
}


class CheckoutRequest(BaseModel):
    plan: str           # "pro" or "team"
    currency: str       # "GBP" or "BRL"
    success_url: Optional[str] = "https://turion.network/dashboard/billing?success=1"
    cancel_url: Optional[str] = "https://turion.network/dashboard/billing?cancelled=1"


class TopupRequest(BaseModel):
    pack_id: str        # "starter" | "growth" | "pro_pack" | "scale"
    currency: str       # "GBP" or "BRL"
    success_url: Optional[str] = "https://turion.network/dashboard/billing?topup=1"
    cancel_url: Optional[str] = "https://turion.network/dashboard/billing?cancelled=1"


@router.post("/create-checkout")
def create_checkout(
    body: CheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Creates a Stripe Checkout Session and returns the URL.
    The frontend redirects the user to this URL to complete payment.
    """
    price_key = (body.plan.lower(), body.currency.upper())
    price_id = PRICE_MAP.get(price_key)

    if not price_id:
        raise HTTPException(status_code=400, detail=f"Invalid plan or currency: {price_key}")

    # Create or reuse Stripe Customer
    if not current_user.stripe_customer_id:
        customer = stripe.Customer.create(
            email=current_user.email,
            name=current_user.name,
            metadata={"user_id": str(current_user.id)},
        )
        current_user.stripe_customer_id = customer.id
        db.commit()

    session = stripe.checkout.Session.create(
        customer=current_user.stripe_customer_id,
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=body.success_url,
        cancel_url=body.cancel_url,
        metadata={"user_id": str(current_user.id), "plan": body.plan},
        subscription_data={
            "metadata": {"user_id": str(current_user.id), "plan": body.plan}
        },
        allow_promotion_codes=True,
    )

    return {"checkout_url": session.url, "session_id": session.id}


@router.get("/token-packs")
def list_token_packs():
    """Returns all available token top-up packs with prices."""
    return {"packs": TOPUP_PACKS}


@router.post("/buy-tokens")
def buy_tokens(
    body: TopupRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Creates a one-time Stripe Checkout for a token top-up pack.
    Tokens are added to the user's balance after payment succeeds (via webhook).
    """
    pack = TOPUP_PACKS.get(body.pack_id)
    if not pack:
        raise HTTPException(status_code=400, detail=f"Unknown pack: {body.pack_id}")

    currency = body.currency.upper()
    if currency not in CURRENCY_CONFIG:
        raise HTTPException(status_code=400, detail=f"Unsupported currency: {currency}")

    unit_amount = pack["prices"].get(currency)
    if not unit_amount:
        raise HTTPException(status_code=400, detail=f"Pack {body.pack_id} not available in {currency}")

    # Create or reuse Stripe Customer
    if not current_user.stripe_customer_id:
        customer = stripe.Customer.create(
            email=current_user.email,
            name=current_user.name,
            metadata={"user_id": str(current_user.id)},
        )
        current_user.stripe_customer_id = customer.id
        db.commit()

    stripe_currency = CURRENCY_CONFIG[currency]["stripe_code"]

    session = stripe.checkout.Session.create(
        customer=current_user.stripe_customer_id,
        mode="payment",
        line_items=[{
            "price_data": {
                "currency": stripe_currency,
                "unit_amount": unit_amount,
                "product_data": {
                    "name": f"Turion Tokens — {pack['label']}",
                    "description": f"One-time top-up: {pack['tokens']:,} tokens added to your account. Never expire.",
                },
            },
            "quantity": 1,
        }],
        success_url=body.success_url,
        cancel_url=body.cancel_url,
        metadata={
            "user_id": str(current_user.id),
            "topup_pack": body.pack_id,
            "topup_tokens": str(pack["tokens"]),
            "payment_type": "topup",
        },
    )

    return {"checkout_url": session.url, "session_id": session.id}


@router.post("/create-portal")
def create_portal(
    current_user: User = Depends(get_current_user),
):
    """
    Returns a Stripe Customer Portal URL so the user can manage/cancel their subscription.
    """
    if not current_user.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No active subscription found")

    session = stripe.billing_portal.Session.create(
        customer=current_user.stripe_customer_id,
        return_url="https://turion.network/dashboard/billing",
    )
    return {"portal_url": session.url}


@router.post("/webhook", include_in_schema=False)
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="stripe-signature"),
    db: Session = Depends(get_db),
):
    """
    Receives Stripe events. Stripe calls this URL automatically after payment.
    Must be registered in the Stripe Dashboard under Webhooks.
    """
    payload = await request.body()

    try:
        event = stripe.Webhook.construct_event(
            payload, stripe_signature, settings.STRIPE_WEBHOOK_SECRET
        )
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    _handle_event(event, db)
    return JSONResponse({"received": True})


def _handle_event(event: dict, db: Session):
    """Maps Stripe events to database updates."""
    etype = event["type"]
    data = event["data"]["object"]

    if etype == "checkout.session.completed":
        meta = data.get("metadata", {})
        user_id = meta.get("user_id")
        payment_type = meta.get("payment_type", "subscription")

        if payment_type == "topup":
            # One-time token top-up purchase
            tokens = int(meta.get("topup_tokens", 0))
            if user_id and tokens:
                _add_topup_tokens(db, user_id, tokens)
        else:
            # Subscription upgrade
            plan = meta.get("plan")
            subscription_id = data.get("subscription")
            if user_id and plan:
                _upgrade_user(db, user_id, plan, subscription_id)

    elif etype in ("customer.subscription.deleted", "customer.subscription.paused"):
        sub = data
        customer_id = sub.get("customer")
        _downgrade_user_by_customer(db, customer_id)

    elif etype == "customer.subscription.updated":
        sub = data
        customer_id = sub.get("customer")
        new_plan = sub.get("metadata", {}).get("plan")
        if new_plan and sub.get("status") == "active":
            user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
            if user:
                user.plan = PlanType(new_plan)
                db.commit()

    elif etype == "invoice.paid":
        # Fires every billing cycle (monthly). Reset the monthly token counter.
        # This ensures Pro/Team users get their full allocation back each month.
        invoice = data
        customer_id = invoice.get("customer")
        billing_reason = invoice.get("billing_reason", "")
        # Only reset on renewals, not on the initial subscription creation
        # (initial creation is handled by checkout.session.completed)
        if billing_reason == "subscription_cycle":
            _reset_monthly_tokens(db, customer_id)


def _upgrade_user(db: Session, user_id: str, plan: str, subscription_id: str):
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        user.plan = PlanType(plan)
        if subscription_id:
            user.stripe_subscription_id = subscription_id
        db.commit()


def _reset_monthly_tokens(db: Session, customer_id: str):
    """Called every billing cycle renewal. Resets the monthly token counter."""
    user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    if user:
        user.tokens_used_month = 0
        db.commit()


def _add_topup_tokens(db: Session, user_id: str, tokens: int):
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        user.tokens_topup_balance += tokens
        db.commit()


def _downgrade_user_by_customer(db: Session, customer_id: str):
    user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    if user:
        user.plan = PlanType.free
        user.stripe_subscription_id = None
        db.commit()
