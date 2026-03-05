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
        user_id = data.get("metadata", {}).get("user_id")
        plan = data.get("metadata", {}).get("plan")
        subscription_id = data.get("subscription")
        if user_id and plan:
            _upgrade_user(db, user_id, plan, subscription_id)

    elif etype in ("customer.subscription.deleted", "customer.subscription.paused"):
        sub = data
        customer_id = sub.get("customer")
        _downgrade_user_by_customer(db, customer_id)

    elif etype == "customer.subscription.updated":
        sub = data
        # Handle plan changes via Stripe Portal
        customer_id = sub.get("customer")
        new_plan = sub.get("metadata", {}).get("plan")
        if new_plan and sub.get("status") == "active":
            user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
            if user:
                user.plan = PlanType(new_plan)
                db.commit()


def _upgrade_user(db: Session, user_id: str, plan: str, subscription_id: str):
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        user.plan = PlanType(plan)
        if subscription_id:
            user.stripe_subscription_id = subscription_id
        db.commit()


def _downgrade_user_by_customer(db: Session, customer_id: str):
    user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    if user:
        user.plan = PlanType.free
        user.stripe_subscription_id = None
        db.commit()
