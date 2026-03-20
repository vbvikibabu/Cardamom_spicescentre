"""
Backend API Tests for Iteration 3 - New Features:
1. Admin Product CRUD (POST/PUT/DELETE /api/admin/products)
2. Admin Quote Response (PATCH /api/admin/quotes/{id})
3. Customer Quote Request (POST /api/quotes/request)
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Admin credentials
ADMIN_EMAIL = "admin@cardamomspicescentre.com"
ADMIN_PASSWORD = "admin123"


class TestAdminAuthentication:
    """Tests to verify admin login works"""
    
    def test_admin_login_success(self):
        """Admin can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "admin"
        assert data["user"]["status"] == "approved"


class TestAdminProductCRUD:
    """Tests for Admin Product Management (POST/PUT/DELETE /api/admin/products)"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin JWT token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, admin_token):
        """Headers with admin auth token"""
        return {"Authorization": f"Bearer {admin_token}"}
    
    def test_admin_create_product_success(self, auth_headers):
        """Admin can create a new product"""
        payload = {
            "name": "TEST_Product_8mm_Super",
            "size": "8mm+",
            "description": "Test product for automated testing",
            "features": ["Feature 1", "Feature 2", "High quality"],
            "image_url": "https://example.com/test-image.jpg"
        }
        response = requests.post(f"{BASE_URL}/api/admin/products", json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["name"] == payload["name"]
        assert data["size"] == payload["size"]
        assert data["description"] == payload["description"]
        assert data["features"] == payload["features"]
        assert "id" in data
        
        # Store product ID for cleanup
        TestAdminProductCRUD.created_product_id = data["id"]
    
    def test_admin_create_product_requires_auth(self):
        """Creating product without auth should fail"""
        payload = {
            "name": "TEST_Unauthorized_Product",
            "size": "5mm",
            "description": "Should not be created",
            "features": ["Test"],
            "image_url": "https://example.com/test.jpg"
        }
        response = requests.post(f"{BASE_URL}/api/admin/products", json=payload)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    def test_admin_create_product_requires_admin_role(self):
        """Customer cannot create products"""
        # First register a test customer
        timestamp = int(time.time())
        test_email = f"test_noadmin_{timestamp}@example.com"
        
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": "testpass123",
            "full_name": "Test Customer"
        })
        
        if reg_response.status_code == 200:
            # Login as customer
            login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": test_email,
                "password": "testpass123"
            })
            if login_response.status_code == 200:
                customer_token = login_response.json()["access_token"]
                
                # Try to create product
                payload = {
                    "name": "TEST_Customer_Product",
                    "size": "5mm",
                    "description": "Customer should not create this",
                    "features": ["Test"],
                    "image_url": "https://example.com/test.jpg"
                }
                response = requests.post(
                    f"{BASE_URL}/api/admin/products",
                    json=payload,
                    headers={"Authorization": f"Bearer {customer_token}"}
                )
                assert response.status_code == 403, f"Expected 403, got {response.status_code}"
    
    def test_admin_update_product_success(self, auth_headers):
        """Admin can update an existing product"""
        # First, get existing products to find one to update
        products_response = requests.get(f"{BASE_URL}/api/products")
        assert products_response.status_code == 200
        products = products_response.json()
        assert len(products) > 0, "No products available for update test"
        
        product_id = products[0]["id"]
        
        # Update the product
        update_payload = {
            "name": "TEST_Updated_Product_Name",
            "size": "Updated Size",
            "description": "Updated description for testing",
            "features": ["Updated Feature 1", "Updated Feature 2"],
            "image_url": "https://example.com/updated-image.jpg"
        }
        response = requests.put(
            f"{BASE_URL}/api/admin/products/{product_id}",
            json=update_payload,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["name"] == update_payload["name"]
        assert data["description"] == update_payload["description"]
    
    def test_admin_update_nonexistent_product(self, auth_headers):
        """Updating nonexistent product returns 404"""
        update_payload = {
            "name": "Nonexistent Product",
            "size": "N/A",
            "description": "This should fail",
            "features": ["Test"],
            "image_url": "https://example.com/test.jpg"
        }
        response = requests.put(
            f"{BASE_URL}/api/admin/products/nonexistent-id-12345",
            json=update_payload,
            headers=auth_headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    def test_admin_delete_product_success(self, auth_headers):
        """Admin can delete a product"""
        # Create a product to delete
        payload = {
            "name": "TEST_Product_To_Delete",
            "size": "Delete Test",
            "description": "This product will be deleted",
            "features": ["Delete me"],
            "image_url": "https://example.com/delete.jpg"
        }
        create_response = requests.post(f"{BASE_URL}/api/admin/products", json=payload, headers=auth_headers)
        assert create_response.status_code == 200
        product_id = create_response.json()["id"]
        
        # Delete the product
        delete_response = requests.delete(f"{BASE_URL}/api/admin/products/{product_id}", headers=auth_headers)
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}"
        
        # Verify product is deleted by trying to get it
        get_response = requests.get(f"{BASE_URL}/api/products/{product_id}")
        assert get_response.status_code == 404, "Product should be deleted"
    
    def test_admin_delete_nonexistent_product(self, auth_headers):
        """Deleting nonexistent product returns 404"""
        response = requests.delete(
            f"{BASE_URL}/api/admin/products/nonexistent-id-99999",
            headers=auth_headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestAdminQuoteResponse:
    """Tests for Admin Quote Response (PATCH /api/admin/quotes/{id})"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin JWT token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, admin_token):
        """Headers with admin auth token"""
        return {"Authorization": f"Bearer {admin_token}"}
    
    @pytest.fixture(scope="class")
    def test_quote_id(self, auth_headers):
        """Create an approved customer and quote for testing"""
        timestamp = int(time.time())
        test_email = f"quotetest_{timestamp}@example.com"
        
        # Register customer
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": "testpass123",
            "full_name": "Quote Test Customer"
        })
        if reg_response.status_code != 200:
            pytest.skip("Could not create test customer")
        
        user_id = reg_response.json()["id"]
        
        # Admin approves the customer
        approve_response = requests.patch(
            f"{BASE_URL}/api/admin/users/{user_id}/status?status=approved",
            headers=auth_headers
        )
        if approve_response.status_code != 200:
            pytest.skip("Could not approve test customer")
        
        # Login as approved customer
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": "testpass123"
        })
        if login_response.status_code != 200:
            pytest.skip("Could not login test customer")
        
        customer_token = login_response.json()["access_token"]
        
        # Get a product ID
        products_response = requests.get(f"{BASE_URL}/api/products")
        if products_response.status_code != 200 or len(products_response.json()) == 0:
            pytest.skip("No products available")
        
        product_id = products_response.json()[0]["id"]
        
        # Create a quote request
        quote_response = requests.post(
            f"{BASE_URL}/api/quotes/request",
            json={
                "product_id": product_id,
                "quantity": 100,
                "market_type": "export",
                "destination_country": "UAE",
                "shipping_method": "sea",
                "additional_notes": "Test quote for admin response testing"
            },
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        if quote_response.status_code != 200:
            pytest.skip(f"Could not create test quote: {quote_response.text}")
        
        return quote_response.json()["id"]
    
    def test_admin_get_all_quotes(self, auth_headers):
        """Admin can get all quotes"""
        response = requests.get(f"{BASE_URL}/api/admin/quotes", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list)
    
    def test_admin_respond_to_quote_with_pricing(self, auth_headers, test_quote_id):
        """Admin can respond to quote with pricing fields"""
        payload = {
            "base_price": 2500.00,
            "freight_cost": 350.50,
            "final_price": 2850.50,
            "currency": "USD",
            "admin_notes": "Test pricing response from automated test",
            "status": "quoted"
        }
        response = requests.patch(
            f"{BASE_URL}/api/admin/quotes/{test_quote_id}",
            json=payload,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "quote" in data
        quote = data["quote"]
        assert quote["base_price"] == payload["base_price"]
        assert quote["freight_cost"] == payload["freight_cost"]
        assert quote["final_price"] == payload["final_price"]
        assert quote["currency"] == payload["currency"]
        assert quote["admin_notes"] == payload["admin_notes"]
        assert quote["status"] == payload["status"]
    
    def test_admin_update_quote_status_only(self, auth_headers, test_quote_id):
        """Admin can update just the quote status"""
        payload = {"status": "accepted"}
        response = requests.patch(
            f"{BASE_URL}/api/admin/quotes/{test_quote_id}",
            json=payload,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["quote"]["status"] == "accepted"
    
    def test_admin_update_nonexistent_quote(self, auth_headers):
        """Updating nonexistent quote returns 404"""
        payload = {"status": "quoted", "final_price": 1000}
        response = requests.patch(
            f"{BASE_URL}/api/admin/quotes/nonexistent-quote-id",
            json=payload,
            headers=auth_headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    def test_admin_quote_requires_auth(self):
        """Updating quote without auth should fail"""
        payload = {"status": "quoted"}
        response = requests.patch(
            f"{BASE_URL}/api/admin/quotes/some-id",
            json=payload
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"


class TestCustomerQuoteRequest:
    """Tests for Customer Quote Request (POST /api/quotes/request)"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin JWT token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def approved_customer(self, admin_token):
        """Create and approve a customer for quote testing"""
        timestamp = int(time.time())
        test_email = f"quotecust_{timestamp}@example.com"
        
        # Register
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": "testpass123",
            "full_name": "Quote Customer Test",
            "company_name": "Test Company Ltd",
            "country": "India"
        })
        if reg_response.status_code != 200:
            pytest.skip("Could not create test customer")
        
        user_id = reg_response.json()["id"]
        
        # Admin approves
        approve_response = requests.patch(
            f"{BASE_URL}/api/admin/users/{user_id}/status?status=approved",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        if approve_response.status_code != 200:
            pytest.skip("Could not approve test customer")
        
        # Login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": "testpass123"
        })
        if login_response.status_code != 200:
            pytest.skip("Could not login test customer")
        
        return {
            "token": login_response.json()["access_token"],
            "email": test_email,
            "user_id": user_id
        }
    
    @pytest.fixture(scope="class")
    def pending_customer(self):
        """Create a pending (not approved) customer"""
        timestamp = int(time.time())
        test_email = f"pendingcust_{timestamp}@example.com"
        
        # Register
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": "testpass123",
            "full_name": "Pending Customer"
        })
        if reg_response.status_code != 200:
            pytest.skip("Could not create pending customer")
        
        # Login (but stay pending)
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": "testpass123"
        })
        if login_response.status_code != 200:
            pytest.skip("Could not login pending customer")
        
        return {
            "token": login_response.json()["access_token"],
            "email": test_email
        }
    
    @pytest.fixture(scope="class")
    def product_id(self):
        """Get a valid product ID"""
        response = requests.get(f"{BASE_URL}/api/products")
        if response.status_code != 200 or len(response.json()) == 0:
            pytest.skip("No products available")
        return response.json()[0]["id"]
    
    def test_approved_customer_can_request_quote_domestic(self, approved_customer, product_id):
        """Approved customer can submit a domestic quote request"""
        payload = {
            "product_id": product_id,
            "quantity": 50,
            "market_type": "domestic",
            "additional_notes": "Test domestic quote request"
        }
        response = requests.post(
            f"{BASE_URL}/api/quotes/request",
            json=payload,
            headers={"Authorization": f"Bearer {approved_customer['token']}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["quantity"] == payload["quantity"]
        assert data["market_type"] == payload["market_type"]
        assert data["additional_notes"] == payload["additional_notes"]
        assert data["status"] == "pending"
        assert "id" in data
        assert data["customer_email"] == approved_customer["email"]
    
    def test_approved_customer_can_request_quote_export(self, approved_customer, product_id):
        """Approved customer can submit an export quote request with shipping details"""
        payload = {
            "product_id": product_id,
            "quantity": 500,
            "market_type": "export",
            "destination_country": "United States",
            "shipping_method": "air",
            "additional_notes": "Urgent shipment required"
        }
        response = requests.post(
            f"{BASE_URL}/api/quotes/request",
            json=payload,
            headers={"Authorization": f"Bearer {approved_customer['token']}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["quantity"] == payload["quantity"]
        assert data["market_type"] == payload["market_type"]
        assert data["destination_country"] == payload["destination_country"]
        assert data["shipping_method"] == payload["shipping_method"]
    
    def test_pending_customer_cannot_request_quote(self, pending_customer, product_id):
        """Pending customer should be blocked from requesting quotes"""
        payload = {
            "product_id": product_id,
            "quantity": 100,
            "market_type": "domestic"
        }
        response = requests.post(
            f"{BASE_URL}/api/quotes/request",
            json=payload,
            headers={"Authorization": f"Bearer {pending_customer['token']}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        assert "pending" in response.json().get("detail", "").lower() or "approval" in response.json().get("detail", "").lower()
    
    def test_unauthenticated_cannot_request_quote(self, product_id):
        """Unauthenticated user cannot request quotes"""
        payload = {
            "product_id": product_id,
            "quantity": 100,
            "market_type": "domestic"
        }
        response = requests.post(f"{BASE_URL}/api/quotes/request", json=payload)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    def test_quote_request_invalid_product(self, approved_customer):
        """Quote request with invalid product ID returns 404"""
        payload = {
            "product_id": "invalid-product-id-99999",
            "quantity": 100,
            "market_type": "domestic"
        }
        response = requests.post(
            f"{BASE_URL}/api/quotes/request",
            json=payload,
            headers={"Authorization": f"Bearer {approved_customer['token']}"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    def test_customer_can_view_their_quotes(self, approved_customer):
        """Approved customer can view their own quotes"""
        response = requests.get(
            f"{BASE_URL}/api/quotes/my-quotes",
            headers={"Authorization": f"Bearer {approved_customer['token']}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list)
        # Should have at least the quotes we created in previous tests
        if len(data) > 0:
            assert all(q["customer_email"] == approved_customer["email"] for q in data)


class TestProductsEndpoint:
    """Tests for public products endpoint"""
    
    def test_get_all_products(self):
        """Public can get all products"""
        response = requests.get(f"{BASE_URL}/api/products")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1  # Should have at least initial seeded products
    
    def test_get_single_product(self):
        """Public can get a single product by ID"""
        # Get all products first
        all_response = requests.get(f"{BASE_URL}/api/products")
        assert all_response.status_code == 200
        products = all_response.json()
        assert len(products) > 0
        
        product_id = products[0]["id"]
        
        # Get single product
        response = requests.get(f"{BASE_URL}/api/products/{product_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == product_id
        assert "name" in data
        assert "size" in data
        assert "features" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
