"""
Backend tests for file upload feature (iteration 4)
Tests: POST /api/upload, GET /api/files/{path}, Product media_paths
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
ADMIN_EMAIL = "admin@cardamomspicescentre.com"
ADMIN_PASSWORD = "admin123"

# Helper: Create small test image (1x1 red PNG)
def create_test_png():
    """Creates a minimal valid PNG file (1x1 red pixel)"""
    # Minimal PNG header + IHDR + IDAT + IEND
    png_data = bytes([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,  # PNG signature
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,  # IHDR chunk header
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,  # 1x1 size
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,  # 8-bit RGB
        0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,  # IDAT chunk
        0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,  # image data
        0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x18, 0xDD,  # CRC
        0x8D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,  # IEND chunk
        0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82               # EOF
    ])
    return png_data

# Helper: Create small JPEG
def create_test_jpeg():
    """Creates a minimal valid JPEG file"""
    # Minimal JPEG (1x1 white pixel)
    jpeg_data = bytes([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46,
        0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
        0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
        0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
        0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0A, 0x0C,
        0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
        0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D,
        0x1A, 0x1C, 0x1C, 0x20, 0x24, 0x2E, 0x27, 0x20,
        0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
        0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27,
        0x39, 0x3D, 0x38, 0x32, 0x3C, 0x2E, 0x33, 0x34,
        0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
        0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4,
        0x00, 0x1F, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
        0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
        0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0xFF,
        0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
        0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04,
        0x00, 0x00, 0x01, 0x7D, 0x01, 0x02, 0x03, 0x00,
        0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
        0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32,
        0x81, 0x91, 0xA1, 0x08, 0x23, 0x42, 0xB1, 0xC1,
        0x15, 0x52, 0xD1, 0xF0, 0x24, 0x33, 0x62, 0x72,
        0x82, 0x09, 0x0A, 0x16, 0x17, 0x18, 0x19, 0x1A,
        0x25, 0x26, 0x27, 0x28, 0x29, 0x2A, 0x34, 0x35,
        0x36, 0x37, 0x38, 0x39, 0x3A, 0x43, 0x44, 0x45,
        0x46, 0x47, 0x48, 0x49, 0x4A, 0x53, 0x54, 0x55,
        0x56, 0x57, 0x58, 0x59, 0x5A, 0x63, 0x64, 0x65,
        0x66, 0x67, 0x68, 0x69, 0x6A, 0x73, 0x74, 0x75,
        0x76, 0x77, 0x78, 0x79, 0x7A, 0x83, 0x84, 0x85,
        0x86, 0x87, 0x88, 0x89, 0x8A, 0x92, 0x93, 0x94,
        0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0xA2, 0xA3,
        0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xB2,
        0xB3, 0xB4, 0xB5, 0xB6, 0xB7, 0xB8, 0xB9, 0xBA,
        0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9,
        0xCA, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8,
        0xD9, 0xDA, 0xE1, 0xE2, 0xE3, 0xE4, 0xE5, 0xE6,
        0xE7, 0xE8, 0xE9, 0xEA, 0xF1, 0xF2, 0xF3, 0xF4,
        0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA, 0xFF, 0xDA,
        0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00,
        0xFB, 0xD5, 0xDB, 0x20, 0xA8, 0xF3, 0x4F, 0xFF,
        0xD9
    ])
    return jpeg_data

class TestFileUpload:
    """Tests for POST /api/upload endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin JWT token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_upload_requires_admin_auth(self):
        """POST /api/upload returns 401 without authentication"""
        png_data = create_test_png()
        files = {'file': ('test.png', io.BytesIO(png_data), 'image/png')}
        response = requests.post(f"{BASE_URL}/api/upload", files=files)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Upload requires authentication")
    
    def test_upload_image_png(self, admin_token):
        """POST /api/upload accepts PNG image with admin auth"""
        png_data = create_test_png()
        files = {'file': ('test_image.png', io.BytesIO(png_data), 'image/png')}
        headers = {'Authorization': f'Bearer {admin_token}'}
        
        response = requests.post(f"{BASE_URL}/api/upload", files=files, headers=headers)
        assert response.status_code == 200, f"Upload failed: {response.text}"
        
        data = response.json()
        assert 'path' in data, "Response missing 'path'"
        assert 'content_type' in data, "Response missing 'content_type'"
        assert 'original_filename' in data, "Response missing 'original_filename'"
        assert data['content_type'] == 'image/png'
        assert data['original_filename'] == 'test_image.png'
        assert data['path'].endswith('.png')
        print(f"✓ PNG upload successful: {data['path']}")
        return data['path']
    
    def test_upload_image_jpeg(self, admin_token):
        """POST /api/upload accepts JPEG image with admin auth"""
        jpeg_data = create_test_jpeg()
        files = {'file': ('test_image.jpg', io.BytesIO(jpeg_data), 'image/jpeg')}
        headers = {'Authorization': f'Bearer {admin_token}'}
        
        response = requests.post(f"{BASE_URL}/api/upload", files=files, headers=headers)
        assert response.status_code == 200, f"Upload failed: {response.text}"
        
        data = response.json()
        assert data['content_type'] == 'image/jpeg'
        assert data['original_filename'] == 'test_image.jpg'
        print(f"✓ JPEG upload successful: {data['path']}")
    
    def test_upload_rejects_txt_file(self, admin_token):
        """POST /api/upload rejects non-image/video files (.txt)"""
        txt_content = b"This is a text file that should be rejected"
        files = {'file': ('test.txt', io.BytesIO(txt_content), 'text/plain')}
        headers = {'Authorization': f'Bearer {admin_token}'}
        
        response = requests.post(f"{BASE_URL}/api/upload", files=files, headers=headers)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        assert 'not allowed' in response.json().get('detail', '').lower()
        print("✓ TXT file rejected correctly")
    
    def test_upload_rejects_pdf_file(self, admin_token):
        """POST /api/upload rejects PDF files"""
        pdf_content = b"%PDF-1.4 fake pdf content"
        files = {'file': ('document.pdf', io.BytesIO(pdf_content), 'application/pdf')}
        headers = {'Authorization': f'Bearer {admin_token}'}
        
        response = requests.post(f"{BASE_URL}/api/upload", files=files, headers=headers)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ PDF file rejected correctly")


class TestFileServing:
    """Tests for GET /api/files/{path} endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin JWT token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def uploaded_file_path(self, admin_token):
        """Upload a file and return its path"""
        png_data = create_test_png()
        files = {'file': ('serve_test.png', io.BytesIO(png_data), 'image/png')}
        headers = {'Authorization': f'Bearer {admin_token}'}
        
        response = requests.post(f"{BASE_URL}/api/upload", files=files, headers=headers)
        assert response.status_code == 200
        return response.json()['path']
    
    def test_serve_uploaded_file(self, uploaded_file_path):
        """GET /api/files/{path} serves uploaded file with correct content type"""
        response = requests.get(f"{BASE_URL}/api/files/{uploaded_file_path}")
        assert response.status_code == 200, f"File serve failed: {response.status_code}"
        assert response.headers.get('Content-Type') == 'image/png', f"Wrong content-type: {response.headers.get('Content-Type')}"
        assert len(response.content) > 0, "Empty file content"
        print(f"✓ File served correctly: {uploaded_file_path}")
    
    def test_serve_nonexistent_file(self):
        """GET /api/files/{path} returns 404 for nonexistent file"""
        response = requests.get(f"{BASE_URL}/api/files/nonexistent/file.png")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ 404 returned for nonexistent file")


class TestProductMediaPaths:
    """Tests for Product model media_paths field and admin endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin JWT token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_products_have_media_paths_field(self):
        """GET /api/products returns products with media_paths array field"""
        response = requests.get(f"{BASE_URL}/api/products")
        assert response.status_code == 200
        products = response.json()
        assert len(products) > 0, "No products returned"
        
        for product in products:
            assert 'media_paths' in product, f"Product {product.get('name', 'unknown')} missing media_paths"
            assert isinstance(product['media_paths'], list), f"media_paths is not a list"
            # Check backward compatibility - image_url should still exist
            assert 'image_url' in product, f"Product missing image_url for backward compatibility"
        
        print(f"✓ All {len(products)} products have media_paths array")
    
    def test_create_product_with_media_paths(self, admin_token):
        """POST /api/admin/products creates product with media_paths"""
        # First upload a test file
        png_data = create_test_png()
        files = {'file': ('product_media.png', io.BytesIO(png_data), 'image/png')}
        headers = {'Authorization': f'Bearer {admin_token}'}
        
        upload_response = requests.post(f"{BASE_URL}/api/upload", files=files, headers=headers)
        assert upload_response.status_code == 200
        uploaded_path = upload_response.json()['path']
        
        # Create product with media_paths
        product_data = {
            "name": "TEST_MediaPaths_Product",
            "size": "8mm+",
            "description": "Test product for media_paths feature",
            "features": ["Test feature 1", "Test feature 2"],
            "image_url": f"{BASE_URL}/api/files/{uploaded_path}",
            "media_paths": [uploaded_path]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/products",
            json=product_data,
            headers=headers
        )
        assert response.status_code == 200, f"Create product failed: {response.text}"
        
        created_product = response.json()
        assert created_product['name'] == "TEST_MediaPaths_Product"
        assert created_product['media_paths'] == [uploaded_path]
        assert uploaded_path in created_product['image_url']
        
        # Cleanup - delete the test product
        delete_response = requests.delete(
            f"{BASE_URL}/api/admin/products/{created_product['id']}",
            headers=headers
        )
        assert delete_response.status_code == 200
        
        print(f"✓ Product created with media_paths: {created_product['media_paths']}")
    
    def test_update_product_media_paths(self, admin_token):
        """PUT /api/admin/products/{id} updates product media_paths"""
        headers = {'Authorization': f'Bearer {admin_token}'}
        
        # Upload two test files
        png_data = create_test_png()
        upload1 = requests.post(
            f"{BASE_URL}/api/upload",
            files={'file': ('update_test1.png', io.BytesIO(png_data), 'image/png')},
            headers=headers
        )
        upload2 = requests.post(
            f"{BASE_URL}/api/upload",
            files={'file': ('update_test2.png', io.BytesIO(png_data), 'image/png')},
            headers=headers
        )
        path1 = upload1.json()['path']
        path2 = upload2.json()['path']
        
        # Create product
        create_response = requests.post(
            f"{BASE_URL}/api/admin/products",
            json={
                "name": "TEST_UpdateMedia_Product",
                "size": "7mm",
                "description": "Test update",
                "features": ["Feature"],
                "image_url": f"{BASE_URL}/api/files/{path1}",
                "media_paths": [path1]
            },
            headers=headers
        )
        product_id = create_response.json()['id']
        
        # Update with new media
        update_response = requests.put(
            f"{BASE_URL}/api/admin/products/{product_id}",
            json={
                "name": "TEST_UpdateMedia_Product",
                "size": "7mm",
                "description": "Updated description",
                "features": ["Feature"],
                "image_url": f"{BASE_URL}/api/files/{path1}",
                "media_paths": [path1, path2]
            },
            headers=headers
        )
        assert update_response.status_code == 200
        updated_product = update_response.json()
        assert len(updated_product['media_paths']) == 2
        assert path1 in updated_product['media_paths']
        assert path2 in updated_product['media_paths']
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/products/{product_id}", headers=headers)
        
        print(f"✓ Product updated with multiple media_paths: {updated_product['media_paths']}")


class TestCustomerUploadRestriction:
    """Test that non-admin users cannot upload files"""
    
    def test_customer_cannot_upload(self):
        """Non-admin user cannot upload files (403 Forbidden)"""
        # First register a test customer
        import uuid
        test_email = f"TEST_upload_customer_{uuid.uuid4().hex[:8]}@example.com"
        
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": "test123",
            "full_name": "Test Customer Upload"
        })
        
        if reg_response.status_code == 200:
            # Login as customer
            login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": test_email,
                "password": "test123"
            })
            
            if login_response.status_code == 200:
                customer_token = login_response.json()['access_token']
                
                # Try to upload
                png_data = create_test_png()
                files = {'file': ('customer_upload.png', io.BytesIO(png_data), 'image/png')}
                headers = {'Authorization': f'Bearer {customer_token}'}
                
                upload_response = requests.post(f"{BASE_URL}/api/upload", files=files, headers=headers)
                assert upload_response.status_code == 403, f"Expected 403 for customer upload, got {upload_response.status_code}"
                print("✓ Customer correctly forbidden from uploading files")
            else:
                pytest.skip("Customer login failed")
        else:
            pytest.skip("Customer registration failed")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
