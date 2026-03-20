"""
Backend API Tests for Cardamom B2B E-Commerce Platform
Tests: Authentication, User Management, Admin Functions, Products
"""
import pytest
import requests
import os
import time
import random
import string

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@cardamomspicescentre.com"
ADMIN_PASSWORD = "admin123"

# Generate unique test email to avoid conflicts
def generate_unique_email():
    random_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"test_{random_str}@example.com"


class TestHealthCheck:
    """Basic API Health Checks"""
    
    def test_api_root_endpoint(self):
        """Test API root endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "Cardamom" in data["message"]
        print(f"✓ API root endpoint returns: {data}")


class TestProducts:
    """Product API Tests"""
    
    def test_get_products_list(self):
        """Test GET /api/products returns product list"""
        response = requests.get(f"{BASE_URL}/api/products")
        assert response.status_code == 200
        products = response.json()
        assert isinstance(products, list)
        assert len(products) == 3, f"Expected 3 products, got {len(products)}"
        
        # Verify product structure
        for product in products:
            assert "id" in product
            assert "name" in product
            assert "size" in product
            assert "description" in product
            assert "features" in product
            assert "image_url" in product
        print(f"✓ Products endpoint returns {len(products)} cardamom products")
    
    def test_get_single_product(self):
        """Test GET /api/products/{id} returns single product"""
        # First get product list
        response = requests.get(f"{BASE_URL}/api/products")
        products = response.json()
        product_id = products[0]["id"]
        
        # Get single product
        response = requests.get(f"{BASE_URL}/api/products/{product_id}")
        assert response.status_code == 200
        product = response.json()
        assert product["id"] == product_id
        print(f"✓ Single product endpoint returns: {product['name']}")
    
    def test_get_nonexistent_product(self):
        """Test GET /api/products/{invalid_id} returns 404"""
        response = requests.get(f"{BASE_URL}/api/products/nonexistent-id")
        assert response.status_code == 404
        print("✓ Non-existent product correctly returns 404")


class TestAdminLogin:
    """Admin Authentication Tests"""
    
    def test_admin_login_success(self):
        """Test admin login with correct credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        
        # Verify token structure
        assert "access_token" in data
        assert "token_type" in data
        assert data["token_type"] == "bearer"
        
        # Verify user data
        assert "user" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "admin"
        assert data["user"]["status"] == "approved"
        print(f"✓ Admin login successful, token: {data['access_token'][:20]}...")
    
    def test_admin_login_wrong_password(self):
        """Test admin login with incorrect password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        print("✓ Wrong password correctly returns 401")
    
    def test_login_nonexistent_user(self):
        """Test login with non-existent email"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent@example.com",
            "password": "anypassword"
        })
        assert response.status_code == 401
        print("✓ Non-existent user login correctly returns 401")


class TestCustomerRegistration:
    """Customer Registration Flow Tests"""
    
    def test_customer_registration_success(self):
        """Test new customer registration creates pending user"""
        unique_email = generate_unique_email()
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "Test1234",
            "full_name": "Test User",
            "company_name": "Test Corp",
            "country": "UAE",
            "phone": "+971501234567"
        })
        assert response.status_code == 200
        user = response.json()
        
        # Verify user data
        assert user["email"] == unique_email
        assert user["full_name"] == "Test User"
        assert user["role"] == "customer"
        assert user["status"] == "pending", "New users should have pending status"
        assert "id" in user
        print(f"✓ Customer registration successful: {unique_email}, status: {user['status']}")
        
        # Store for later cleanup
        return user
    
    def test_duplicate_email_registration(self):
        """Test registration with existing email fails"""
        # Try registering with admin email
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": ADMIN_EMAIL,
            "password": "Test1234",
            "full_name": "Duplicate User"
        })
        assert response.status_code == 400
        data = response.json()
        assert "already registered" in data["detail"].lower()
        print("✓ Duplicate email registration correctly returns 400")


class TestPendingCustomerLogin:
    """Pending Customer Login Tests"""
    
    def test_pending_customer_login(self):
        """Test pending customer can login but has pending status"""
        # First register a new user
        unique_email = generate_unique_email()
        
        requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "Test1234",
            "full_name": "Pending User"
        })
        
        # Now login
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": unique_email,
            "password": "Test1234"
        })
        assert response.status_code == 200
        data = response.json()
        
        # User should have pending status
        assert data["user"]["status"] == "pending"
        print(f"✓ Pending customer login successful, status: {data['user']['status']}")


class TestAuthMe:
    """Auth /me endpoint tests"""
    
    def test_get_me_authenticated(self):
        """Test GET /api/auth/me with valid token"""
        # Login first
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = login_response.json()["access_token"]
        
        # Get user info
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200
        user = response.json()
        assert user["email"] == ADMIN_EMAIL
        assert user["role"] == "admin"
        print(f"✓ GET /me returns correct user: {user['full_name']}")
    
    def test_get_me_no_token(self):
        """Test GET /api/auth/me without token returns 401"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
        print("✓ GET /me without token correctly returns 401")
    
    def test_get_me_invalid_token(self):
        """Test GET /api/auth/me with invalid token returns 401"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": "Bearer invalid_token_here"
        })
        assert response.status_code == 401
        print("✓ GET /me with invalid token correctly returns 401")


class TestAdminUserManagement:
    """Admin User Management Tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_get_all_users(self, admin_token):
        """Test admin can get all users"""
        response = requests.get(f"{BASE_URL}/api/admin/users", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200
        users = response.json()
        assert isinstance(users, list)
        
        # Admin user should be in list
        admin_users = [u for u in users if u["role"] == "admin"]
        assert len(admin_users) >= 1
        print(f"✓ Admin can view all users, total: {len(users)}")
    
    def test_approve_user(self, admin_token):
        """Test admin can approve a pending user"""
        # First register a new pending user
        unique_email = generate_unique_email()
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "Test1234",
            "full_name": "User To Approve"
        })
        user_id = reg_response.json()["id"]
        
        # Approve the user
        response = requests.patch(
            f"{BASE_URL}/api/admin/users/{user_id}/status?status=approved",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["status"] == "approved"
        print(f"✓ Admin successfully approved user: {unique_email}")
        
        # Verify approved user can now access protected routes
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": unique_email,
            "password": "Test1234"
        })
        assert login_response.json()["user"]["status"] == "approved"
        print("✓ Approved user has correct status after login")
    
    def test_reject_user(self, admin_token):
        """Test admin can reject a pending user"""
        # First register a new pending user
        unique_email = generate_unique_email()
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "Test1234",
            "full_name": "User To Reject"
        })
        user_id = reg_response.json()["id"]
        
        # Reject the user
        response = requests.patch(
            f"{BASE_URL}/api/admin/users/{user_id}/status?status=rejected",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["status"] == "rejected"
        print(f"✓ Admin successfully rejected user: {unique_email}")
    
    def test_get_users_without_auth(self):
        """Test /admin/users without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/admin/users")
        assert response.status_code == 401
        print("✓ Admin users endpoint correctly requires authentication")
    
    def test_get_users_as_customer(self):
        """Test customer cannot access admin endpoints"""
        # Register and login as customer
        unique_email = generate_unique_email()
        requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "Test1234",
            "full_name": "Regular Customer"
        })
        
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": unique_email,
            "password": "Test1234"
        })
        customer_token = login_response.json()["access_token"]
        
        # Try to access admin endpoint
        response = requests.get(f"{BASE_URL}/api/admin/users", headers={
            "Authorization": f"Bearer {customer_token}"
        })
        assert response.status_code == 403
        print("✓ Customer correctly cannot access admin endpoints (403)")


class TestQuoteEndpoints:
    """Quote Request Tests"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["access_token"]
    
    @pytest.fixture
    def approved_customer(self, admin_token):
        """Create and approve a customer for testing"""
        unique_email = generate_unique_email()
        
        # Register
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "Test1234",
            "full_name": "Approved Customer"
        })
        user_id = reg_response.json()["id"]
        
        # Approve
        requests.patch(
            f"{BASE_URL}/api/admin/users/{user_id}/status?status=approved",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        # Login and get token
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": unique_email,
            "password": "Test1234"
        })
        return login_response.json()["access_token"]
    
    def test_get_my_quotes_approved_customer(self, approved_customer):
        """Test approved customer can access their quotes"""
        response = requests.get(f"{BASE_URL}/api/quotes/my-quotes", headers={
            "Authorization": f"Bearer {approved_customer}"
        })
        assert response.status_code == 200
        quotes = response.json()
        assert isinstance(quotes, list)
        print(f"✓ Approved customer can access quotes endpoint, count: {len(quotes)}")
    
    def test_get_my_quotes_pending_customer(self):
        """Test pending customer cannot access quotes"""
        # Register but don't approve
        unique_email = generate_unique_email()
        requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "Test1234",
            "full_name": "Pending Customer"
        })
        
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": unique_email,
            "password": "Test1234"
        })
        token = login_response.json()["access_token"]
        
        response = requests.get(f"{BASE_URL}/api/quotes/my-quotes", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 403
        print("✓ Pending customer correctly cannot access quotes (403)")
    
    def test_admin_get_all_quotes(self, admin_token):
        """Test admin can view all quotes"""
        response = requests.get(f"{BASE_URL}/api/admin/quotes", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200
        quotes = response.json()
        assert isinstance(quotes, list)
        print(f"✓ Admin can view all quotes, count: {len(quotes)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
