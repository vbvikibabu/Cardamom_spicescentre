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

# Root endpoint
@api_router.get("/")
async def root():
    return {"message": "Cardamom Spices Centre API"}

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
                logger.error(f"Check SMTP credentials in .env file")
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

# Initialize sample products on startup
@app.on_event("startup")
async def initialize_products():
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
