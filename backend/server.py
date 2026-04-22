from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import Response, RedirectResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr, field_validator
import re
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, timedelta
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import jwt
import bcrypt as bcrypt_lib
from io import BytesIO
import cloudinary
import cloudinary.uploader
from pywebpush import webpush, WebPushException
import json
import asyncio

# Configure logging early
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security Configuration
SECRET_KEY = os.environ.get('JWT_SECRET_KEY')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
SOLD_DISPLAY_MINUTES = int(os.environ.get("SOLD_DISPLAY_MINUTES", "30"))
BID_TIMER_EXTENSION_HOURS = int(os.environ.get("BID_TIMER_EXTENSION_HOURS", "2"))
MAX_TIMER_EXTENSIONS = int(os.environ.get("MAX_TIMER_EXTENSIONS", "2"))

security = HTTPBearer(auto_error=False)

# ==================== CLOUDINARY STORAGE ====================
cloudinary.config(
    cloud_name=os.environ.get("CLOUDINARY_CLOUD_NAME"),
    api_key=os.environ.get("CLOUDINARY_API_KEY"),
    api_secret=os.environ.get("CLOUDINARY_API_SECRET"),
    secure=True
)

ALLOWED_MEDIA_TYPES = {
    "image/jpeg", "image/png", "image/webp",
    "video/mp4", "video/quicktime"
}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

def put_object(data: bytes, content_type: str) -> dict:
    """Upload bytes to Cloudinary; returns dict with 'path' (secure URL) and 'public_id'."""
    resource_type = "video" if content_type.startswith("video/") else "image"
    result = cloudinary.uploader.upload(
        BytesIO(data),
        resource_type=resource_type,
        folder="cardamom-spices/products",
        unique_filename=True,
    )
    return {"path": result["secure_url"], "public_id": result["public_id"], "size": result.get("bytes", len(data))}

# ==================== LIFESPAN ====================
@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────────
    if not os.environ.get("ADMIN_PASSWORD"):
        logger.warning("⚠️  Using default admin password — set ADMIN_PASSWORD in .env before deploying!")

    # ─── Data migrations for 3-role system ───

    # Migrate old "customer" role to "buyer"
    migrated = await db.users.update_many(
        {"role": "customer"},
        {"$set": {"role": "buyer"}}
    )
    if migrated.modified_count > 0:
        logger.info(f"Migrated {migrated.modified_count} users from 'customer' to 'buyer' role")

    # Migrate old products without seller fields
    await db.products.update_many(
        {"seller_id": {"$exists": False}},
        {"$set": {"seller_id": "", "seller_name": "Cardamom Spices Centre", "approval_status": "approved"}}
    )
    # Also migrate products that have seller_id but no approval_status
    await db.products.update_many(
        {"approval_status": {"$exists": False}},
        {"$set": {"approval_status": "approved"}}
    )

    # Migrate existing approved products without listing_status
    await db.products.update_many(
        {"listing_status": {"$exists": False}, "approval_status": "approved"},
        {"$set": {"listing_status": "active", "bid_duration_hours": 4, "extension_count": 0, "total_bids_received": 0}}
    )
    await db.products.update_many(
        {"listing_status": {"$exists": False}},
        {"$set": {"listing_status": "active", "bid_duration_hours": 4, "extension_count": 0, "total_bids_received": 0}}
    )

    # Migrate old bids: rename customer_* to buyer_*
    old_bids = await db.bids.count_documents({"customer_id": {"$exists": True}, "buyer_id": {"$exists": False}})
    if old_bids > 0:
        await db.bids.update_many(
            {"customer_id": {"$exists": True}, "buyer_id": {"$exists": False}},
            [{"$set": {
                "buyer_id": "$customer_id",
                "buyer_name": "$customer_name",
                "buyer_email": "$customer_email",
                "buyer_phone": "$customer_phone",
                "buyer_company": "$customer_company",
                "seller_id": {"$ifNull": ["$seller_id", ""]},
                "seller_name": {"$ifNull": ["$seller_name", ""]},
            }}]
        )
        logger.info(f"Migrated {old_bids} bids from customer_* to buyer_* fields")

    # Create admin user if not exists
    admin_email = "admin@cardamomspicescentre.com"
    existing_admin = await db.users.find_one({"email": admin_email})
    if not existing_admin:
        admin = {
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password": get_password_hash(ADMIN_PASSWORD),
            "full_name": "Admin User",
            "company_name": "Cardamom Spices Centre",
            "country": "India",
            "phone": "+91-8838226519",
            "role": "admin",
            "status": "approved",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(admin)
        logger.info(f"Admin user created: {admin_email}")

    # Ensure database indexes
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("phone", unique=True, sparse=True)
        await db.products.create_index("seller_id")
        await db.products.create_index("listing_status")
        await db.bids.create_index("product_id")
        await db.bids.create_index("buyer_id")
        logger.info("Database indexes ensured")
    except Exception as e:
        logger.warning(f"Index creation warning (may already exist): {e}")

    logger.info("Cardamom Spices Centre B2B Marketplace v3.0 ready")

    # Start background bid timer task
    timer_task = asyncio.create_task(background_timer_check())

    yield  # ── application runs here ──────────────────────────────

    # ── Shutdown ─────────────────────────────────────────────────
    timer_task.cancel()
    try:
        await timer_task
    except asyncio.CancelledError:
        pass
    client.close()
    logger.info("Database connection closed")


# ==================== BACKGROUND TIMER ====================

async def _check_expired_products():
    """Mark active products as expired once bid_end_time has passed."""
    now = datetime.now(timezone.utc)
    expired = await db.products.find(
        {
            "listing_status": "active",
            "bid_end_time": {"$ne": None, "$lt": now.isoformat()}
        },
        {"_id": 0}
    ).to_list(200)

    for product in expired:
        await db.products.update_one(
            {"id": product["id"]},
            {"$set": {"listing_status": "expired"}}
        )
        logger.info(f"Product expired: {product['id']} ({product['name']})")
        # Notify seller (push + email)
        seller_id = product.get("seller_id")
        if seller_id:
            try:
                await send_push_to_user(
                    seller_id,
                    "Bidding Closed",
                    f"Bidding for '{product['name']}' has ended. Review your bids.",
                    "/seller"
                )
            except Exception as e:
                logger.warning(f"Push failed for expired product: {e}")
            try:
                seller = await db.users.find_one({"id": seller_id}, {"_id": 0, "email": 1})
                if seller and seller.get("email"):
                    await _email_timer_expired_to_seller(product, seller["email"])
            except Exception as e:
                logger.warning(f"Expiry email failed for product {product['id']}: {e}")


async def _archive_sold_products():
    """Move sold products to archived once SOLD_DISPLAY_MINUTES have passed."""
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=SOLD_DISPLAY_MINUTES)
    await db.products.update_many(
        {
            "listing_status": "sold",
            "sold_at": {"$ne": None, "$lt": cutoff.isoformat()}
        },
        {"$set": {"listing_status": "archived"}}
    )


async def _check_timer_warnings():
    """Email sellers whose listing has ~30 minutes left (between 28-32 min window to avoid double-sends)."""
    now = datetime.now(timezone.utc)
    warning_from = (now + timedelta(minutes=28)).isoformat()
    warning_to   = (now + timedelta(minutes=32)).isoformat()
    soon = await db.products.find(
        {
            "listing_status": "active",
            "bid_end_time": {"$gte": warning_from, "$lte": warning_to},
            "timer_warning_sent": {"$ne": True},
        },
        {"_id": 0}
    ).to_list(100)

    for product in soon:
        try:
            seller_id = product.get("seller_id")
            if seller_id:
                seller = await db.users.find_one({"id": seller_id}, {"_id": 0, "email": 1})
                if seller and seller.get("email"):
                    await _email_timer_warning_to_seller(product, seller["email"])
            # Mark so we don't send again in the next loop
            await db.products.update_one({"id": product["id"]}, {"$set": {"timer_warning_sent": True}})
        except Exception as e:
            logger.warning(f"Timer warning email failed for product {product.get('id')}: {e}")


async def background_timer_check():
    """Run every 60 s: expire overdue listings, archive sold listings, send 30-min warnings."""
    while True:
        try:
            await _check_expired_products()
            await _archive_sold_products()
            await _check_timer_warnings()
        except Exception as e:
            logger.warning(f"Background timer error: {e}")
        await asyncio.sleep(60)


# ==================== APP ====================
app = FastAPI(lifespan=lifespan)
api_router = APIRouter(prefix="/api")

# ==================== PUSH NOTIFICATIONS ====================
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY")
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY")
VAPID_EMAIL = os.environ.get("VAPID_EMAIL", "mailto:cardamomspicescentre@gmail.com")

async def send_push_to_user(user_id: str, title: str, body: str, url: str = "/"):
    subscriptions = await db.push_subscriptions.find({"user_id": user_id}, {"_id": 0}).to_list(50)
    for sub in subscriptions:
        try:
            webpush(
                subscription_info=sub["subscription"],
                data=json.dumps({"title": title, "body": body, "url": url}),
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": VAPID_EMAIL}
            )
        except WebPushException as e:
            if e.response and e.response.status_code in (404, 410):
                await db.push_subscriptions.delete_one({"subscription.endpoint": sub["subscription"]["endpoint"]})
            logger.warning(f"Push failed for user {user_id}: {e}")
        except Exception as e:
            logger.warning(f"Push error: {e}")

async def send_push_to_admins(title: str, body: str, url: str = "/admin"):
    admins = await db.users.find({"role": "admin"}, {"_id": 0, "id": 1}).to_list(50)
    for admin in admins:
        await send_push_to_user(admin["id"], title, body, url)


# ==================== EMAIL HELPERS ====================
_SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
_SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
_SMTP_USERNAME = os.environ.get("SMTP_USERNAME", "")
_SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
_SMTP_FROM = os.environ.get("SMTP_FROM", "")
_ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "")


def _html_wrap(title: str, body_html: str) -> str:
    """Wrap email body in branded Cardamom Spices Centre HTML template."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f0;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f0;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
        <tr>
          <td style="background-color:#2d5a27;padding:32px 40px;text-align:center;">
            <div style="color:#c8a84b;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin-bottom:6px;">Premium B2B Trading</div>
            <div style="color:#ffffff;font-size:26px;font-weight:bold;letter-spacing:1px;">&#127807; Cardamom Spices Centre</div>
            <div style="color:#a8d5a2;font-size:12px;margin-top:6px;">Kerala's Trusted Cardamom Marketplace</div>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;color:#333333;font-size:15px;line-height:1.7;">
            {body_html}
          </td>
        </tr>
        <tr>
          <td style="background-color:#f0f0e8;border-top:3px solid #2d5a27;padding:24px 40px;text-align:center;">
            <div style="color:#2d5a27;font-weight:bold;font-size:14px;margin-bottom:6px;">Cardamom Spices Centre</div>
            <div style="color:#666666;font-size:12px;line-height:1.8;">
              Kerala, India &nbsp;|&nbsp; <a href="tel:+918838226519" style="color:#2d5a27;text-decoration:none;">+91-8838226519</a><br>
              <a href="mailto:cardamomspicescentre@gmail.com" style="color:#2d5a27;text-decoration:none;">cardamomspicescentre@gmail.com</a>
            </div>
            <div style="margin-top:12px;color:#999999;font-size:11px;">This is an automated notification from Cardamom Spices Centre B2B Platform.</div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


async def _smtp_send(to: str, subject: str, html: str):
    """Send a branded HTML email via SMTP (aiosmtplib + STARTTLS). Never raises."""
    if not _SMTP_USERNAME or not _SMTP_PASSWORD or not to:
        logger.info(f"SMTP not configured or no recipient — skipping: {subject}")
        return
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = _SMTP_FROM or _SMTP_USERNAME
        msg["To"] = to
        msg.attach(MIMEText(html, "html"))
        await aiosmtplib.send(
            msg,
            hostname=_SMTP_HOST,
            port=_SMTP_PORT,
            username=_SMTP_USERNAME,
            password=_SMTP_PASSWORD,
            start_tls=True,
        )
        logger.info(f"Email sent → {to}: {subject}")
    except Exception as e:
        logger.warning(f"Email send failed (to={to}): {e}")


# --- 1. New registration → admin ---
async def _email_new_registration(user) -> None:
    role_label = (getattr(user, 'role', None) or 'user').title()
    body = f"""
    <h2 style="color:#2d5a27;margin-top:0;">New {role_label} Registration</h2>
    <p>A new user has registered and is awaiting your approval.</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;">
      <tr><td style="padding:8px 12px;background:#f8f8f4;font-weight:bold;width:140px;">Name</td><td style="padding:8px 12px;">{user.full_name}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:bold;">Email</td><td style="padding:8px 12px;">{user.email}</td></tr>
      <tr><td style="padding:8px 12px;background:#f8f8f4;font-weight:bold;">Company</td><td style="padding:8px 12px;background:#f8f8f4;">{user.company_name or 'N/A'}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:bold;">Country</td><td style="padding:8px 12px;">{user.country or 'N/A'}</td></tr>
      <tr><td style="padding:8px 12px;background:#f8f8f4;font-weight:bold;">Phone</td><td style="padding:8px 12px;background:#f8f8f4;">{user.phone or 'N/A'}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:bold;">Role</td><td style="padding:8px 12px;">{role_label}</td></tr>
    </table>
    <p style="text-align:center;margin:28px 0;">
      <a href="https://cardamomspicescentre.com/admin" style="background-color:#2d5a27;color:#ffffff;padding:12px 28px;border-radius:5px;text-decoration:none;font-size:14px;font-weight:bold;">Review in Admin Dashboard &#8594;</a>
    </p>"""
    await _smtp_send(
        _ADMIN_EMAIL,
        f"New {role_label} Registration: {user.full_name} ({user.company_name or user.email})",
        _html_wrap(f"New {role_label} Registration", body),
    )


# --- 2. User approved → user ---
async def _email_user_approved(user: dict) -> None:
    role = user.get("role", "user")
    role_label = role.title()
    buyer_features = ""
    seller_features = ""
    if role in ("buyer", "both"):
        buyer_features = "<li>Browse active cardamom listings and place competitive bids</li>"
    if role in ("seller", "both"):
        seller_features = "<li>List your cardamom products for B2B trade</li><li>Manage incoming bids and close deals</li>"
    body = f"""
    <h2 style="color:#2d5a27;margin-top:0;">Welcome to Cardamom Spices Centre!</h2>
    <p>Dear <strong>{user.get('full_name', 'Valued Partner')}</strong>,</p>
    <p>We are pleased to inform you that your registration as a <strong>{role_label}</strong> has been
      <span style="color:#2d5a27;font-weight:bold;">approved</span>.
    </p>
    <p>You can now log in and access the full platform features:</p>
    <ul style="color:#555555;line-height:2.2;">
      {buyer_features}
      {seller_features}
    </ul>
    <p style="text-align:center;margin:28px 0;">
      <a href="https://cardamomspicescentre.com/login" style="background-color:#2d5a27;color:#ffffff;padding:12px 28px;border-radius:5px;text-decoration:none;font-size:14px;font-weight:bold;">Login to Your Account &#8594;</a>
    </p>
    <p>For assistance call us at <a href="tel:+918838226519" style="color:#2d5a27;">+91-8838226519</a>.</p>
    <p>We look forward to a successful trading partnership.</p>
    <p>Warm regards,<br><strong>Cardamom Spices Centre Team</strong></p>"""
    await _smtp_send(
        user.get("email", ""),
        "Your Account Has Been Approved — Cardamom Spices Centre",
        _html_wrap("Account Approved", body),
    )


# --- 3. User rejected → user ---
async def _email_user_rejected(user: dict) -> None:
    body = f"""
    <h2 style="color:#2d5a27;margin-top:0;">Registration Update</h2>
    <p>Dear <strong>{user.get('full_name', 'Applicant')}</strong>,</p>
    <p>Thank you for your interest in Cardamom Spices Centre.</p>
    <p>After reviewing your registration, we are unable to approve your account at this time.</p>
    <p>If you believe this is an error or would like clarification, please reach out to our team:</p>
    <ul style="color:#555555;line-height:2.2;">
      <li>Call: <a href="tel:+918838226519" style="color:#2d5a27;">+91-8838226519</a></li>
      <li>Email: <a href="mailto:cardamomspicescentre@gmail.com" style="color:#2d5a27;">cardamomspicescentre@gmail.com</a></li>
    </ul>
    <p>Regards,<br><strong>Cardamom Spices Centre Team</strong></p>"""
    await _smtp_send(
        user.get("email", ""),
        "Registration Update — Cardamom Spices Centre",
        _html_wrap("Registration Update", body),
    )


# --- 4. New bid placed → seller ---
async def _email_new_bid_to_seller(bid, product: dict, seller_email: str) -> None:
    qty_parts = []
    if getattr(bid, "quantity_kg", None):
        qty_parts.append(f"{bid.quantity_kg} kg")
    if getattr(bid, "quantity_lot", None):
        qty_parts.append(f"{bid.quantity_lot} lots")
    qty_str = " / ".join(qty_parts) or "Not specified"

    price_parts = []
    if getattr(bid, "price_per_kg", None):
        price_parts.append(f"{bid.currency} {bid.price_per_kg}/kg")
    if getattr(bid, "price_per_lot", None):
        price_parts.append(f"{bid.currency} {bid.price_per_lot}/lot")
    price_str = " / ".join(price_parts) or "Not specified"

    notes_row = ""
    if getattr(bid, "additional_notes", None):
        notes_row = f'<tr><td style="padding:8px 12px;background:#f8f8f4;font-weight:bold;vertical-align:top;">Notes</td><td style="padding:8px 12px;background:#f8f8f4;">{bid.additional_notes}</td></tr>'

    body = f"""
    <h2 style="color:#2d5a27;margin-top:0;">New Bid Received</h2>
    <p>You have received a new bid on your listing.</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;">
      <tr style="background:#2d5a27;color:#ffffff;"><td colspan="2" style="padding:10px 14px;font-weight:bold;">Product Details</td></tr>
      <tr><td style="padding:8px 12px;background:#f8f8f4;font-weight:bold;width:140px;">Product</td><td style="padding:8px 12px;background:#f8f8f4;">{product.get('name','')}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:bold;">Size</td><td style="padding:8px 12px;">{product.get('size','')}</td></tr>
      <tr style="background:#2d5a27;color:#ffffff;"><td colspan="2" style="padding:10px 14px;font-weight:bold;">Bid Details</td></tr>
      <tr><td style="padding:8px 12px;background:#f8f8f4;font-weight:bold;">Buyer</td><td style="padding:8px 12px;background:#f8f8f4;">{bid.buyer_name}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:bold;">Company</td><td style="padding:8px 12px;">{getattr(bid,'buyer_company',None) or 'N/A'}</td></tr>
      <tr><td style="padding:8px 12px;background:#f8f8f4;font-weight:bold;">Quantity</td><td style="padding:8px 12px;background:#f8f8f4;">{qty_str}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:bold;">Offered Price</td><td style="padding:8px 12px;color:#2d5a27;font-weight:bold;">{price_str}</td></tr>
      {notes_row}
    </table>
    <p style="text-align:center;margin:28px 0;">
      <a href="https://cardamomspicescentre.com/seller" style="background-color:#2d5a27;color:#ffffff;padding:12px 28px;border-radius:5px;text-decoration:none;font-size:14px;font-weight:bold;">Review Bid in Dashboard &#8594;</a>
    </p>
    <p>Please log in to accept or reject this bid before your listing timer expires.</p>"""
    await _smtp_send(
        seller_email,
        f"New Bid on '{product.get('name','Your Product')}' — Cardamom Spices Centre",
        _html_wrap("New Bid Received", body),
    )


# --- 5 & 6. Bid accepted / rejected → buyer ---
async def _email_bid_update_to_buyer(bid: dict, status: str, notes: str = None) -> None:
    buyer_email = bid.get("buyer_email", "")
    if not buyer_email:
        return

    qty_parts = []
    if bid.get("quantity_kg"):
        qty_parts.append(f"{bid['quantity_kg']} kg")
    if bid.get("quantity_lot"):
        qty_parts.append(f"{bid['quantity_lot']} lots")
    qty_str = " / ".join(qty_parts) or "N/A"

    price_parts = []
    if bid.get("price_per_kg"):
        price_parts.append(f"{bid.get('currency','INR')} {bid['price_per_kg']}/kg")
    if bid.get("price_per_lot"):
        price_parts.append(f"{bid.get('currency','INR')} {bid['price_per_lot']}/lot")
    price_str = " / ".join(price_parts) or "N/A"

    is_accepted = (status == "accepted")
    status_color = "#2d5a27" if is_accepted else "#c0392b"
    status_label = "Accepted" if is_accepted else "Rejected"
    status_icon = "&#10003;" if is_accepted else "&#10007;"

    if is_accepted:
        next_steps = """
        <div style="background:#e8f5e9;border-left:4px solid #2d5a27;padding:16px;margin:20px 0;border-radius:4px;">
          <strong style="color:#2d5a27;">Next Steps:</strong>
          <p style="margin:8px 0 0;">The seller will contact you shortly to finalise payment and delivery arrangements. Please keep your contact details updated in your profile.</p>
        </div>"""
    else:
        next_steps = """
        <div style="background:#fff8e1;border-left:4px solid #f0ad4e;padding:16px;margin:20px 0;border-radius:4px;">
          <strong>Not to worry —</strong> Browse other active listings and place a new bid on products that match your requirements.
        </div>"""

    notes_row = ""
    if notes:
        notes_row = f'<tr><td style="padding:8px 12px;font-weight:bold;">Seller Notes</td><td style="padding:8px 12px;">{notes}</td></tr>'

    body = f"""
    <h2 style="color:{status_color};margin-top:0;">{status_icon} Bid {status_label}</h2>
    <p>Dear <strong>{bid.get('buyer_name','Valued Customer')}</strong>,</p>
    <p>Your bid on <strong>{bid.get('product_name','the product')}</strong> has been
       <span style="color:{status_color};font-weight:bold;">{status_label.lower()}</span>.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;">
      <tr><td style="padding:8px 12px;background:#f8f8f4;font-weight:bold;width:140px;">Product</td><td style="padding:8px 12px;background:#f8f8f4;">{bid.get('product_name','')}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:bold;">Quantity</td><td style="padding:8px 12px;">{qty_str}</td></tr>
      <tr><td style="padding:8px 12px;background:#f8f8f4;font-weight:bold;">Your Price</td><td style="padding:8px 12px;background:#f8f8f4;">{price_str}</td></tr>
      {notes_row}
    </table>
    {next_steps}
    <p style="text-align:center;margin:28px 0;">
      <a href="https://cardamomspicescentre.com/dashboard" style="background-color:#2d5a27;color:#ffffff;padding:12px 28px;border-radius:5px;text-decoration:none;font-size:14px;font-weight:bold;">View Your Bids &#8594;</a>
    </p>
    <p>Thank you for trading with Cardamom Spices Centre.</p>
    <p>Warm regards,<br><strong>Cardamom Spices Centre Team</strong></p>"""
    await _smtp_send(
        buyer_email,
        f"Bid {status_label}: {bid.get('product_name','Your Bid')} — Cardamom Spices Centre",
        _html_wrap(f"Bid {status_label}", body),
    )


# --- 7. Timer expiring in ~30 minutes → seller ---
async def _email_timer_warning_to_seller(product: dict, seller_email: str) -> None:
    body = f"""
    <h2 style="color:#e67e22;margin-top:0;">&#9200; Bidding Closes in ~30 Minutes</h2>
    <p>Your listing is about to close. You have <strong>approximately 30 minutes</strong> left to review and accept bids.</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;">
      <tr><td style="padding:8px 12px;background:#f8f8f4;font-weight:bold;width:140px;">Product</td><td style="padding:8px 12px;background:#f8f8f4;">{product.get('name','')}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:bold;">Size</td><td style="padding:8px 12px;">{product.get('size','')}</td></tr>
      <tr><td style="padding:8px 12px;background:#f8f8f4;font-weight:bold;">Bids Received</td><td style="padding:8px 12px;background:#f8f8f4;">{product.get('total_bids_received', 0)}</td></tr>
    </table>
    <p>You can either accept a bid now or extend the timer by {BID_TIMER_EXTENSION_HOURS} hours
       (up to {MAX_TIMER_EXTENSIONS} extensions total) from your dashboard.</p>
    <p style="text-align:center;margin:28px 0;">
      <a href="https://cardamomspicescentre.com/seller" style="background-color:#2d5a27;color:#ffffff;padding:12px 28px;border-radius:5px;text-decoration:none;font-size:14px;font-weight:bold;">Manage Listing &#8594;</a>
    </p>"""
    await _smtp_send(
        seller_email,
        f"&#9200; 30 Min Left: '{product.get('name','Your Listing')}' — Cardamom Spices Centre",
        _html_wrap("Bidding Closes Soon", body),
    )


# --- 8. Timer expired → seller ---
async def _email_timer_expired_to_seller(product: dict, seller_email: str) -> None:
    body = f"""
    <h2 style="color:#c0392b;margin-top:0;">Bidding Period Has Ended</h2>
    <p>The bidding window for your listing has now closed.</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;">
      <tr><td style="padding:8px 12px;background:#f8f8f4;font-weight:bold;width:140px;">Product</td><td style="padding:8px 12px;background:#f8f8f4;">{product.get('name','')}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:bold;">Size</td><td style="padding:8px 12px;">{product.get('size','')}</td></tr>
      <tr><td style="padding:8px 12px;background:#f8f8f4;font-weight:bold;">Total Bids</td><td style="padding:8px 12px;background:#f8f8f4;">{product.get('total_bids_received', 0)}</td></tr>
    </table>
    <p>If you have pending bids to review, you can still extend the timer from your seller dashboard
       (if extensions remain).</p>
    <p style="text-align:center;margin:28px 0;">
      <a href="https://cardamomspicescentre.com/seller" style="background-color:#2d5a27;color:#ffffff;padding:12px 28px;border-radius:5px;text-decoration:none;font-size:14px;font-weight:bold;">Review Bids in Dashboard &#8594;</a>
    </p>
    <p>Need assistance? Call us at <a href="tel:+918838226519" style="color:#2d5a27;">+91-8838226519</a>.</p>"""
    await _smtp_send(
        seller_email,
        f"Bidding Closed: '{product.get('name','Your Listing')}' — Cardamom Spices Centre",
        _html_wrap("Bidding Period Ended", body),
    )


# --- 9. New product approved → all buyers ---
async def _email_buyers_new_product(product: dict, buyer_emails: list) -> None:
    """Fire-and-forget: send product notification to each buyer email in batches."""
    if not buyer_emails:
        return
    name = product.get("name", "New Cardamom Listing")
    size = product.get("size", "")
    seller_company = product.get("seller_company") or product.get("seller_name", "Verified Seller")
    currency_sym = "$" if product.get("base_price_currency") == "USD" else "₹"
    base_price = product.get("base_price")
    price_str = f"{currency_sym}{base_price:,.2f}/kg" if base_price else "On request"
    total_qty = product.get("total_quantity_kg")
    qty_str = f"{total_qty:,.0f} kg" if total_qty else "On request"
    duration_hrs = product.get("bid_duration_hours", 4)
    product_id = product.get("id", "")
    product_link = f"https://cardamomspicescentre.com/products/{product_id}"

    body = f"""
    <h2 style="color:#2d5a27;margin-top:0;">&#127807; New Cardamom Listing — Act Fast!</h2>
    <p>A new premium green cardamom lot is now live and open for bidding on Cardamom Spices Centre.</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;">
      <tr><td style="padding:8px 12px;background:#f8f8f4;font-weight:bold;width:140px;">Product</td><td style="padding:8px 12px;background:#f8f8f4;">{name}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:bold;">Grade / Size</td><td style="padding:8px 12px;">{size}</td></tr>
      <tr><td style="padding:8px 12px;background:#f8f8f4;font-weight:bold;">Seller</td><td style="padding:8px 12px;background:#f8f8f4;">{seller_company}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:bold;">Base Price</td><td style="padding:8px 12px;">{price_str}</td></tr>
      <tr><td style="padding:8px 12px;background:#f8f8f4;font-weight:bold;">Available Qty</td><td style="padding:8px 12px;background:#f8f8f4;">{qty_str}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:bold;">Bidding Window</td><td style="padding:8px 12px;">{duration_hrs} hour{"s" if duration_hrs != 1 else ""}</td></tr>
    </table>
    <p style="color:#c0392b;font-weight:bold;">&#9200; Bidding closes in {duration_hrs} hour{"s" if duration_hrs != 1 else ""}. Don't miss out!</p>
    <p style="text-align:center;margin:28px 0;">
      <a href="{product_link}" style="background-color:#2d5a27;color:#ffffff;padding:12px 28px;border-radius:5px;text-decoration:none;font-size:14px;font-weight:bold;">View &amp; Place Bid &#8594;</a>
    </p>
    <p>Questions? Call us at <a href="tel:+918838226519" style="color:#2d5a27;">+91-8838226519</a> or reply to this email.</p>"""

    subject = f"New Listing: {name} — Open for Bidding | Cardamom Spices Centre"
    html = _html_wrap("New Cardamom Listing", body)

    # Send in batches of 50 with a small delay between batches
    batch_size = 50
    for i in range(0, len(buyer_emails), batch_size):
        batch = buyer_emails[i:i + batch_size]
        for email in batch:
            await _smtp_send(email, subject, html)
        if i + batch_size < len(buyer_emails):
            await asyncio.sleep(0.5)

    logger.info(f"Buyer notifications sent for product '{name}' to {len(buyer_emails)} buyers")


# ==================== MODELS ====================

class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    size: str
    description: str
    features: List[str]
    image_url: str = ""
    media_paths: List[str] = Field(default_factory=list)
    seller_id: str = ""
    seller_name: str = ""
    seller_company: Optional[str] = None
    approval_status: Literal["pending", "approved", "rejected"] = "pending"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    # ── Pricing / quantity ────────────────────────────────────────
    base_price: Optional[float] = None
    base_price_currency: Literal["INR", "USD"] = "INR"
    minimum_quantity_kg: Optional[float] = None
    total_quantity_kg: Optional[float] = None
    remaining_quantity_kg: Optional[float] = None
    # ── Bid timer fields ──────────────────────────────────────────
    bid_start_time: Optional[datetime] = None
    bid_duration_hours: int = 4
    bid_end_time: Optional[datetime] = None
    listing_status: Literal["active", "expired", "sold", "archived", "pending_approval", "rejected"] = "active"
    sold_at: Optional[datetime] = None
    sold_to_buyer_id: Optional[str] = None
    sold_to_buyer_name: Optional[str] = None
    sold_price: Optional[float] = None
    sold_price_currency: Optional[str] = None
    total_bids_received: int = 0
    extension_count: int = 0

class ProductCreate(BaseModel):
    name: str
    size: str
    description: str
    features: List[str]
    image_url: str = ""
    media_paths: List[str] = Field(default_factory=list)
    bid_duration_hours: int = Field(default=4, ge=1, le=8)
    base_price: float
    base_price_currency: Literal["INR", "USD"] = "INR"
    minimum_quantity_kg: float
    total_quantity_kg: float

# ── Public-safe product response (hides buyer/trade details) ──────
class ProductPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    size: str
    description: str
    features: List[str]
    image_url: str = ""
    media_paths: List[str] = Field(default_factory=list)
    seller_name: str = ""
    seller_company: Optional[str] = None
    approval_status: Literal["pending", "approved", "rejected"] = "pending"
    created_at: datetime
    base_price: Optional[float] = None
    base_price_currency: Literal["INR", "USD"] = "INR"
    minimum_quantity_kg: Optional[float] = None
    total_quantity_kg: Optional[float] = None
    remaining_quantity_kg: Optional[float] = None
    bid_start_time: Optional[datetime] = None
    bid_duration_hours: int = 4
    bid_end_time: Optional[datetime] = None
    listing_status: Literal["active", "expired", "sold", "archived", "pending_approval", "rejected"] = "active"
    total_bids_received: int = 0

# ==================== USER MODELS ====================
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    company_name: Optional[str] = None
    country: Optional[str] = None
    phone: str  # Required — must be valid Indian or international mobile number
    role: Literal["buyer", "seller", "both"] = "buyer"

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        v = v.strip()
        # International format: +XX... (7-15 digits after +)
        if re.match(r'^\+\d{7,15}$', v):
            return v
        # Indian 10-digit starting with 6-9
        if re.match(r'^[6-9]\d{9}$', v):
            return v
        raise ValueError("Enter a valid mobile number (10 digits starting with 6-9, or international format like +91XXXXXXXXXX)")

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    full_name: str
    company_name: Optional[str] = None
    country: Optional[str] = None
    phone: Optional[str] = None
    role: Literal["buyer", "seller", "both", "admin"] = "buyer"
    status: Literal["pending", "approved", "rejected"] = "pending"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    company_name: Optional[str] = None
    country: Optional[str] = None
    phone: Optional[str] = None
    role: str
    status: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

# ==================== BID MODELS ====================
class BidCreate(BaseModel):
    product_id: str
    quantity_kg: Optional[float] = None
    quantity_lot: Optional[float] = None
    price_per_kg: Optional[float] = None
    price_per_lot: Optional[float] = None
    currency: Literal["INR", "USD"] = "INR"
    market_type: Literal["domestic", "export"] = "domestic"
    additional_notes: Optional[str] = None

class Bid(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    buyer_id: str
    buyer_name: str
    buyer_email: str
    buyer_phone: Optional[str] = None
    buyer_company: Optional[str] = None
    seller_id: str = ""
    seller_name: str = ""
    product_id: str
    product_name: str
    product_size: str
    quantity_kg: Optional[float] = None
    quantity_lot: Optional[float] = None
    price_per_kg: Optional[float] = None
    price_per_lot: Optional[float] = None
    currency: Literal["INR", "USD"] = "INR"
    market_type: Literal["domestic", "export"] = "domestic"
    additional_notes: Optional[str] = None
    status: Literal["pending", "accepted", "rejected"] = "pending"
    admin_notes: Optional[str] = None
    seller_notes: Optional[str] = None
    reviewed_by: Optional[str] = None
    bid_date: str = Field(default_factory=lambda: datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BidUpdate(BaseModel):
    status: Literal["accepted", "rejected"]
    notes: Optional[str] = None

class ContactInquiry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: EmailStr
    company: Optional[str] = None
    country: Optional[str] = None
    message: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ContactInquiryCreate(BaseModel):
    name: str
    email: EmailStr
    company: Optional[str] = None
    country: Optional[str] = None
    message: str

class PushSubscription(BaseModel):
    endpoint: str
    keys: dict


# ==================== HELPERS ====================
def _coerce_product_datetimes(p: dict):
    """Convert ISO string datetime fields on a product dict to datetime objects."""
    for field in ("created_at", "bid_start_time", "bid_end_time", "sold_at"):
        if isinstance(p.get(field), str):
            p[field] = datetime.fromisoformat(p[field])


# ==================== AUTH UTILITIES ====================
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt_lib.checkpw(
        plain_password.encode('utf-8'),
        hashed_password.encode('utf-8')
    )

def get_password_hash(password: str) -> str:
    return bcrypt_lib.hashpw(
        password.encode('utf-8'),
        bcrypt_lib.gensalt()
    ).decode('utf-8')

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = await db.users.find_one({"email": email}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    if isinstance(user.get('created_at'), str):
        user['created_at'] = datetime.fromisoformat(user['created_at'])

    return User(**user)

async def get_current_approved_buyer(current_user: User = Depends(get_current_user)):
    """Buyer or Both role, approved status."""
    if current_user.role not in ("buyer", "both"):
        raise HTTPException(status_code=403, detail="Buyer access required")
    if current_user.status != "approved":
        raise HTTPException(status_code=403, detail="Account pending approval")
    return current_user

async def get_current_approved_seller(current_user: User = Depends(get_current_user)):
    """Seller or Both role, approved status."""
    if current_user.role not in ("seller", "both"):
        raise HTTPException(status_code=403, detail="Seller access required")
    if current_user.status != "approved":
        raise HTTPException(status_code=403, detail="Account pending approval")
    return current_user

async def get_current_seller_or_admin(current_user: User = Depends(get_current_user)):
    """Seller, Both, or Admin role, approved status."""
    if current_user.role not in ("seller", "both", "admin"):
        raise HTTPException(status_code=403, detail="Seller or admin access required")
    if current_user.status != "approved":
        raise HTTPException(status_code=403, detail="Account pending approval")
    return current_user

async def get_current_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


# ==================== API ENDPOINTS ====================

@api_router.get("/")
async def root():
    return {"message": "Cardamom Spices Centre B2B Marketplace API", "version": "3.0"}


# ==================== AUTH ENDPOINTS ====================
@api_router.post("/auth/register", response_model=UserResponse)
async def register(user_data: UserRegister):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    existing_phone = await db.users.find_one({"phone": user_data.phone})
    if existing_phone:
        raise HTTPException(status_code=400, detail="Mobile number already registered")

    user = User(
        email=user_data.email,
        full_name=user_data.full_name,
        company_name=user_data.company_name,
        country=user_data.country,
        phone=user_data.phone,
        role=user_data.role,
        status="pending"
    )

    user_dict = user.model_dump()
    user_dict['password'] = get_password_hash(user_data.password)
    user_dict['created_at'] = user_dict['created_at'].isoformat()

    await db.users.insert_one(user_dict)
    logger.info(f"New {user_data.role} registered: {user.email}")

    # Notify admin of new registration (fire-and-forget)
    asyncio.create_task(_email_new_registration(user))

    return UserResponse(**user.model_dump())

@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user['password']):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if isinstance(user.get('created_at'), str):
        user['created_at'] = datetime.fromisoformat(user['created_at'])

    user_data = {k: v for k, v in user.items() if k != 'password'}

    access_token = create_access_token(data={"sub": user['email']})

    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(**user_data)
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse(**current_user.model_dump())


# ==================== ADMIN ENDPOINTS ====================
@api_router.get("/admin/users", response_model=List[UserResponse])
async def get_all_users(current_admin: User = Depends(get_current_admin)):
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    for user in users:
        if isinstance(user.get('created_at'), str):
            user['created_at'] = datetime.fromisoformat(user['created_at'])
    return [UserResponse(**u) for u in users]

@api_router.patch("/admin/users/{user_id}/status")
async def update_user_status(
    user_id: str,
    status: Literal["approved", "rejected"] = Query(...),
    current_admin: User = Depends(get_current_admin)
):
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"status": status}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    logger.info(f"Admin {current_admin.email} {status} user {user['email']}")

    # Email the user about the decision (fire-and-forget)
    if status == "approved":
        asyncio.create_task(_email_user_approved(user))
    else:
        asyncio.create_task(_email_user_rejected(user))

    return {"message": f"User {status}", "user": user}

# Admin: list ALL products (any approval/listing status)
@api_router.get("/admin/products")
async def get_all_products_admin(
    listing_status: Optional[str] = Query(None),
    approval_status: Optional[str] = Query(None),
    current_admin: User = Depends(get_current_admin)
):
    query: dict = {}
    if listing_status and listing_status in ("active", "expired", "sold", "archived", "pending_approval", "rejected"):
        query["listing_status"] = listing_status
    if approval_status and approval_status in ("pending", "approved", "rejected"):
        query["approval_status"] = approval_status
    products = await db.products.find(query, {"_id": 0}).sort("created_at", -1).to_list(2000)
    for p in products:
        _coerce_product_datetimes(p)
    return [Product(**p).model_dump() for p in products]

# Admin: create product (auto-approved)
@api_router.post("/admin/products", response_model=Product)
async def create_product_admin(
    product_data: ProductCreate,
    current_admin: User = Depends(get_current_admin)
):
    raw = product_data.model_dump()
    duration_hrs = raw.pop("bid_duration_hours", 4)
    total_qty = raw.get("total_quantity_kg")
    now = datetime.now(timezone.utc)
    product = Product(
        **raw,
        seller_id=current_admin.id,
        seller_name=current_admin.full_name,
        seller_company=current_admin.company_name,
        approval_status="approved",
        bid_duration_hours=duration_hrs,
        bid_start_time=now,
        bid_end_time=now + timedelta(hours=duration_hrs),
        listing_status="active",
        remaining_quantity_kg=total_qty,
    )
    product_dict = product.model_dump()
    product_dict['created_at'] = product_dict['created_at'].isoformat()
    product_dict['bid_start_time'] = product_dict['bid_start_time'].isoformat() if product_dict['bid_start_time'] else None
    product_dict['bid_end_time'] = product_dict['bid_end_time'].isoformat() if product_dict['bid_end_time'] else None
    await db.products.insert_one(product_dict)
    logger.info(f"Admin created product: {product.name} ({duration_hrs}h timer)")
    return product

@api_router.put("/admin/products/{product_id}", response_model=Product)
async def update_product_admin(
    product_id: str,
    product_data: ProductCreate,
    current_admin: User = Depends(get_current_admin)
):
    result = await db.products.update_one(
        {"id": product_id},
        {"$set": product_data.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")

    updated = await db.products.find_one({"id": product_id}, {"_id": 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    logger.info(f"Admin updated product: {product_id}")
    return Product(**updated)

@api_router.delete("/admin/products/{product_id}")
async def delete_product_admin(
    product_id: str,
    current_admin: User = Depends(get_current_admin)
):
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    logger.info(f"Admin deleted product: {product_id}")
    return {"message": "Product deleted"}

# Admin: approve/reject a product
@api_router.patch("/admin/products/{product_id}/status")
async def update_product_status(
    product_id: str,
    approval_status: Literal["approved", "rejected"] = Query(...),
    current_admin: User = Depends(get_current_admin)
):
    product_before = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product_before:
        raise HTTPException(status_code=404, detail="Product not found")

    if approval_status == "approved":
        now = datetime.now(timezone.utc)
        duration_hrs = product_before.get("bid_duration_hours", 4)
        update_fields = {
            "approval_status": "approved",
            "listing_status": "active",
            "bid_start_time": now.isoformat(),
            "bid_end_time": (now + timedelta(hours=duration_hrs)).isoformat(),
        }
    else:
        update_fields = {
            "approval_status": "rejected",
            "listing_status": "rejected",
        }

    result = await db.products.update_one({"id": product_id}, {"$set": update_fields})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")

    product = await db.products.find_one({"id": product_id}, {"_id": 0})

    # Notify seller
    try:
        seller_id = product_before.get("seller_id")
        if seller_id:
            status_msg = "approved and is now live" if approval_status == "approved" else "rejected"
            await send_push_to_user(
                seller_id,
                f"Product {approval_status.title()}",
                f"Your product '{product_before.get('name', '')}' has been {status_msg}.",
                "/seller"
            )
    except Exception as e:
        logger.warning(f"Push notification failed: {e}")

    # On approval: email all approved buyers about the new listing
    if approval_status == "approved":
        try:
            approved_buyers = await db.users.find(
                {"role": {"$in": ["buyer", "both"]}, "status": "approved"},
                {"_id": 0, "email": 1}
            ).to_list(5000)
            buyer_emails = [u["email"] for u in approved_buyers if u.get("email")]
            if buyer_emails:
                asyncio.create_task(_email_buyers_new_product(product, buyer_emails))
        except Exception as e:
            logger.warning(f"Failed to queue buyer notification emails: {e}")

    logger.info(f"Admin {approval_status} product: {product_id}")
    return {"message": f"Product {approval_status}", "product": product}

# Admin: archived products
@api_router.get("/admin/products/archived")
async def get_admin_archived_products(current_admin: User = Depends(get_current_admin)):
    products = await db.products.find(
        {"listing_status": "archived"},
        {"_id": 0}
    ).sort("sold_at", -1).to_list(2000)
    for p in products:
        _coerce_product_datetimes(p)
    return [Product(**p).model_dump() for p in products]

# Admin: bid summary
@api_router.get("/admin/bids/summary")
async def get_bids_summary(current_admin: User = Depends(get_current_admin)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    total = await db.bids.count_documents({})
    today_count = await db.bids.count_documents({"bid_date": today})
    pending = await db.bids.count_documents({"status": "pending"})
    accepted = await db.bids.count_documents({"status": "accepted"})
    rejected = await db.bids.count_documents({"status": "rejected"})
    return {"total": total, "today": today_count, "pending": pending, "accepted": accepted, "rejected": rejected}

# Admin: all bids
@api_router.get("/bids", response_model=List[Bid])
async def get_all_bids(
    status: Optional[str] = Query(None),
    current_admin: User = Depends(get_current_admin)
):
    query = {}
    if status and status in ("pending", "accepted", "rejected"):
        query["status"] = status
    bids = await db.bids.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for b in bids:
        if isinstance(b.get("created_at"), str):
            b["created_at"] = datetime.fromisoformat(b["created_at"])
        if isinstance(b.get("updated_at"), str):
            b["updated_at"] = datetime.fromisoformat(b["updated_at"])
    return [Bid(**b) for b in bids]

# Admin: update any bid
@api_router.put("/bids/{bid_id}")
async def update_bid_admin(
    bid_id: str,
    bid_update: BidUpdate,
    current_admin: User = Depends(get_current_admin)
):
    update_data = {
        "status": bid_update.status,
        "admin_notes": bid_update.notes,
        "reviewed_by": "admin",
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

    result = await db.bids.update_one({"id": bid_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Bid not found")

    bid = await db.bids.find_one({"id": bid_id}, {"_id": 0})
    logger.info(f"Admin {bid_update.status} bid {bid_id}")

    await _notify_bid_update(bid, bid_update.status, bid_update.notes)

    return {"message": f"Bid {bid_update.status}", "bid": bid}


# ==================== SELLER ENDPOINTS ====================

# Seller: get my products (all statuses except archived)
@api_router.get("/seller/products")
async def get_seller_products(
    listing_status: Optional[str] = Query(None),
    current_user: User = Depends(get_current_approved_seller)
):
    query: dict = {"seller_id": current_user.id, "listing_status": {"$nin": ["archived"]}}
    if listing_status and listing_status in ("active", "expired", "sold", "archived", "pending_approval", "rejected"):
        query["listing_status"] = listing_status
    products = await db.products.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for p in products:
        _coerce_product_datetimes(p)
    return [Product(**p).model_dump() for p in products]

# Seller: create product (pending approval)
@api_router.post("/seller/products", response_model=Product)
async def create_product_seller(
    product_data: ProductCreate,
    current_user: User = Depends(get_current_approved_seller)
):
    raw = product_data.model_dump()
    duration_hrs = raw.pop("bid_duration_hours", 4)
    total_qty = raw.get("total_quantity_kg")
    product = Product(
        **raw,
        seller_id=current_user.id,
        seller_name=current_user.full_name,
        seller_company=current_user.company_name,
        approval_status="pending",
        bid_duration_hours=duration_hrs,
        bid_start_time=None,
        bid_end_time=None,
        listing_status="pending_approval",
        remaining_quantity_kg=total_qty,
    )
    product_dict = product.model_dump()
    product_dict['created_at'] = product_dict['created_at'].isoformat()
    product_dict['bid_start_time'] = None
    product_dict['bid_end_time'] = None
    await db.products.insert_one(product_dict)
    logger.info(f"Seller {current_user.email} created product: {product.name} (pending approval, {duration_hrs}h timer)")

    try:
        await send_push_to_admins(
            "New Product Pending Approval",
            f"{current_user.full_name} uploaded '{product.name}' — needs review.",
            "/admin"
        )
    except Exception as e:
        logger.warning(f"Push notification failed: {e}")

    return product

# Seller: update own product (re-pending)
@api_router.put("/seller/products/{product_id}", response_model=Product)
async def update_product_seller(
    product_id: str,
    product_data: ProductCreate,
    current_user: User = Depends(get_current_approved_seller)
):
    existing = await db.products.find_one({"id": product_id, "seller_id": current_user.id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found or not yours")

    await db.products.update_one(
        {"id": product_id, "seller_id": current_user.id},
        {"$set": {**product_data.model_dump(), "approval_status": "pending"}}
    )

    updated = await db.products.find_one({"id": product_id}, {"_id": 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    logger.info(f"Seller updated product: {product_id} (re-pending approval)")
    return Product(**updated)

# Seller: delete own product
@api_router.delete("/seller/products/{product_id}")
async def delete_product_seller(
    product_id: str,
    current_user: User = Depends(get_current_approved_seller)
):
    result = await db.products.delete_one({"id": product_id, "seller_id": current_user.id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found or not yours")
    logger.info(f"Seller deleted product: {product_id}")
    return {"message": "Product deleted"}

# Seller: bids on my products
@api_router.get("/seller/bids")
async def get_seller_bids(
    status: Optional[str] = Query(None),
    current_user: User = Depends(get_current_approved_seller)
):
    query = {"seller_id": current_user.id}
    if status and status in ("pending", "accepted", "rejected"):
        query["status"] = status
    bids = await db.bids.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for b in bids:
        if isinstance(b.get("created_at"), str):
            b["created_at"] = datetime.fromisoformat(b["created_at"])
        if isinstance(b.get("updated_at"), str):
            b["updated_at"] = datetime.fromisoformat(b["updated_at"])

    # Enrich each bid with product image fields
    product_ids = list({b["product_id"] for b in bids if b.get("product_id")})
    products_map = {}
    if product_ids:
        product_docs = await db.products.find(
            {"id": {"$in": product_ids}}, {"_id": 0, "id": 1, "image_url": 1, "media_paths": 1}
        ).to_list(len(product_ids))
        products_map = {p["id"]: p for p in product_docs}

    result = []
    for b in bids:
        bid_dict = Bid(**b).model_dump()
        prod = products_map.get(b.get("product_id"), {})
        bid_dict["product_image_url"] = prod.get("image_url")
        bid_dict["product_media_paths"] = prod.get("media_paths") or []
        result.append(bid_dict)
    return result

# Seller: accept/reject bid on own product
@api_router.put("/seller/bids/{bid_id}")
async def update_seller_bid(
    bid_id: str,
    bid_update: BidUpdate,
    current_user: User = Depends(get_current_approved_seller)
):
    bid = await db.bids.find_one({"id": bid_id}, {"_id": 0})
    if not bid:
        raise HTTPException(status_code=404, detail="Bid not found")
    if bid.get("seller_id") != current_user.id:
        raise HTTPException(status_code=403, detail="This bid is not on your product")

    now = datetime.now(timezone.utc)
    update_data = {
        "status": bid_update.status,
        "seller_notes": bid_update.notes,
        "reviewed_by": "seller",
        "updated_at": now.isoformat()
    }
    await db.bids.update_one({"id": bid_id}, {"$set": update_data})

    if bid_update.status == "accepted":
        product_id = bid.get("product_id")

        # ── Inventory update ──────────────────────────────────────
        product_doc = await db.products.find_one({"id": product_id}, {"_id": 0})
        accepted_qty_kg = bid.get("quantity_kg") or 0.0
        remaining = product_doc.get("remaining_quantity_kg") if product_doc else None

        if remaining is not None and accepted_qty_kg:
            new_remaining = max(0.0, remaining - accepted_qty_kg)
        else:
            new_remaining = 0.0  # No inventory tracking → treat as fully sold

        new_status = "sold" if new_remaining <= 0 else "active"

        # Auto-reject competing bids only when product is fully sold out
        if new_status == "sold":
            await db.bids.update_many(
                {"product_id": product_id, "id": {"$ne": bid_id}, "status": "pending"},
                {"$set": {
                    "status": "rejected",
                    "seller_notes": "Another bid was accepted for this product.",
                    "reviewed_by": "seller",
                    "updated_at": now.isoformat()
                }}
            )

        sold_price = bid.get("price_per_kg") or bid.get("price_per_lot")
        sold_currency = bid.get("currency", "INR")
        update_fields: dict = {
            "remaining_quantity_kg": new_remaining,
            "listing_status": new_status,
        }
        if new_status == "sold":
            update_fields.update({
                "sold_at": now.isoformat(),
                "sold_to_buyer_id": bid.get("buyer_id"),
                "sold_to_buyer_name": bid.get("buyer_name"),
                "sold_price": sold_price,
                "sold_price_currency": sold_currency,
            })
        await db.products.update_one({"id": product_id}, {"$set": update_fields})
        logger.info(f"Product {product_id}: bid accepted, {new_remaining:.1f}kg remaining, status={new_status}")

        # Notify seller
        try:
            await send_push_to_user(
                current_user.id,
                "Product Sold!",
                f"'{bid.get('product_name')}' has been sold to {bid.get('buyer_name')}.",
                "/seller"
            )
        except Exception as e:
            logger.warning(f"Push notification failed: {e}")

    bid = await db.bids.find_one({"id": bid_id}, {"_id": 0})
    logger.info(f"Seller {current_user.email} {bid_update.status} bid {bid_id}")

    await _notify_bid_update(bid, bid_update.status, bid_update.notes)

    return {"message": f"Bid {bid_update.status}", "bid": bid}

# Seller: extend bid timer (max MAX_TIMER_EXTENSIONS times)
@api_router.post("/seller/products/{product_id}/extend-timer")
async def extend_product_timer(
    product_id: str,
    current_user: User = Depends(get_current_approved_seller)
):
    product = await db.products.find_one({"id": product_id, "seller_id": current_user.id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found or not yours")

    if product.get("listing_status") not in ("active", "expired"):
        raise HTTPException(status_code=400, detail="Can only extend active or expired listings")

    extension_count = product.get("extension_count", 0)
    if extension_count >= MAX_TIMER_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_TIMER_EXTENSIONS} extensions allowed")

    now = datetime.now(timezone.utc)
    current_end_raw = product.get("bid_end_time")
    if isinstance(current_end_raw, str):
        current_end = datetime.fromisoformat(current_end_raw)
    elif isinstance(current_end_raw, datetime):
        current_end = current_end_raw
    else:
        current_end = now
    # Extend from whichever is later: now or current end
    base = max(now, current_end)
    new_end = base + timedelta(hours=BID_TIMER_EXTENSION_HOURS)

    await db.products.update_one(
        {"id": product_id},
        {"$set": {
            "bid_end_time": new_end.isoformat(),
            "listing_status": "active",
            "extension_count": extension_count + 1
        }}
    )
    logger.info(f"Seller {current_user.email} extended timer for product {product_id} (ext #{extension_count + 1})")
    return {
        "message": f"Timer extended by {BID_TIMER_EXTENSION_HOURS} hours",
        "new_end_time": new_end.isoformat(),
        "extensions_used": extension_count + 1,
        "extensions_remaining": MAX_TIMER_EXTENSIONS - (extension_count + 1)
    }

# Seller: archived products
@api_router.get("/seller/products/archived")
async def get_seller_archived_products(current_user: User = Depends(get_current_approved_seller)):
    products = await db.products.find(
        {"seller_id": current_user.id, "listing_status": "archived"},
        {"_id": 0}
    ).sort("sold_at", -1).to_list(1000)
    for p in products:
        _coerce_product_datetimes(p)
    return [Product(**p).model_dump() for p in products]

# Seller: bid summary for own products
@api_router.get("/seller/bids/summary")
async def get_seller_bids_summary(current_user: User = Depends(get_current_approved_seller)):
    query = {"seller_id": current_user.id}
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    total = await db.bids.count_documents(query)
    today_count = await db.bids.count_documents({**query, "bid_date": today})
    pending = await db.bids.count_documents({**query, "status": "pending"})
    accepted = await db.bids.count_documents({**query, "status": "accepted"})
    rejected = await db.bids.count_documents({**query, "status": "rejected"})
    return {"total": total, "today": today_count, "pending": pending, "accepted": accepted, "rejected": rejected}


# ==================== PUBLIC / BUYER ENDPOINTS ====================

async def _enrich_seller_company(product: dict):
    """Attach seller_company from the seller's user profile if not already stored."""
    if not product.get("seller_company") and product.get("seller_id"):
        seller = await db.users.find_one({"id": product["seller_id"]}, {"_id": 0, "company_name": 1})
        if seller:
            product["seller_company"] = seller.get("company_name")

# Public: approved products that are active or sold (not expired/archived)
@api_router.get("/products", response_model=List[ProductPublic])
async def get_products():
    products = await db.products.find(
        {"approval_status": "approved", "listing_status": {"$in": ["active", "sold"]}},
        {"_id": 0}
    ).to_list(1000)
    for p in products:
        _coerce_product_datetimes(p)
        await _enrich_seller_company(p)
    return [ProductPublic(**p).model_dump() for p in products]

@api_router.get("/products/{product_id}", response_model=ProductPublic)
async def get_product(product_id: str):
    product = await db.products.find_one({"id": product_id, "approval_status": "approved"}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    _coerce_product_datetimes(product)
    await _enrich_seller_company(product)
    return ProductPublic(**product)

# Buyer: place bid
@api_router.post("/bids", response_model=Bid)
async def create_bid(
    bid_data: BidCreate,
    current_user: User = Depends(get_current_approved_buyer)
):
    # Sellers cannot place bids (only buyers or both roles can)
    if current_user.role == "seller":
        raise HTTPException(status_code=403, detail="Sellers cannot place bids. Only buyers can bid.")

    has_qty = bid_data.quantity_kg or bid_data.quantity_lot
    has_price = bid_data.price_per_kg or bid_data.price_per_lot
    if not has_qty or not has_price:
        raise HTTPException(status_code=400, detail="At least one quantity and one price must be provided")

    product = await db.products.find_one({"id": bid_data.product_id, "approval_status": "approved"}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Sellers cannot bid on their own products (covers "both" role)
    if product.get("seller_id") and product.get("seller_id") == current_user.id:
        raise HTTPException(status_code=403, detail="You cannot bid on your own product.")

    if product.get("listing_status") in ("expired", "sold", "archived"):
        raise HTTPException(status_code=400, detail="Bidding is closed for this product")

    # Quantity validations (only applies when bidding in kg)
    if bid_data.quantity_kg:
        min_qty = product.get("minimum_quantity_kg")
        if min_qty and bid_data.quantity_kg < min_qty:
            raise HTTPException(
                status_code=400,
                detail=f"Minimum order is {min_qty} kg for this product"
            )
        remaining_qty = product.get("remaining_quantity_kg")
        if remaining_qty is not None and bid_data.quantity_kg > remaining_qty:
            raise HTTPException(
                status_code=400,
                detail=f"Only {remaining_qty} kg available for this product"
            )

    bid = Bid(
        buyer_id=current_user.id,
        buyer_name=current_user.full_name,
        buyer_email=current_user.email,
        buyer_phone=current_user.phone,
        buyer_company=current_user.company_name,
        seller_id=product.get("seller_id", ""),
        seller_name=product.get("seller_name", ""),
        product_id=bid_data.product_id,
        product_name=product["name"],
        product_size=product["size"],
        quantity_kg=bid_data.quantity_kg,
        quantity_lot=bid_data.quantity_lot,
        price_per_kg=bid_data.price_per_kg,
        price_per_lot=bid_data.price_per_lot,
        currency=bid_data.currency,
        market_type=bid_data.market_type,
        additional_notes=bid_data.additional_notes
    )
    bid_dict = bid.model_dump()
    bid_dict["created_at"] = bid_dict["created_at"].isoformat()
    bid_dict["updated_at"] = bid_dict["updated_at"].isoformat()
    await db.bids.insert_one(bid_dict)
    await db.products.update_one({"id": bid_data.product_id}, {"$inc": {"total_bids_received": 1}})
    logger.info(f"New bid: {current_user.email} on {product['name']}")

    # Notify seller (push + email)
    try:
        seller_id = product.get("seller_id")
        if seller_id:
            await send_push_to_user(
                seller_id,
                "New Bid on Your Product",
                f"{current_user.full_name} bid on {product['name']}",
                "/seller"
            )
            seller_user = await db.users.find_one({"id": seller_id}, {"_id": 0, "email": 1})
            if seller_user and seller_user.get("email"):
                asyncio.create_task(_email_new_bid_to_seller(bid, product, seller_user["email"]))
    except Exception as e:
        logger.warning(f"Seller bid notification failed: {e}")

    # Also notify admins
    try:
        await send_push_to_admins(
            "New Bid Placed",
            f"{current_user.full_name} bid on {product['name']}",
            "/admin"
        )
    except Exception as e:
        logger.warning(f"Push notification failed: {e}")

    return bid

# Buyer: my bids
@api_router.get("/buyer/bids")
async def get_my_bids(current_user: User = Depends(get_current_approved_buyer)):
    bids = await db.bids.find({"buyer_id": current_user.id}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for b in bids:
        if isinstance(b.get("created_at"), str):
            b["created_at"] = datetime.fromisoformat(b["created_at"])
        if isinstance(b.get("updated_at"), str):
            b["updated_at"] = datetime.fromisoformat(b["updated_at"])

    # Enrich each bid with product image fields
    product_ids = list({b["product_id"] for b in bids if b.get("product_id")})
    products_map = {}
    if product_ids:
        product_docs = await db.products.find(
            {"id": {"$in": product_ids}}, {"_id": 0, "id": 1, "image_url": 1, "media_paths": 1}
        ).to_list(len(product_ids))
        products_map = {p["id"]: p for p in product_docs}

    result = []
    for b in bids:
        bid_dict = Bid(**b).model_dump()
        prod = products_map.get(b.get("product_id"), {})
        bid_dict["product_image_url"] = prod.get("image_url")
        bid_dict["product_media_paths"] = prod.get("media_paths") or []
        result.append(bid_dict)
    return result


# ==================== FILE UPLOAD & SERVE ====================
@api_router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_seller_or_admin)
):
    if file.content_type not in ALLOWED_MEDIA_TYPES:
        raise HTTPException(status_code=400, detail=f"File type '{file.content_type}' not allowed. Accepted: JPG, PNG, WEBP, MP4, MOV")

    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Max 50MB.")

    result = put_object(data, file.content_type)

    file_record = {
        "id": str(uuid.uuid4()),
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": file.content_type,
        "size": result.get("size", len(data)),
        "is_deleted": False,
        "uploaded_by": current_user.id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.files.insert_one(file_record)

    logger.info(f"File uploaded by {current_user.email}: {file.filename} -> {result['path']}")
    return {"path": result["path"], "content_type": file.content_type, "original_filename": file.filename}

@api_router.get("/files/{path:path}")
async def serve_file(path: str):
    # Files uploaded via Cloudinary are served directly from the CDN.
    # This endpoint exists for backward compatibility: look up the stored
    # Cloudinary URL and issue a permanent redirect to it.
    record = await db.files.find_one({"storage_path": path, "is_deleted": False}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    return RedirectResponse(url=record["storage_path"], status_code=301)


# ==================== PUSH SUBSCRIPTION ENDPOINTS ====================
@api_router.post("/push/subscribe")
async def subscribe_push(
    subscription: PushSubscription,
    current_user: User = Depends(get_current_user)
):
    sub_data = subscription.model_dump()
    await db.push_subscriptions.update_one(
        {"user_id": current_user.id, "subscription.endpoint": sub_data["endpoint"]},
        {"$set": {
            "user_id": current_user.id,
            "subscription": sub_data,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    return {"message": "Subscribed"}

@api_router.get("/push/vapid-key")
async def get_vapid_key():
    return {"public_key": VAPID_PUBLIC_KEY}


# ==================== CONTACT ====================
async def _email_contact_inquiry(inquiry: ContactInquiry) -> None:
    """Send branded contact enquiry email to admin, with Reply-To set to the enquirer."""
    body = f"""
    <h2 style="color:#2d5a27;margin-top:0;">New Contact Enquiry</h2>
    <p>A new business enquiry has been submitted through the website contact form.</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;">
      <tr><td style="padding:8px 12px;background:#f8f8f4;font-weight:bold;width:140px;">Name</td><td style="padding:8px 12px;background:#f8f8f4;">{inquiry.name}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:bold;">Email</td><td style="padding:8px 12px;"><a href="mailto:{inquiry.email}" style="color:#2d5a27;">{inquiry.email}</a></td></tr>
      <tr><td style="padding:8px 12px;background:#f8f8f4;font-weight:bold;">Company</td><td style="padding:8px 12px;background:#f8f8f4;">{inquiry.company or 'N/A'}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:bold;">Country</td><td style="padding:8px 12px;">{inquiry.country or 'N/A'}</td></tr>
      <tr><td style="padding:8px 12px;background:#f8f8f4;font-weight:bold;vertical-align:top;">Message</td><td style="padding:8px 12px;background:#f8f8f4;">{inquiry.message}</td></tr>
    </table>
    <p>Reply directly to this email to respond to <strong>{inquiry.name}</strong>.</p>"""

    logger.info(f"NEW CONTACT INQUIRY: {inquiry.name} ({inquiry.email}) - {inquiry.message[:100]}")

    if not _SMTP_USERNAME or not _SMTP_PASSWORD:
        logger.info("SMTP not configured — contact inquiry logged to DB only")
        return
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"New Enquiry from {inquiry.name} — Cardamom Spices Centre"
        msg["From"] = _SMTP_FROM or _SMTP_USERNAME
        msg["To"] = _ADMIN_EMAIL or "cardamomspicescentre@gmail.com"
        msg["Reply-To"] = inquiry.email
        msg.attach(MIMEText(_html_wrap("New Contact Enquiry", body), "html"))
        await aiosmtplib.send(
            msg,
            hostname=_SMTP_HOST,
            port=_SMTP_PORT,
            username=_SMTP_USERNAME,
            password=_SMTP_PASSWORD,
            start_tls=True,
        )
        logger.info(f"Contact inquiry email sent for {inquiry.email}")
    except Exception as e:
        logger.warning(f"Contact inquiry email failed: {e}")


@api_router.post("/contact", response_model=ContactInquiry)
async def create_contact_inquiry(input: ContactInquiryCreate):
    inquiry_obj = ContactInquiry(**input.model_dump())
    doc = inquiry_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.contact_inquiries.insert_one(doc)
    asyncio.create_task(_email_contact_inquiry(inquiry_obj))
    logger.info(f"Contact inquiry from {inquiry_obj.name} ({inquiry_obj.email})")
    return inquiry_obj


# ==================== BID NOTIFICATION HELPER ====================
async def _notify_bid_update(bid: dict, status: str, notes: str = None):
    """Send push notification and branded email to buyer about bid update."""
    status_label = status.title()

    # Push notification
    try:
        buyer_id = bid.get("buyer_id")
        if buyer_id:
            await send_push_to_user(
                buyer_id,
                f"Bid {status_label}",
                f"Your bid on {bid.get('product_name', '')} has been {status_label.lower()}",
                "/dashboard"
            )
    except Exception as e:
        logger.warning(f"Push notification failed: {e}")

    # Branded email to buyer
    asyncio.create_task(_email_bid_update_to_buyer(bid, status, notes))


# ==================== APP SETUP ====================
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

