import requests
import sys
import json
from datetime import datetime

class CardamomAPITester:
    def __init__(self, base_url="https://spice-voyage-7.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "test_name": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"{status} - {name}")
        if details:
            print(f"   Details: {details}")

    def test_root_endpoint(self):
        """Test API root endpoint"""
        try:
            response = requests.get(f"{self.api_url}/", timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                expected_message = "Cardamom Export API"
                if data.get("message") == expected_message:
                    self.log_test("Root Endpoint", True, f"Status: {response.status_code}, Message: {data.get('message')}")
                else:
                    self.log_test("Root Endpoint", False, f"Unexpected message: {data.get('message')}")
            else:
                self.log_test("Root Endpoint", False, f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_test("Root Endpoint", False, f"Error: {str(e)}")

    def test_get_products(self):
        """Test GET /api/products endpoint"""
        try:
            response = requests.get(f"{self.api_url}/products", timeout=10)
            success = response.status_code == 200
            
            if success:
                products = response.json()
                if isinstance(products, list) and len(products) == 4:
                    # Check if all expected products are present
                    expected_products = [
                        "Alleppey Green Bold (AGB)",
                        "Coorg Green Extra Bold", 
                        "Organic Green Cardamom",
                        "Bleached White Cardamom"
                    ]
                    
                    product_names = [p.get('name') for p in products]
                    all_present = all(name in product_names for name in expected_products)
                    
                    if all_present:
                        self.log_test("Get Products", True, f"Found {len(products)} products with correct names")
                        return products
                    else:
                        missing = [name for name in expected_products if name not in product_names]
                        self.log_test("Get Products", False, f"Missing products: {missing}")
                else:
                    self.log_test("Get Products", False, f"Expected 4 products, got {len(products) if isinstance(products, list) else 'non-list'}")
            else:
                self.log_test("Get Products", False, f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_test("Get Products", False, f"Error: {str(e)}")
            
        return []

    def test_get_product_by_id(self, product_id, product_name):
        """Test GET /api/products/{id} endpoint"""
        try:
            response = requests.get(f"{self.api_url}/products/{product_id}", timeout=10)
            success = response.status_code == 200
            
            if success:
                product = response.json()
                required_fields = ['id', 'name', 'grade', 'origin', 'description', 'specifications', 'image_url', 'features']
                
                missing_fields = [field for field in required_fields if field not in product]
                if not missing_fields:
                    self.log_test(f"Get Product by ID ({product_name})", True, f"All required fields present")
                else:
                    self.log_test(f"Get Product by ID ({product_name})", False, f"Missing fields: {missing_fields}")
            else:
                self.log_test(f"Get Product by ID ({product_name})", False, f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_test(f"Get Product by ID ({product_name})", False, f"Error: {str(e)}")

    def test_contact_form_submission(self):
        """Test POST /api/contact endpoint"""
        test_data = {
            "name": "Test User",
            "email": "test@example.com",
            "company": "Test Company",
            "country": "Test Country",
            "message": "This is a test inquiry for cardamom export."
        }
        
        try:
            response = requests.post(
                f"{self.api_url}/contact", 
                json=test_data,
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            success = response.status_code == 200
            
            if success:
                contact_response = response.json()
                required_fields = ['id', 'name', 'email', 'message', 'created_at']
                
                missing_fields = [field for field in required_fields if field not in contact_response]
                if not missing_fields:
                    self.log_test("Contact Form Submission", True, f"Contact inquiry created with ID: {contact_response.get('id')}")
                else:
                    self.log_test("Contact Form Submission", False, f"Missing fields in response: {missing_fields}")
            else:
                self.log_test("Contact Form Submission", False, f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_test("Contact Form Submission", False, f"Error: {str(e)}")

    def test_contact_form_validation(self):
        """Test contact form validation with invalid data"""
        # Test missing required fields
        invalid_data = {
            "name": "",  # Empty name
            "email": "invalid-email",  # Invalid email
            "message": ""  # Empty message
        }
        
        try:
            response = requests.post(
                f"{self.api_url}/contact", 
                json=invalid_data,
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            
            # Should return 422 for validation error
            if response.status_code == 422:
                self.log_test("Contact Form Validation", True, "Properly validates invalid data")
            else:
                self.log_test("Contact Form Validation", False, f"Expected 422, got {response.status_code}")
                
        except Exception as e:
            self.log_test("Contact Form Validation", False, f"Error: {str(e)}")

    def run_all_tests(self):
        """Run all backend API tests"""
        print("🚀 Starting Cardamom Export API Tests")
        print(f"Testing against: {self.base_url}")
        print("=" * 50)
        
        # Test root endpoint
        self.test_root_endpoint()
        
        # Test products endpoints
        products = self.test_get_products()
        
        # Test individual product endpoints
        for product in products[:2]:  # Test first 2 products to save time
            self.test_get_product_by_id(product.get('id'), product.get('name'))
        
        # Test contact form
        self.test_contact_form_submission()
        self.test_contact_form_validation()
        
        # Print summary
        print("\n" + "=" * 50)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print("⚠️  Some tests failed")
            return 1

def main():
    tester = CardamomAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())