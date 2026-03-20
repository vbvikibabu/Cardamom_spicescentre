from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ==================== MODELS ====================

# User Models
class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    company_name: Optional[str] = None
    country: Optional[str] = None
    phone: Optional[str] = None

class UserRegister(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(UserBase):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    role: Literal["customer", "admin"] = "customer"
    status: Literal["pending", "approved", "rejected"] = "pending"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserResponse(UserBase):
    id: str
    role: str
    status: str
    created_at: datetime

# Product Models
class ProductUpdate(BaseModel):
    name: Optional[str] = None
    size: Optional[str] = None
    description: Optional[str] = None
    features: Optional[List[str]] = None
    image_url: Optional[str] = None
    daily_price_inr: Optional[float] = None
    daily_price_usd: Optional[float] = None
    market_type: Optional[Literal["domestic", "export", "both"]] = None
    stock_quantity: Optional[int] = None
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    size: str
    description: str
    features: List[str]
    image_url: str
    daily_price_inr: float = 0.0
    daily_price_usd: float = 0.0
    market_type: Literal["domestic", "export", "both"] = "both"
    stock_quantity: int = 1000
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Quote Models
class QuoteRequest(BaseModel):
    product_id: str
    quantity: int
    market_type: Literal["domestic", "export"]
    destination_country: Optional[str] = None
    shipping_method: Optional[Literal["air", "sea"]] = None
    additional_notes: Optional[str] = None

class Quote(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customer_id: str
    product_id: str
    quantity: int
    market_type: Literal["domestic", "export"]
    destination_country: Optional[str] = None
    shipping_method: Optional[Literal["air", "sea"]] = None
    additional_notes: Optional[str] = None
    status: Literal["pending", "quoted", "accepted", "rejected"] = "pending"
    base_price: Optional[float] = None
    freight_cost: Optional[float] = None
    admin_notes: Optional[str] = None
    final_price: Optional[float] = None
    currency: Literal["INR", "USD"] = "INR"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class QuoteUpdate(BaseModel):
    status: Optional[Literal["pending", "quoted", "accepted", "rejected"]] = None
    base_price: Optional[float] = None
    freight_cost: Optional[float] = None
    admin_notes: Optional[str] = None
    final_price: Optional[float] = None
    currency: Optional[Literal["INR", "USD"]] = None

# Token Model
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None


# ==================== AUTH UTILITIES ====================

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if user is None:
        raise credentials_exception
    
    if isinstance(user.get('created_at'), str):
        user['created_at'] = datetime.fromisoformat(user['created_at'])
    
    return User(**user)

async def get_current_active_customer(current_user: User = Depends(get_current_user)):
    if current_user.status != "approved":
        raise HTTPException(status_code=403, detail="Account not approved yet")
    return current_user

async def get_current_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


# ==================== CONTINUES IN NEXT FILE ====================
