# Test Credentials for Cardamom Spices Centre B2B Marketplace

## Admin
- Email: admin@cardamomspicescentre.com
- Password: admin123
- Role: admin
- Status: approved

## Test Users (created by testing agent during iteration 6)
- TEST_seller_* / test123 (seller role, approved by admin during tests)
- TEST_buyer_* / test123 (buyer role, approved by admin during tests)
- TEST_both_* / test123 (both role, approved by admin during tests)

## Registration Flow
- New users register with role: buyer/seller/both
- Default status: pending (requires admin approval)
- Admin approves via PATCH /api/admin/users/{id}/status?status=approved
- Sellers must be approved before uploading products
- Products must be approved by admin before visible to buyers
