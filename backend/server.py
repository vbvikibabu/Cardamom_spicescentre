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
    grade: str
    origin: str
    description: str
    specifications: dict
    image_url: str
    features: List[str]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProductCreate(BaseModel):
    name: str
    grade: str
    origin: str
    description: str
    specifications: dict
    image_url: str
    features: List[str]

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
    return {"message": "Cardamom Export API"}

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
@api_router.post("/contact", response_model=ContactInquiry)
async def create_contact_inquiry(input: ContactInquiryCreate):
    inquiry_dict = input.model_dump()
    inquiry_obj = ContactInquiry(**inquiry_dict)
    
    doc = inquiry_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.contact_inquiries.insert_one(doc)
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
    existing_products = await db.products.count_documents({})
    
    if existing_products == 0:
        sample_products = [
            {
                "id": str(uuid.uuid4()),
                "name": "Alleppey Green Bold (AGB)",
                "grade": "Premium Grade",
                "origin": "Kerala, India",
                "description": "The finest grade of green cardamom with large, plump pods and intense aroma. Known for its bold size and superior quality.",
                "specifications": {
                    "size": "7-8mm",
                    "moisture": "<10%",
                    "purity": "99.5%",
                    "packaging": "25kg bags"
                },
                "image_url": "https://images.pexels.com/photos/6086300/pexels-photo-6086300.jpeg",
                "features": [
                    "Large bold pods",
                    "Deep green color",
                    "Strong aromatic flavor",
                    "Export quality"
                ],
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "name": "Coorg Green Extra Bold",
                "grade": "Premium Grade",
                "origin": "Karnataka, India",
                "description": "Extra bold green cardamom from Coorg region, renowned for its exceptional size and premium quality.",
                "specifications": {
                    "size": "8mm+",
                    "moisture": "<10%",
                    "purity": "99%",
                    "packaging": "25kg bags"
                },
                "image_url": "https://images.pexels.com/photos/9142634/pexels-photo-9142634.jpeg",
                "features": [
                    "Extra bold size",
                    "Rich aroma",
                    "High oil content",
                    "Premium export grade"
                ],
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "name": "Organic Green Cardamom",
                "grade": "Organic Certified",
                "origin": "Kerala, India",
                "description": "Certified organic cardamom grown without synthetic pesticides or fertilizers. Perfect for health-conscious markets.",
                "specifications": {
                    "size": "6-7mm",
                    "moisture": "<12%",
                    "purity": "98%",
                    "certification": "USDA Organic",
                    "packaging": "10kg bags"
                },
                "image_url": "https://images.pexels.com/photos/34716137/pexels-photo-34716137.jpeg",
                "features": [
                    "USDA Organic certified",
                    "Pesticide-free",
                    "Sustainable farming",
                    "Premium quality"
                ],
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "name": "Bleached White Cardamom",
                "grade": "Export Grade",
                "origin": "Kerala, India",
                "description": "Bleached cardamom pods with neutral appearance, ideal for specific culinary applications and traditional medicines.",
                "specifications": {
                    "size": "6-7mm",
                    "moisture": "<10%",
                    "purity": "99%",
                    "packaging": "20kg bags"
                },
                "image_url": "https://images.pexels.com/photos/4820660/pexels-photo-4820660.jpeg",
                "features": [
                    "Uniform white color",
                    "Mild flavor",
                    "Long shelf life",
                    "Export quality"
                ],
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        ]
        
        await db.products.insert_many(sample_products)
        logger.info(f"Initialized {len(sample_products)} sample products")
