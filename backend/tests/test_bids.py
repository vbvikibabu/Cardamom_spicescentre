"""
Test suite for Bidding System - B2B Cardamom Trading App
Tests: POST /api/bids, GET /api/bids/my, GET /api/bids, GET /api/bids/summary, PUT /api/bids/{id}
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@cardamomspicescentre.com"
ADMIN_PASSWORD = "admin123"


class TestBidsBackend:
    """Bidding system backend API tests"""
    
    admin_token = None
    customer_token = None
    customer_id = None
    test_product_id = None
    test_bid_id = None
    test_customer_email = None
    
    @classmethod
    def setup_class(cls):
        """Setup: Login admin, create and approve test customer, get product ID"""
        # Admin login
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert resp.status_code == 200, f"Admin login failed: {resp.text}"
        cls.admin_token = resp.json()["access_token"]
        print(f"✓ Admin logged in")
        
        # Get a product ID for testing
        resp = requests.get(f"{BASE_URL}/api/products")
        assert resp.status_code == 200, f"Failed to get products: {resp.text}"
        products = resp.json()
        assert len(products) > 0, "No products found for testing"
        cls.test_product_id = products[0]["id"]
        print(f"✓ Using product ID: {cls.test_product_id}")
        
        # Register a unique test customer
        cls.test_customer_email = f"TEST_bidcust_{uuid.uuid4().hex[:8]}@example.com"
        resp = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": cls.test_customer_email,
            "password": "testpass123",
            "full_name": "Test Bid Customer",
            "company_name": "Test Bid Company",
            "country": "India",
            "phone": "+91-9876543210"
        })
        assert resp.status_code == 200, f"Customer registration failed: {resp.text}"
        cls.customer_id = resp.json()["id"]
        print(f"✓ Test customer registered: {cls.test_customer_email}")
        
        # Admin approves the customer
        resp = requests.patch(
            f"{BASE_URL}/api/admin/users/{cls.customer_id}/status?status=approved",
            headers={"Authorization": f"Bearer {cls.admin_token}"}
        )
        assert resp.status_code == 200, f"Customer approval failed: {resp.text}"
        print(f"✓ Customer approved")
        
        # Customer login
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": cls.test_customer_email,
            "password": "testpass123"
        })
        assert resp.status_code == 200, f"Customer login failed: {resp.text}"
        cls.customer_token = resp.json()["access_token"]
        print(f"✓ Customer logged in")
    
    # ═══════════════════════════════════════════════════════════════
    # POST /api/bids - Customer places bid
    # ═══════════════════════════════════════════════════════════════
    
    def test_01_create_bid_requires_auth(self):
        """POST /api/bids returns 401 without authentication"""
        resp = requests.post(f"{BASE_URL}/api/bids", json={
            "product_id": self.test_product_id,
            "quantity_kg": 100,
            "price_per_kg": 2500,
            "currency": "INR",
            "market_type": "domestic"
        })
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        print("✓ POST /api/bids requires authentication")
    
    def test_02_create_bid_requires_approved_customer(self):
        """POST /api/bids returns 403 for pending customer"""
        # Register a new pending customer
        pending_email = f"TEST_pending_{uuid.uuid4().hex[:8]}@example.com"
        resp = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": pending_email,
            "password": "testpass123",
            "full_name": "Pending Customer"
        })
        assert resp.status_code == 200
        
        # Login as pending customer
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": pending_email,
            "password": "testpass123"
        })
        assert resp.status_code == 200
        pending_token = resp.json()["access_token"]
        
        # Try to place bid
        resp = requests.post(f"{BASE_URL}/api/bids", json={
            "product_id": self.test_product_id,
            "quantity_kg": 100,
            "price_per_kg": 2500
        }, headers={"Authorization": f"Bearer {pending_token}"})
        assert resp.status_code == 403, f"Expected 403 for pending customer, got {resp.status_code}"
        print("✓ POST /api/bids requires approved customer status")
    
    def test_03_create_bid_validates_quantity_required(self):
        """POST /api/bids rejects bid without quantity"""
        resp = requests.post(f"{BASE_URL}/api/bids", json={
            "product_id": self.test_product_id,
            "price_per_kg": 2500,
            "currency": "INR"
        }, headers={"Authorization": f"Bearer {self.customer_token}"})
        assert resp.status_code == 400, f"Expected 400 for missing quantity, got {resp.status_code}"
        assert "quantity" in resp.text.lower() or "qty" in resp.text.lower(), f"Error should mention quantity: {resp.text}"
        print("✓ POST /api/bids validates at least one quantity required")
    
    def test_04_create_bid_validates_price_required(self):
        """POST /api/bids rejects bid without price"""
        resp = requests.post(f"{BASE_URL}/api/bids", json={
            "product_id": self.test_product_id,
            "quantity_kg": 100,
            "currency": "INR"
        }, headers={"Authorization": f"Bearer {self.customer_token}"})
        assert resp.status_code == 400, f"Expected 400 for missing price, got {resp.status_code}"
        assert "price" in resp.text.lower(), f"Error should mention price: {resp.text}"
        print("✓ POST /api/bids validates at least one price required")
    
    def test_05_create_bid_validates_product_exists(self):
        """POST /api/bids returns 404 for invalid product_id"""
        resp = requests.post(f"{BASE_URL}/api/bids", json={
            "product_id": "nonexistent-product-id",
            "quantity_kg": 100,
            "price_per_kg": 2500
        }, headers={"Authorization": f"Bearer {self.customer_token}"})
        assert resp.status_code == 404, f"Expected 404 for invalid product, got {resp.status_code}"
        print("✓ POST /api/bids validates product exists")
    
    def test_06_create_bid_with_kg_and_price_per_kg(self):
        """POST /api/bids creates bid with quantity_kg and price_per_kg"""
        resp = requests.post(f"{BASE_URL}/api/bids", json={
            "product_id": self.test_product_id,
            "quantity_kg": 500,
            "price_per_kg": 2500,
            "currency": "INR",
            "market_type": "domestic",
            "additional_notes": "Test bid with kg"
        }, headers={"Authorization": f"Bearer {self.customer_token}"})
        assert resp.status_code == 200, f"Bid creation failed: {resp.text}"
        
        bid = resp.json()
        TestBidsBackend.test_bid_id = bid["id"]
        
        # Verify bid data
        assert bid["quantity_kg"] == 500
        assert bid["price_per_kg"] == 2500
        assert bid["currency"] == "INR"
        assert bid["market_type"] == "domestic"
        assert bid["status"] == "pending"
        assert bid["customer_id"] == self.customer_id
        assert bid["product_id"] == self.test_product_id
        assert "product_name" in bid
        assert "product_size" in bid
        assert "bid_date" in bid
        print(f"✓ Bid created with kg: {bid['id']}")
    
    def test_07_create_bid_with_lot_and_price_per_lot(self):
        """POST /api/bids creates bid with quantity_lot and price_per_lot"""
        resp = requests.post(f"{BASE_URL}/api/bids", json={
            "product_id": self.test_product_id,
            "quantity_lot": 10,
            "price_per_lot": 50000,
            "currency": "USD",
            "market_type": "export"
        }, headers={"Authorization": f"Bearer {self.customer_token}"})
        assert resp.status_code == 200, f"Bid creation failed: {resp.text}"
        
        bid = resp.json()
        assert bid["quantity_lot"] == 10
        assert bid["price_per_lot"] == 50000
        assert bid["currency"] == "USD"
        assert bid["market_type"] == "export"
        print(f"✓ Bid created with lot: {bid['id']}")
    
    def test_08_create_bid_with_both_qty_and_price(self):
        """POST /api/bids creates bid with both kg and lot quantities/prices"""
        resp = requests.post(f"{BASE_URL}/api/bids", json={
            "product_id": self.test_product_id,
            "quantity_kg": 250,
            "quantity_lot": 5,
            "price_per_kg": 2600,
            "price_per_lot": 55000,
            "currency": "INR",
            "market_type": "domestic"
        }, headers={"Authorization": f"Bearer {self.customer_token}"})
        assert resp.status_code == 200, f"Bid creation failed: {resp.text}"
        
        bid = resp.json()
        assert bid["quantity_kg"] == 250
        assert bid["quantity_lot"] == 5
        assert bid["price_per_kg"] == 2600
        assert bid["price_per_lot"] == 55000
        print(f"✓ Bid created with both kg and lot: {bid['id']}")
    
    # ═══════════════════════════════════════════════════════════════
    # GET /api/bids/my - Customer gets their own bids
    # ═══════════════════════════════════════════════════════════════
    
    def test_09_get_my_bids_requires_auth(self):
        """GET /api/bids/my returns 401 without authentication"""
        resp = requests.get(f"{BASE_URL}/api/bids/my")
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        print("✓ GET /api/bids/my requires authentication")
    
    def test_10_get_my_bids_returns_customer_bids(self):
        """GET /api/bids/my returns only current customer's bids"""
        resp = requests.get(f"{BASE_URL}/api/bids/my", 
                          headers={"Authorization": f"Bearer {self.customer_token}"})
        assert resp.status_code == 200, f"Failed to get my bids: {resp.text}"
        
        bids = resp.json()
        assert isinstance(bids, list)
        assert len(bids) >= 3, f"Expected at least 3 bids, got {len(bids)}"
        
        # Verify all bids belong to this customer
        for bid in bids:
            assert bid["customer_id"] == self.customer_id, "Bid doesn't belong to current customer"
            assert "product_name" in bid
            assert "status" in bid
            assert "bid_date" in bid
        
        print(f"✓ GET /api/bids/my returns {len(bids)} bids for customer")
    
    # ═══════════════════════════════════════════════════════════════
    # GET /api/bids - Admin gets all bids
    # ═══════════════════════════════════════════════════════════════
    
    def test_11_get_all_bids_requires_admin(self):
        """GET /api/bids returns 403 for non-admin"""
        resp = requests.get(f"{BASE_URL}/api/bids",
                          headers={"Authorization": f"Bearer {self.customer_token}"})
        assert resp.status_code == 403, f"Expected 403 for customer, got {resp.status_code}"
        print("✓ GET /api/bids requires admin role")
    
    def test_12_get_all_bids_admin(self):
        """GET /api/bids returns all bids for admin"""
        resp = requests.get(f"{BASE_URL}/api/bids",
                          headers={"Authorization": f"Bearer {self.admin_token}"})
        assert resp.status_code == 200, f"Failed to get all bids: {resp.text}"
        
        bids = resp.json()
        assert isinstance(bids, list)
        assert len(bids) >= 3, f"Expected at least 3 bids, got {len(bids)}"
        
        # Verify bid structure
        for bid in bids:
            assert "id" in bid
            assert "customer_name" in bid
            assert "customer_email" in bid
            assert "product_name" in bid
            assert "status" in bid
        
        print(f"✓ GET /api/bids returns {len(bids)} bids for admin")
    
    def test_13_get_bids_filter_by_status_pending(self):
        """GET /api/bids?status=pending filters bids by pending status"""
        resp = requests.get(f"{BASE_URL}/api/bids?status=pending",
                          headers={"Authorization": f"Bearer {self.admin_token}"})
        assert resp.status_code == 200, f"Failed to filter bids: {resp.text}"
        
        bids = resp.json()
        for bid in bids:
            assert bid["status"] == "pending", f"Expected pending status, got {bid['status']}"
        
        print(f"✓ GET /api/bids?status=pending returns {len(bids)} pending bids")
    
    # ═══════════════════════════════════════════════════════════════
    # GET /api/bids/summary - Admin gets bid counts
    # ═══════════════════════════════════════════════════════════════
    
    def test_14_get_bids_summary_requires_admin(self):
        """GET /api/bids/summary returns 403 for non-admin"""
        resp = requests.get(f"{BASE_URL}/api/bids/summary",
                          headers={"Authorization": f"Bearer {self.customer_token}"})
        assert resp.status_code == 403, f"Expected 403 for customer, got {resp.status_code}"
        print("✓ GET /api/bids/summary requires admin role")
    
    def test_15_get_bids_summary_admin(self):
        """GET /api/bids/summary returns bid counts for admin"""
        resp = requests.get(f"{BASE_URL}/api/bids/summary",
                          headers={"Authorization": f"Bearer {self.admin_token}"})
        assert resp.status_code == 200, f"Failed to get summary: {resp.text}"
        
        summary = resp.json()
        assert "total" in summary
        assert "today" in summary
        assert "pending" in summary
        assert "accepted" in summary
        assert "rejected" in summary
        
        assert summary["total"] >= 3, f"Expected at least 3 total bids"
        assert summary["pending"] >= 3, f"Expected at least 3 pending bids"
        
        print(f"✓ GET /api/bids/summary: total={summary['total']}, pending={summary['pending']}, today={summary['today']}")
    
    # ═══════════════════════════════════════════════════════════════
    # PUT /api/bids/{id} - Admin accepts/rejects bid
    # ═══════════════════════════════════════════════════════════════
    
    def test_16_update_bid_requires_admin(self):
        """PUT /api/bids/{id} returns 403 for non-admin"""
        resp = requests.put(f"{BASE_URL}/api/bids/{self.test_bid_id}", json={
            "status": "accepted"
        }, headers={"Authorization": f"Bearer {self.customer_token}"})
        assert resp.status_code == 403, f"Expected 403 for customer, got {resp.status_code}"
        print("✓ PUT /api/bids/{id} requires admin role")
    
    def test_17_update_bid_accept_with_notes(self):
        """PUT /api/bids/{id} admin accepts bid with admin_notes"""
        resp = requests.put(f"{BASE_URL}/api/bids/{self.test_bid_id}", json={
            "status": "accepted",
            "admin_notes": "Good price, order confirmed"
        }, headers={"Authorization": f"Bearer {self.admin_token}"})
        assert resp.status_code == 200, f"Failed to accept bid: {resp.text}"
        
        result = resp.json()
        assert "bid" in result
        bid = result["bid"]
        assert bid["status"] == "accepted"
        assert bid["admin_notes"] == "Good price, order confirmed"
        
        print(f"✓ Bid {self.test_bid_id} accepted with notes")
    
    def test_18_update_bid_reject(self):
        """PUT /api/bids/{id} admin rejects bid"""
        # Create a new bid to reject
        resp = requests.post(f"{BASE_URL}/api/bids", json={
            "product_id": self.test_product_id,
            "quantity_kg": 50,
            "price_per_kg": 1500
        }, headers={"Authorization": f"Bearer {self.customer_token}"})
        assert resp.status_code == 200
        bid_to_reject = resp.json()["id"]
        
        # Reject it
        resp = requests.put(f"{BASE_URL}/api/bids/{bid_to_reject}", json={
            "status": "rejected",
            "admin_notes": "Price too low"
        }, headers={"Authorization": f"Bearer {self.admin_token}"})
        assert resp.status_code == 200, f"Failed to reject bid: {resp.text}"
        
        result = resp.json()
        assert result["bid"]["status"] == "rejected"
        assert result["bid"]["admin_notes"] == "Price too low"
        
        print(f"✓ Bid {bid_to_reject} rejected")
    
    def test_19_update_bid_not_found(self):
        """PUT /api/bids/{id} returns 404 for nonexistent bid"""
        resp = requests.put(f"{BASE_URL}/api/bids/nonexistent-bid-id", json={
            "status": "accepted"
        }, headers={"Authorization": f"Bearer {self.admin_token}"})
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}"
        print("✓ PUT /api/bids/{id} returns 404 for nonexistent bid")
    
    def test_20_get_bids_filter_by_status_accepted(self):
        """GET /api/bids?status=accepted filters bids by accepted status"""
        resp = requests.get(f"{BASE_URL}/api/bids?status=accepted",
                          headers={"Authorization": f"Bearer {self.admin_token}"})
        assert resp.status_code == 200, f"Failed to filter bids: {resp.text}"
        
        bids = resp.json()
        assert len(bids) >= 1, "Expected at least 1 accepted bid"
        for bid in bids:
            assert bid["status"] == "accepted", f"Expected accepted status, got {bid['status']}"
        
        print(f"✓ GET /api/bids?status=accepted returns {len(bids)} accepted bids")
    
    def test_21_get_bids_filter_by_status_rejected(self):
        """GET /api/bids?status=rejected filters bids by rejected status"""
        resp = requests.get(f"{BASE_URL}/api/bids?status=rejected",
                          headers={"Authorization": f"Bearer {self.admin_token}"})
        assert resp.status_code == 200, f"Failed to filter bids: {resp.text}"
        
        bids = resp.json()
        assert len(bids) >= 1, "Expected at least 1 rejected bid"
        for bid in bids:
            assert bid["status"] == "rejected", f"Expected rejected status, got {bid['status']}"
        
        print(f"✓ GET /api/bids?status=rejected returns {len(bids)} rejected bids")
    
    def test_22_verify_bid_summary_after_updates(self):
        """Verify bid summary counts after accept/reject operations"""
        resp = requests.get(f"{BASE_URL}/api/bids/summary",
                          headers={"Authorization": f"Bearer {self.admin_token}"})
        assert resp.status_code == 200
        
        summary = resp.json()
        assert summary["accepted"] >= 1, "Expected at least 1 accepted bid"
        assert summary["rejected"] >= 1, "Expected at least 1 rejected bid"
        
        print(f"✓ Summary after updates: accepted={summary['accepted']}, rejected={summary['rejected']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
