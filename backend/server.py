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

# Security Configuration
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'cardamom-secret-key-2025-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    size: str
    description: str
    features: List[str]
    image_url: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProductCreate(BaseModel):
    name: str
    size: str
    description: str
    features: List[str]
    image_url: str

# ==================== USER MODELS ====================
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    company_name: Optional[str] = None
    country: Optional[str] = None
    phone: Optional[str] = None

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
    role: Literal["customer", "admin"] = "customer"
    status: Literal["pending", "approved", "rejected"] = "pending"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    company_name: Optional[str]
    country: Optional[str]
    phone: Optional[str]
    role: str
    status: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

# ==================== QUOTE MODELS ====================
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
    customer_name: str
    customer_email: str
    product_id: str
    product_name: str
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

async def get_current_approved_customer(current_user: User = Depends(get_current_user)):
    if current_user.status != "approved":
        raise HTTPException(status_code=403, detail="Account pending approval")
    return current_user

async def get_current_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


# ==================== API ENDPOINTS ====================

# Root endpoint
@api_router.get("/")
async def root():
    return {"message": "Cardamom Spices Centre B2B API", "version": "2.0"}


# ==================== AUTH ENDPOINTS ====================
@api_router.post("/auth/register", response_model=UserResponse)
async def register(user_data: UserRegister):
    # Check if user exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user = User(
        email=user_data.email,
        full_name=user_data.full_name,
        company_name=user_data.company_name,
        country=user_data.country,
        phone=user_data.phone,
        role="customer",
        status="pending"
    )
    
    user_dict = user.model_dump()
    user_dict['password'] = get_password_hash(user_data.password)
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    
    await db.users.insert_one(user_dict)
    logger.info(f"New customer registered: {user.email} - Status: pending approval")
    
    return UserResponse(**user.model_dump())

@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user['password']):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Convert datetime
    if isinstance(user.get('created_at'), str):
        user['created_at'] = datetime.fromisoformat(user['created_at'])
    
    # Remove password from response
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
    status: Literal["approved", "rejected"],
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

@api_router.get("/admin/quotes", response_model=List[Quote])
async def get_all_quotes(current_admin: User = Depends(get_current_admin)):
    quotes = await db.quotes.find({}, {"_id": 0}).to_list(1000)
    
    for quote in quotes:
        if isinstance(quote.get('created_at'), str):
            quote['created_at'] = datetime.fromisoformat(quote['created_at'])
        if isinstance(quote.get('updated_at'), str):
            quote['updated_at'] = datetime.fromisoformat(quote['updated_at'])
    
    return [Quote(**q) for q in quotes]

@api_router.patch("/admin/quotes/{quote_id}")
async def update_quote(
    quote_id: str,
    quote_update: QuoteUpdate,
    current_admin: User = Depends(get_current_admin)
):
    update_data = {k: v for k, v in quote_update.model_dump().items() if v is not None}
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    result = await db.quotes.update_one(
        {"id": quote_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    quote = await db.quotes.find_one({"id": quote_id}, {"_id": 0})
    logger.info(f"Admin updated quote {quote_id}")
    
    return {"message": "Quote updated", "quote": quote}


# ==================== QUOTE ENDPOINTS ====================
@api_router.post("/quotes/request", response_model=Quote)
async def create_quote_request(
    quote_data: QuoteRequest,
    current_user: User = Depends(get_current_approved_customer)
):
    # Get product details
    product = await db.products.find_one({"id": quote_data.product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    quote = Quote(
        customer_id=current_user.id,
        customer_name=current_user.full_name,
        customer_email=current_user.email,
        product_id=quote_data.product_id,
        product_name=product['name'],
        quantity=quote_data.quantity,
        market_type=quote_data.market_type,
        destination_country=quote_data.destination_country,
        shipping_method=quote_data.shipping_method,
        additional_notes=quote_data.additional_notes,
        status="pending"
    )
    
    quote_dict = quote.model_dump()
    quote_dict['created_at'] = quote_dict['created_at'].isoformat()
    quote_dict['updated_at'] = quote_dict['updated_at'].isoformat()
    
    await db.quotes.insert_one(quote_dict)
    logger.info(f"New quote request: {current_user.email} - Product: {product['name']} - Qty: {quote_data.quantity}")
    
    return quote

@api_router.get("/quotes/my-quotes", response_model=List[Quote])
async def get_my_quotes(current_user: User = Depends(get_current_approved_customer)):
    quotes = await db.quotes.find({"customer_id": current_user.id}, {"_id": 0}).to_list(1000)
    
    for quote in quotes:
        if isinstance(quote.get('created_at'), str):
            quote['created_at'] = datetime.fromisoformat(quote['created_at'])
        if isinstance(quote.get('updated_at'), str):
            quote['updated_at'] = datetime.fromisoformat(quote['updated_at'])
    
    return [Quote(**q) for q in quotes]


# ==================== ADMIN PRODUCT ENDPOINTS ====================
@api_router.post("/admin/products", response_model=Product)
async def create_product(
    product_data: ProductCreate,
    current_admin: User = Depends(get_current_admin)
):
    product = Product(**product_data.model_dump())
    product_dict = product.model_dump()
    product_dict['created_at'] = product_dict['created_at'].isoformat()
    await db.products.insert_one(product_dict)
    logger.info(f"Admin created product: {product.name}")
    return product

@api_router.put("/admin/products/{product_id}", response_model=Product)
async def update_product(
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
async def delete_product(
    product_id: str,
    current_admin: User = Depends(get_current_admin)
):
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    logger.info(f"Admin deleted product: {product_id}")
    return {"message": "Product deleted"}


# Product endpoints
@api_router.get("/products", response_model=List[Product])
async def get_products():
    products = await db.products.find({}, {"_id": 0}).to_list(1000)
    
    for product in products:
        if isinstance(product.get('created_at'), str):
            product['created_at'] = datetime.fromisoformat(product['created_at'])
    
    return products

@api_router.get("/products/{product_id}", response_model=Product)
async def get_product(product_id: str):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if isinstance(product.get('created_at'), str):
        product['created_at'] = datetime.fromisoformat(product['created_at'])
    
    return product

# Contact endpoint
async def send_email_notification(inquiry: ContactInquiry):
    """Send email notification when new inquiry is received"""
    try:
        # Log the inquiry details for monitoring
        logger.info("="*60)
        logger.info("NEW CONTACT INQUIRY RECEIVED")
        logger.info("="*60)
        logger.info(f"Name: {inquiry.name}")
        logger.info(f"Email: {inquiry.email}")
        logger.info(f"Company: {inquiry.company or 'N/A'}")
        logger.info(f"Country: {inquiry.country or 'N/A'}")
        logger.info(f"Message: {inquiry.message}")
        logger.info(f"Time: {inquiry.created_at.strftime('%B %d, %Y at %I:%M %p')}")
        logger.info("="*60)
        logger.info("IMPORTANT: Check MongoDB for full details")
        logger.info(f"To send email manually, contact: {inquiry.email}")
        logger.info("="*60)
        
        # Email configuration - Using Gmail SMTP
        smtp_server = "smtp.gmail.com"
        smtp_port = 587
        sender_email = "cardamomspicescentre@gmail.com"
        receiver_email = "cardamomspicescentre@gmail.com"
        
        # Get SMTP credentials from environment
        smtp_username = os.environ.get('SMTP_USERNAME', '')
        smtp_password = os.environ.get('SMTP_PASSWORD', '')
        
        if smtp_username and smtp_password:
            # Create message
            message = MIMEMultipart("alternative")
            message["Subject"] = f"New Enquiry from {inquiry.name}"
            message["From"] = sender_email
            message["To"] = receiver_email
            message["Reply-To"] = inquiry.email
            
            # Create email body
            html_body = f"""
            <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                        <h2 style="color: #2d5a27; border-bottom: 2px solid #2d5a27; padding-bottom: 10px;">
                            🌿 New Enquiry - Cardamom Spices Centre
                        </h2>
                        
                        <div style="margin: 20px 0; background-color: #f9f7f2; padding: 20px; border-radius: 8px;">
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 8px 0; font-weight: bold; width: 120px;">Name:</td>
                                    <td style="padding: 8px 0;">{inquiry.name}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; font-weight: bold;">Email:</td>
                                    <td style="padding: 8px 0;"><a href="mailto:{inquiry.email}" style="color: #2d5a27;">{inquiry.email}</a></td>
                                </tr>
                                {f'<tr><td style="padding: 8px 0; font-weight: bold;">Company:</td><td style="padding: 8px 0;">{inquiry.company}</td></tr>' if inquiry.company else ''}
                                {f'<tr><td style="padding: 8px 0; font-weight: bold;">Country:</td><td style="padding: 8px 0;">{inquiry.country}</td></tr>' if inquiry.country else ''}
                            </table>
                        </div>
                        
                        <div style="margin: 20px 0; padding: 15px; background-color: #ffffff; border-left: 4px solid #2d5a27;">
                            <p style="margin: 0 0 10px 0; font-weight: bold; color: #2d5a27;">Message:</p>
                            <p style="margin: 0; white-space: pre-wrap;">{inquiry.message}</p>
                        </div>
                        
                        <div style="margin-top: 20px; padding: 15px; background-color: #e8f5e9; border-radius: 8px;">
                            <p style="margin: 0; font-size: 14px;">
                                <strong>Quick Actions:</strong><br>
                                📧 <a href="mailto:{inquiry.email}?subject=Re: Your Cardamom Inquiry" style="color: #2d5a27;">Reply to Customer</a><br>
                                📞 Add to contacts: {inquiry.email}
                            </p>
                        </div>
                        
                        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; text-align: center;">
                            <p style="margin: 5px 0;">Received: {inquiry.created_at.strftime('%B %d, %Y at %I:%M %p IST')}</p>
                            <p style="margin: 5px 0;">This is an automated notification from your Cardamom Spices Centre website.</p>
                            <p style="margin: 5px 0; font-size: 10px; color: #999;">Powered by Cardamom Spices Centre CRM</p>
                        </div>
                    </div>
                </body>
            </html>
            """
            
            part = MIMEText(html_body, "html")
            message.attach(part)
            
            try:
                # Send email via SMTP
                await aiosmtplib.send(
                    message,
                    hostname=smtp_server,
                    port=smtp_port,
                    start_tls=True,
                    username=smtp_username,
                    password=smtp_password,
                    timeout=10
                )
                logger.info(f"✓ EMAIL SENT SUCCESSFULLY to {receiver_email}")
                return True
            except Exception as smtp_error:
                logger.error(f"✗ Email sending failed: {str(smtp_error)}")
                logger.error("Check SMTP credentials in .env file")
                return False
        else:
            logger.warning("⚠️  SMTP credentials not configured in .env file")
            logger.warning("To receive emails, add SMTP_USERNAME and SMTP_PASSWORD to /app/backend/.env")
            logger.warning("See /app/EMAIL_SETUP_GUIDE.md for instructions")
            return False
        
    except Exception as e:
        logger.error(f"Email notification error: {str(e)}")
        return False

@api_router.post("/contact", response_model=ContactInquiry)
async def create_contact_inquiry(input: ContactInquiryCreate):
    inquiry_dict = input.model_dump()
    inquiry_obj = ContactInquiry(**inquiry_dict)
    
    doc = inquiry_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.contact_inquiries.insert_one(doc)
    
    # Send email notification
    await send_email_notification(inquiry_obj)
    
    logger.info(f"New contact inquiry received from {inquiry_obj.name} ({inquiry_obj.email})")
    
    return inquiry_obj

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# Initialize admin user and sample products on startup
@app.on_event("startup")
async def initialize_data():
    # Create admin user if not exists
    admin_email = "admin@cardamomspicescentre.com"
    existing_admin = await db.users.find_one({"email": admin_email})
    
    if not existing_admin:
        admin = {
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password": get_password_hash("admin123"),  # CHANGE THIS!
            "full_name": "Admin User",
            "company_name": "Cardamom Spices Centre",
            "country": "India",
            "phone": "+91-8838226519",
            "role": "admin",
            "status": "approved",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(admin)
        logger.info(f"✅ Admin user created: {admin_email} / admin123")
    
    # Initialize products
    # Clear existing products
    await db.products.delete_many({})
    
    sample_products = [
        {
            "id": str(uuid.uuid4()),
            "name": "Green Cardamom – 6 mm to 7 mm",
            "size": "6 mm to 7 mm",
            "description": "Clean, bold green pods suitable for retail packing & wholesale trade. Perfect for everyday culinary use with consistent quality.",
            "features": [
                "Clean, bold green pods",
                "Suitable for retail packing",
                "Wholesale trade ready",
                "Consistent quality"
            ],
            "image_url": "https://customer-assets.emergentagent.com/job_21ff2258-a2aa-405e-b346-3b2451a93f14/artifacts/34s4f7a9_6-7mm.png",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Green Cardamom – 7 mm to 8 mm",
            "size": "7 mm to 8 mm",
            "description": "Premium export quality with good aroma and uniform size. Suitable for retail, bulk & export markets with excellent market acceptance.",
            "features": [
                "Premium export quality",
                "Good aroma",
                "Uniform size",
                "Suitable for retail, bulk & export"
            ],
            "image_url": "https://customer-assets.emergentagent.com/job_21ff2258-a2aa-405e-b346-3b2451a93f14/artifacts/356y2nmh_7-8mm.jpg",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Green Cardamom – 8 mm & Above",
            "size": "8 mm & Above",
            "description": "Super bold pods with high liter weight. Preferred for export & premium buyers seeking the finest quality cardamom.",
            "features": [
                "Super bold pods",
                "High liter weight",
                "Preferred for export",
                "Premium buyers choice"
            ],
            "image_url": "https://customer-assets.emergentagent.com/job_21ff2258-a2aa-405e-b346-3b2451a93f14/artifacts/sic8070t_8mm%2B.jpg",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    await db.products.insert_many(sample_products)
    logger.info(f"Initialized {len(sample_products)} products for Cardamom Spices Centre")
