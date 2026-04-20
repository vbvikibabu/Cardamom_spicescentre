from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, timedelta
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import jwt
from passlib.context import CryptContext
import requests as http_requests
from pywebpush import webpush, WebPushException
import json

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

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

# ==================== OBJECT STORAGE ====================
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "cardamom-spices"
storage_key = None

ALLOWED_MEDIA_TYPES = {
    "image/jpeg", "image/png", "image/webp",
    "video/mp4", "video/quicktime"
}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    resp = http_requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = http_requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120
    )
    resp.raise_for_status()
    return resp.json()

def get_object(path: str):
    key = init_storage()
    resp = http_requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

# Create the main app
app = FastAPI()
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
    approval_status: Literal["pending", "approved", "rejected"] = "pending"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProductCreate(BaseModel):
    name: str
    size: str
    description: str
    features: List[str]
    image_url: str = ""
    media_paths: List[str] = Field(default_factory=list)

# ==================== USER MODELS ====================
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    company_name: Optional[str] = None
    country: Optional[str] = None
    phone: Optional[str] = None
    role: Literal["buyer", "seller", "both"] = "buyer"

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


# ==================== AUTH UTILITIES ====================
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

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

    return {"message": f"User {status}", "user": user}

# Admin: list ALL products (any approval status)
@api_router.get("/admin/products")
async def get_all_products_admin(
    approval_status: Optional[str] = Query(None),
    current_admin: User = Depends(get_current_admin)
):
    query = {}
    if approval_status and approval_status in ("pending", "approved", "rejected"):
        query["approval_status"] = approval_status
    products = await db.products.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for p in products:
        if isinstance(p.get('created_at'), str):
            p['created_at'] = datetime.fromisoformat(p['created_at'])
    return [Product(**p).model_dump() for p in products]

# Admin: create product (auto-approved)
@api_router.post("/admin/products", response_model=Product)
async def create_product_admin(
    product_data: ProductCreate,
    current_admin: User = Depends(get_current_admin)
):
    product = Product(
        **product_data.model_dump(),
        seller_id=current_admin.id,
        seller_name=current_admin.full_name,
        approval_status="approved"
    )
    product_dict = product.model_dump()
    product_dict['created_at'] = product_dict['created_at'].isoformat()
    await db.products.insert_one(product_dict)
    logger.info(f"Admin created product: {product.name}")
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
    result = await db.products.update_one(
        {"id": product_id},
        {"$set": {"approval_status": approval_status}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")

    product = await db.products.find_one({"id": product_id}, {"_id": 0})

    # Notify seller
    try:
        seller_id = product.get("seller_id")
        if seller_id:
            status_msg = "approved and is now live" if approval_status == "approved" else "rejected"
            await send_push_to_user(
                seller_id,
                f"Product {approval_status.title()}",
                f"Your product '{product.get('name', '')}' has been {status_msg}.",
                "/seller"
            )
    except Exception as e:
        logger.warning(f"Push notification failed: {e}")

    logger.info(f"Admin {approval_status} product: {product_id}")
    return {"message": f"Product {approval_status}", "product": product}

# Admin: bid summary
@api_router.get("/bids/summary")
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

# Seller: get my products
@api_router.get("/seller/products")
async def get_seller_products(current_user: User = Depends(get_current_approved_seller)):
    products = await db.products.find(
        {"seller_id": current_user.id}, {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    for p in products:
        if isinstance(p.get('created_at'), str):
            p['created_at'] = datetime.fromisoformat(p['created_at'])
    return [Product(**p).model_dump() for p in products]

# Seller: create product (pending approval)
@api_router.post("/seller/products", response_model=Product)
async def create_product_seller(
    product_data: ProductCreate,
    current_user: User = Depends(get_current_approved_seller)
):
    product = Product(
        **product_data.model_dump(),
        seller_id=current_user.id,
        seller_name=current_user.full_name,
        approval_status="pending"
    )
    product_dict = product.model_dump()
    product_dict['created_at'] = product_dict['created_at'].isoformat()
    await db.products.insert_one(product_dict)
    logger.info(f"Seller {current_user.email} created product: {product.name} (pending approval)")

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
    return [Bid(**b).model_dump() for b in bids]

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

    update_data = {
        "status": bid_update.status,
        "seller_notes": bid_update.notes,
        "reviewed_by": "seller",
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.bids.update_one({"id": bid_id}, {"$set": update_data})

    bid = await db.bids.find_one({"id": bid_id}, {"_id": 0})
    logger.info(f"Seller {current_user.email} {bid_update.status} bid {bid_id}")

    await _notify_bid_update(bid, bid_update.status, bid_update.notes)

    return {"message": f"Bid {bid_update.status}", "bid": bid}

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

# Public: only approved products
@api_router.get("/products", response_model=List[Product])
async def get_products():
    products = await db.products.find({"approval_status": "approved"}, {"_id": 0}).to_list(1000)
    for product in products:
        if isinstance(product.get('created_at'), str):
            product['created_at'] = datetime.fromisoformat(product['created_at'])
    return products

@api_router.get("/products/{product_id}", response_model=Product)
async def get_product(product_id: str):
    product = await db.products.find_one({"id": product_id, "approval_status": "approved"}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if isinstance(product.get('created_at'), str):
        product['created_at'] = datetime.fromisoformat(product['created_at'])
    return product

# Buyer: place bid
@api_router.post("/bids", response_model=Bid)
async def create_bid(
    bid_data: BidCreate,
    current_user: User = Depends(get_current_approved_buyer)
):
    has_qty = bid_data.quantity_kg or bid_data.quantity_lot
    has_price = bid_data.price_per_kg or bid_data.price_per_lot
    if not has_qty or not has_price:
        raise HTTPException(status_code=400, detail="At least one quantity and one price must be provided")

    product = await db.products.find_one({"id": bid_data.product_id, "approval_status": "approved"}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

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
    logger.info(f"New bid: {current_user.email} on {product['name']}")

    # Notify seller
    try:
        seller_id = product.get("seller_id")
        if seller_id:
            await send_push_to_user(
                seller_id,
                "New Bid on Your Product",
                f"{current_user.full_name} bid on {product['name']}",
                "/seller"
            )
    except Exception as e:
        logger.warning(f"Push notification failed: {e}")

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
@api_router.get("/bids/my")
async def get_my_bids(current_user: User = Depends(get_current_approved_buyer)):
    bids = await db.bids.find({"buyer_id": current_user.id}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for b in bids:
        if isinstance(b.get("created_at"), str):
            b["created_at"] = datetime.fromisoformat(b["created_at"])
        if isinstance(b.get("updated_at"), str):
            b["updated_at"] = datetime.fromisoformat(b["updated_at"])
    return [Bid(**b).model_dump() for b in bids]


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

    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "bin"
    path = f"{APP_NAME}/products/{uuid.uuid4()}.{ext}"

    result = put_object(path, data, file.content_type)

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
    record = await db.files.find_one({"storage_path": path, "is_deleted": False}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="File not found")

    data, content_type = get_object(path)
    return Response(content=data, media_type=record.get("content_type", content_type))


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
async def send_email_notification(inquiry: ContactInquiry):
    try:
        logger.info(f"NEW CONTACT INQUIRY: {inquiry.name} ({inquiry.email}) - {inquiry.message[:100]}")

        smtp_host = os.environ.get("SMTP_HOST", "smtp.gmail.com")
        smtp_user = os.environ.get("SMTP_USERNAME", "")
        smtp_pass = os.environ.get("SMTP_PASSWORD", "")

        if smtp_user and smtp_pass:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = f"New Enquiry from {inquiry.name}"
            msg["From"] = os.environ.get("SMTP_FROM", "noreply@cardamomspicescentre.com")
            msg["To"] = "cardamomspicescentre@gmail.com"
            msg["Reply-To"] = inquiry.email

            html_body = f"""<h2>New Enquiry</h2>
            <p><strong>Name:</strong> {inquiry.name}</p>
            <p><strong>Email:</strong> {inquiry.email}</p>
            <p><strong>Company:</strong> {inquiry.company or 'N/A'}</p>
            <p><strong>Country:</strong> {inquiry.country or 'N/A'}</p>
            <p><strong>Message:</strong> {inquiry.message}</p>"""
            msg.attach(MIMEText(html_body, "html"))

            await aiosmtplib.send(msg, hostname=smtp_host, port=587, username=smtp_user, password=smtp_pass, start_tls=True)
            logger.info(f"Email sent for inquiry from {inquiry.email}")
        else:
            logger.info("SMTP not configured - inquiry logged to DB only")
    except Exception as e:
        logger.warning(f"Email notification error: {e}")

@api_router.post("/contact", response_model=ContactInquiry)
async def create_contact_inquiry(input: ContactInquiryCreate):
    inquiry_obj = ContactInquiry(**input.model_dump())
    doc = inquiry_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.contact_inquiries.insert_one(doc)
    await send_email_notification(inquiry_obj)
    logger.info(f"Contact inquiry from {inquiry_obj.name} ({inquiry_obj.email})")
    return inquiry_obj


# ==================== BID NOTIFICATION HELPER ====================
async def _notify_bid_update(bid: dict, status: str, notes: str = None):
    """Send push notification and email to buyer about bid update."""
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

    # Email
    try:
        buyer_email = bid.get("buyer_email", "")
        if not buyer_email:
            return

        qty_str = ""
        if bid.get("quantity_kg"):
            qty_str += f"{bid['quantity_kg']} kg"
        if bid.get("quantity_lot"):
            qty_str += f"{' / ' if qty_str else ''}{bid['quantity_lot']} lots"
        price_str = ""
        if bid.get("price_per_kg"):
            price_str += f"{bid.get('currency', 'INR')} {bid['price_per_kg']}/kg"
        if bid.get("price_per_lot"):
            price_str += f"{' / ' if price_str else ''}{bid.get('currency', 'INR')} {bid['price_per_lot']}/lot"

        email_body = f"""<h2>Bid {status_label}</h2>
        <p>Dear {bid.get('buyer_name', 'Customer')},</p>
        <p>Your bid on <strong>{bid.get('product_name', '')}</strong> has been <strong>{status_label.lower()}</strong>.</p>
        <p><strong>Quantity:</strong> {qty_str}</p>
        <p><strong>Your Price:</strong> {price_str}</p>
        {f'<p><strong>Notes:</strong> {notes}</p>' if notes else ''}
        <p>Thank you for trading with Cardamom Spices Centre.</p>"""

        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"Bid {status_label} - {bid.get('product_name', 'Cardamom')}"
        msg["From"] = os.environ.get("SMTP_FROM", "noreply@cardamomspicescentre.com")
        msg["To"] = buyer_email
        msg.attach(MIMEText(email_body, "html"))

        smtp_host = os.environ.get("SMTP_HOST", "smtp.gmail.com")
        smtp_user = os.environ.get("SMTP_USERNAME", "")
        smtp_pass = os.environ.get("SMTP_PASSWORD", "")
        if smtp_user and smtp_pass:
            await aiosmtplib.send(msg, hostname=smtp_host, port=587, username=smtp_user, password=smtp_pass, start_tls=True)
            logger.info(f"Bid email sent to {buyer_email}")
        else:
            logger.info(f"SMTP not configured - bid email to {buyer_email} skipped")
    except Exception as e:
        logger.warning(f"Bid email failed: {e}")


# ==================== APP SETUP ====================
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

@app.on_event("startup")
async def initialize_data():
    # Initialize object storage
    try:
        init_storage()
        logger.info("Object storage initialized")
    except Exception as e:
        logger.warning(f"Object storage init deferred: {e}")

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
            "password": get_password_hash("admin123"),
            "full_name": "Admin User",
            "company_name": "Cardamom Spices Centre",
            "country": "India",
            "phone": "+91-8838226519",
            "role": "admin",
            "status": "approved",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(admin)
        logger.info(f"Admin user created: {admin_email} / admin123")

    # Seed sample products ONLY if collection is empty
    product_count = await db.products.count_documents({})
    if product_count == 0:
        admin_user = await db.users.find_one({"email": admin_email}, {"_id": 0})
        admin_id = admin_user["id"] if admin_user else ""

        sample_products = [
            {
                "id": str(uuid.uuid4()),
                "name": "Green Cardamom - 6 mm to 7 mm",
                "size": "6 mm to 7 mm",
                "description": "Clean, bold green pods suitable for retail packing & wholesale trade.",
                "features": ["Clean, bold green pods", "Suitable for retail packing", "Wholesale trade ready", "Consistent quality"],
                "image_url": "https://customer-assets.emergentagent.com/job_21ff2258-a2aa-405e-b346-3b2451a93f14/artifacts/34s4f7a9_6-7mm.png",
                "media_paths": [],
                "seller_id": admin_id,
                "seller_name": "Cardamom Spices Centre",
                "approval_status": "approved",
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "name": "Green Cardamom - 7 mm to 8 mm",
                "size": "7 mm to 8 mm",
                "description": "Premium export quality with good aroma and uniform size.",
                "features": ["Premium export quality", "Good aroma", "Uniform size", "Suitable for retail, bulk & export"],
                "image_url": "https://customer-assets.emergentagent.com/job_21ff2258-a2aa-405e-b346-3b2451a93f14/artifacts/356y2nmh_7-8mm.jpg",
                "media_paths": [],
                "seller_id": admin_id,
                "seller_name": "Cardamom Spices Centre",
                "approval_status": "approved",
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "name": "Green Cardamom - 8 mm & Above",
                "size": "8 mm & Above",
                "description": "Super bold pods with high liter weight. Preferred for export & premium buyers.",
                "features": ["Super bold pods", "High liter weight", "Preferred for export", "Premium buyers choice"],
                "image_url": "https://customer-assets.emergentagent.com/job_21ff2258-a2aa-405e-b346-3b2451a93f14/artifacts/sic8070t_8mm%2B.jpg",
                "media_paths": [],
                "seller_id": admin_id,
                "seller_name": "Cardamom Spices Centre",
                "approval_status": "approved",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        ]

        await db.products.insert_many(sample_products)
        logger.info(f"Seeded {len(sample_products)} sample products")

    logger.info("Cardamom Spices Centre B2B Marketplace v3.0 ready")
