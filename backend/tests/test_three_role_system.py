"""
Backend tests for the 3-role (admin/seller/buyer/both) migration.
Covers: register with role, admin approval, seller product create/approve,
buyer bid flow, seller accept/reject bids.
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/')
ADMIN_EMAIL = "admin@cardamomspicescentre.com"
ADMIN_PASSWORD = "admin123"

TS = int(time.time())


def _post(path, **kw):
    return requests.post(f"{BASE_URL}{path}", timeout=30, **kw)


def _get(path, **kw):
    return requests.get(f"{BASE_URL}{path}", timeout=30, **kw)


def _put(path, **kw):
    return requests.put(f"{BASE_URL}{path}", timeout=30, **kw)


def _patch(path, **kw):
    return requests.patch(f"{BASE_URL}{path}", timeout=30, **kw)


@pytest.fixture(scope="module")
def admin_headers():
    r = _post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    assert r.json()["user"]["role"] == "admin"
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _register(email, role, full_name):
    return _post("/api/auth/register", json={
        "email": email, "password": "test123", "full_name": full_name,
        "company_name": "TEST Co", "country": "India", "phone": "+9100000",
        "role": role
    })


def _login(email):
    r = _post("/api/auth/login", json={"email": email, "password": "test123"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"], r.json()["user"]


@pytest.fixture(scope="module")
def seller_ctx(admin_headers):
    email = f"TEST_seller_{TS}@test.com"
    r = _register(email, "seller", "Test Seller")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["role"] == "seller"
    assert data["status"] == "pending"
    uid = data["id"]
    # Approve
    ar = _patch(f"/api/admin/users/{uid}/status?status=approved", headers=admin_headers)
    assert ar.status_code == 200
    token, user = _login(email)
    return {"token": token, "headers": {"Authorization": f"Bearer {token}"}, "id": user["id"], "email": email}


@pytest.fixture(scope="module")
def buyer_ctx(admin_headers):
    email = f"TEST_buyer_{TS}@test.com"
    r = _register(email, "buyer", "Test Buyer")
    assert r.status_code == 200
    assert r.json()["role"] == "buyer"
    uid = r.json()["id"]
    ar = _patch(f"/api/admin/users/{uid}/status?status=approved", headers=admin_headers)
    assert ar.status_code == 200
    token, user = _login(email)
    return {"token": token, "headers": {"Authorization": f"Bearer {token}"}, "id": user["id"], "email": email}


# === Auth / Registration ===
class TestRegistration:
    def test_register_both_role(self):
        email = f"TEST_both_{TS}@test.com"
        r = _register(email, "both", "Test Both")
        assert r.status_code == 200
        assert r.json()["role"] == "both"
        assert r.json()["status"] == "pending"

    def test_register_invalid_role_rejected(self):
        email = f"TEST_inv_{TS}@test.com"
        r = _register(email, "customer", "Invalid")
        assert r.status_code == 422

    def test_duplicate_email_400(self, seller_ctx):
        r = _register(seller_ctx["email"], "buyer", "Dup")
        assert r.status_code == 400

    def test_admin_login(self, admin_headers):
        assert "Authorization" in admin_headers


# === Public products only returns approved ===
class TestPublicProducts:
    def test_public_products_all_approved(self):
        r = _get("/api/products")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        for p in data:
            assert p["approval_status"] == "approved"


# === Seller flow ===
class TestSellerFlow:
    def test_seller_create_product_pending(self, seller_ctx):
        payload = {
            "name": f"TEST_SellerProd_{TS}",
            "size": "7 mm", "description": "Seller upload test",
            "features": ["Test"], "image_url": "https://example.com/img.jpg",
            "media_paths": []
        }
        r = _post("/api/seller/products", json=payload, headers=seller_ctx["headers"])
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["approval_status"] == "pending"
        assert data["seller_id"] == seller_ctx["id"]
        assert data["seller_name"] == "Test Seller"
        seller_ctx["product_id"] = data["id"]

    def test_seller_sees_own_products(self, seller_ctx):
        r = _get("/api/seller/products", headers=seller_ctx["headers"])
        assert r.status_code == 200
        ids = [p["id"] for p in r.json()]
        assert seller_ctx["product_id"] in ids

    def test_pending_product_not_in_public_list(self, seller_ctx):
        r = _get("/api/products")
        ids = [p["id"] for p in r.json()]
        assert seller_ctx["product_id"] not in ids

    def test_buyer_cannot_create_seller_product(self, buyer_ctx):
        payload = {"name": "TEST_bad", "size": "1", "description": "x",
                   "features": [], "image_url": "", "media_paths": []}
        r = _post("/api/seller/products", json=payload, headers=buyer_ctx["headers"])
        assert r.status_code == 403


# === Admin approves product ===
class TestAdminProductApproval:
    def test_admin_all_products_includes_pending(self, admin_headers, seller_ctx):
        r = _get("/api/admin/products", headers=admin_headers)
        assert r.status_code == 200
        ids = [p["id"] for p in r.json()]
        assert seller_ctx["product_id"] in ids

    def test_admin_approves_seller_product(self, admin_headers, seller_ctx):
        pid = seller_ctx["product_id"]
        r = _patch(f"/api/admin/products/{pid}/status?approval_status=approved",
                   headers=admin_headers)
        assert r.status_code == 200, r.text
        # Now visible publicly
        pub = _get(f"/api/products/{pid}")
        assert pub.status_code == 200
        assert pub.json()["approval_status"] == "approved"

    def test_admin_products_filter_pending(self, admin_headers):
        r = _get("/api/admin/products?approval_status=pending", headers=admin_headers)
        assert r.status_code == 200
        for p in r.json():
            assert p["approval_status"] == "pending"

    def test_admin_users_list_has_roles(self, admin_headers, seller_ctx, buyer_ctx):
        r = _get("/api/admin/users", headers=admin_headers)
        assert r.status_code == 200
        users = {u["email"]: u for u in r.json()}
        assert users[seller_ctx["email"]]["role"] == "seller"
        assert users[buyer_ctx["email"]]["role"] == "buyer"


# === Buyer bids + seller accepts ===
class TestBidFlow:
    def test_buyer_places_bid(self, buyer_ctx, seller_ctx):
        payload = {
            "product_id": seller_ctx["product_id"],
            "quantity_kg": 100, "price_per_kg": 1500,
            "currency": "INR", "market_type": "domestic",
            "additional_notes": "TEST bid"
        }
        r = _post("/api/bids", json=payload, headers=buyer_ctx["headers"])
        assert r.status_code == 200, r.text
        bid = r.json()
        assert bid["buyer_id"] == buyer_ctx["id"]
        assert bid["seller_id"] == seller_ctx["id"]
        assert bid["seller_name"] == "Test Seller"
        assert bid["status"] == "pending"
        buyer_ctx["bid_id"] = bid["id"]

    def test_buyer_sees_own_bids(self, buyer_ctx):
        r = _get("/api/bids/my", headers=buyer_ctx["headers"])
        assert r.status_code == 200
        ids = [b["id"] for b in r.json()]
        assert buyer_ctx["bid_id"] in ids

    def test_seller_sees_bids_on_own_products(self, seller_ctx, buyer_ctx):
        r = _get("/api/seller/bids", headers=seller_ctx["headers"])
        assert r.status_code == 200
        ids = [b["id"] for b in r.json()]
        assert buyer_ctx["bid_id"] in ids

    def test_seller_bid_summary(self, seller_ctx):
        r = _get("/api/seller/bids/summary", headers=seller_ctx["headers"])
        assert r.status_code == 200
        data = r.json()
        for key in ("total", "today", "pending", "accepted", "rejected"):
            assert key in data
        assert data["total"] >= 1

    def test_seller_accepts_bid(self, seller_ctx, buyer_ctx):
        bid_id = buyer_ctx["bid_id"]
        r = _put(f"/api/seller/bids/{bid_id}",
                 json={"status": "accepted", "notes": "TEST accept"},
                 headers=seller_ctx["headers"])
        assert r.status_code == 200, r.text
        bid = r.json()["bid"]
        assert bid["status"] == "accepted"
        assert bid["seller_notes"] == "TEST accept"
        assert bid["reviewed_by"] == "seller"

    def test_seller_cannot_update_other_sellers_bid(self, seller_ctx):
        # Use random bid_id that doesn't belong
        r = _put("/api/seller/bids/nonexistent-xxx",
                 json={"status": "rejected"}, headers=seller_ctx["headers"])
        assert r.status_code == 404

    def test_buyer_cannot_access_seller_bids(self, buyer_ctx):
        r = _get("/api/seller/bids", headers=buyer_ctx["headers"])
        assert r.status_code == 403


# === File upload ===
class TestFileUpload:
    def test_seller_can_upload(self, seller_ctx):
        # tiny valid PNG bytes
        png = (b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00"
               b"\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx"
               b"\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82")
        files = {"file": ("test.png", png, "image/png")}
        r = requests.post(f"{BASE_URL}/api/upload", files=files,
                          headers=seller_ctx["headers"], timeout=60)
        assert r.status_code == 200, r.text
        assert "path" in r.json()

    def test_buyer_cannot_upload(self, buyer_ctx):
        files = {"file": ("test.png", b"x", "image/png")}
        r = requests.post(f"{BASE_URL}/api/upload", files=files,
                          headers=buyer_ctx["headers"], timeout=60)
        assert r.status_code == 403


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
