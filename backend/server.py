from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

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
        # Email configuration
        smtp_server = "smtp.gmail.com"
        smtp_port = 587
        sender_email = "noreply@cardamomspicescentre.com"
        receiver_email = "cardamomspicescentre@gmail.com"
        
        # Create message
        message = MIMEMultipart("alternative")
        message["Subject"] = f"New Enquiry from {inquiry.name}"
        message["From"] = sender_email
        message["To"] = receiver_email
        
        # Create email body
        html_body = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                    <h2 style="color: #2d5a27; border-bottom: 2px solid #2d5a27; padding-bottom: 10px;">
                        New Enquiry - Cardamom Spices Centre
                    </h2>
                    
                    <div style="margin: 20px 0;">
                        <p><strong>Name:</strong> {inquiry.name}</p>
                        <p><strong>Email:</strong> {inquiry.email}</p>
                        {f'<p><strong>Company:</strong> {inquiry.company}</p>' if inquiry.company else ''}
                        {f'<p><strong>Country:</strong> {inquiry.country}</p>' if inquiry.country else ''}
                    </div>
                    
                    <div style="margin: 20px 0; padding: 15px; background-color: #f9f7f2; border-left: 4px solid #2d5a27;">
                        <p><strong>Message:</strong></p>
                        <p>{inquiry.message}</p>
                    </div>
                    
                    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
                        <p>Received: {inquiry.created_at.strftime('%B %d, %Y at %I:%M %p')}</p>
                        <p>This is an automated notification from your Cardamom Spices Centre website.</p>
                    </div>
                </div>
            </body>
        </html>
        """
        
        part = MIMEText(html_body, "html")
        message.attach(part)
        
        # Note: For production, you would need proper SMTP credentials
        # This is a placeholder - emails won't actually send without proper SMTP setup
        logger.info(f"Email notification prepared for inquiry from {inquiry.name} ({inquiry.email})")
        logger.info(f"Email would be sent to: {receiver_email}")
        
        # In production, uncomment and configure:
        # await aiosmtplib.send(
        #     message,
        #     hostname=smtp_server,
        #     port=smtp_port,
        #     start_tls=True,
        #     username=os.environ.get('SMTP_USERNAME'),
        #     password=os.environ.get('SMTP_PASSWORD')
        # )
        
    except Exception as e:
        logger.error(f"Email sending failed: {str(e)}")
        # Don't raise exception - we still want to save the inquiry

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
            "image_url": "https://customer-assets.emergentagent.com/job_21ff2258-a2aa-405e-b346-3b2451a93f14/artifacts/br03ic3s_perennial-no-yes-elaichi-plant-h-01-1-platone-original-imahcut3yswvgzg8.jpeg",
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
