# Cardamom Spices Centre - B2B Marketplace Platform

## Problem Statement
Build a full-featured B2B e-commerce marketplace for cardamom trading with a **3-role system**: Admin, Seller, Buyer (and "Both" for combined Buyer+Seller).

## User Personas
- **Admin**: Full control — approves/rejects users and products, manages all bids/quotes, creates products (auto-approved)
- **Seller**: Uploads products (pending admin approval), manages bids received on their products (accept/reject)
- **Buyer**: Browses approved products, places bids (kg/lots, price, currency, market type), requests quotes
- **Both**: A trader acting as both Buyer and Seller using the same account

## Core Requirements
1. **Auth System**: JWT-based with 4 roles (admin/seller/buyer/both), admin approval for new users
2. **Product Catalog**: Cardamom varieties, seller-uploaded with admin approval workflow
3. **Bidding System**: Buyers bid → Sellers review → Admin has full oversight
4. **Media Upload**: Up to 4 images/videos per product via object storage
5. **PWA**: Installable app with push notifications for bid status updates
6. **Admin Dashboard**: User management, product approvals, bid management
7. **Seller Dashboard**: My products, bids received, product upload
8. **Buyer Dashboard**: My bids

## Tech Stack
- **Frontend**: React, Tailwind CSS, Shadcn UI, Framer Motion
- **Backend**: FastAPI, Motor (async MongoDB driver)
- **Database**: MongoDB
- **Auth**: JWT (python-jose), bcrypt (passlib)
- **Storage**: Emergent Integrations Object Storage
- **Notifications**: Web Push via VAPID (pywebpush)

## Architecture
```
/app/
├── backend/
│   ├── server.py          # All backend logic (~1225 lines)
│   ├── tests/             # Pytest test files
│   └── .env               # Backend env vars
├── frontend/
│   └── src/
│       ├── components/    # Navbar, Footer, LoginModal, ProtectedRoute, ScrollToTop, ui/
│       ├── context/       # AuthContext.js (isSeller, isBuyer, isAdmin helpers)
│       ├── pages/         # Home, Products, ProductDetail, Contact, Login, Register,
│       │                  # AdminDashboard, BuyerDashboard, SellerDashboard, PendingApproval
│       └── utils/         # pushNotifications.js
└── memory/
    ├── PRD.md
    └── test_credentials.md
```

## Admin Credentials (Dev)
- Email: admin@cardamomspicescentre.com
- Password: admin123

## What's Been Implemented (as of Apr 18, 2026)

### Phase 1 - Foundation (Completed)
- [x] Static homepage with hero, features, about, product preview, CTA sections
- [x] Products page with cardamom varieties
- [x] Contact page with inquiry form
- [x] Backend JWT auth system (register, login, me endpoints)
- [x] Login Modal popup
- [x] Frontend Register page
- [x] AuthContext with login/register/logout/token persistence
- [x] Product media upload: Min 1, Max 4 files via Emergent object storage
- [x] Product detail pages with media gallery
- [x] ScrollToTop component
- [x] PWA: manifest, service worker, offline fallback, custom icons
- [x] Push Notifications: VAPID-based push for bid/quote events

### Phase 2 - 3-Role Marketplace Migration (Completed Apr 18, 2026)
- [x] **User Model**: Roles: admin/seller/buyer/both, Status: pending/approved/rejected
- [x] **Registration**: Role selector (Buy/Sell/Both) on register page
- [x] **Product Model**: seller_id, seller_name, approval_status (pending/approved/rejected)
- [x] **Bid Model**: buyer_id/buyer_name + seller_id/seller_name linking, reviewed_by, seller_notes
- [x] **Seller Endpoints**: POST/GET/PUT/DELETE /api/seller/products, GET/PUT /api/seller/bids
- [x] **Admin Endpoints**: GET/POST/PUT/DELETE /api/admin/products, PATCH approval status
- [x] **Product Approval Workflow**: Seller creates (pending) → Admin approves → Public listing
- [x] **Bid Flow**: Buyer places bid → Seller reviews → Admin can override
- [x] **Seller Dashboard** (/seller): My Products (with status), Bids Received, product upload
- [x] **Buyer Dashboard** (/dashboard): My Bids
- [x] **Admin Dashboard**: Users (with role badges), Pending Products (approve/reject), Bids, All Products
- [x] **Quotation feature removed** (Apr 20, 2026) — quote models, endpoints, and all frontend UI fully stripped
- [x] **Product search & grade filtering** (Apr 20, 2026) — search by name/description/size/seller + grade filter pills on Products page
- [x] **"Both" role UX** (Apr 20, 2026) — role-switch banner on Seller/Buyer dashboards for seamless switching
- [x] **Role-based Routing**: Navbar, LoginModal, Login page route to correct dashboard
- [x] **ProtectedRoute**: Updated for seller/buyer/both/admin role checking
- [x] **Data Migration**: Auto-migrate old "customer" users → "buyer", old bids customer_* → buyer_*
- [x] **Startup Seed Fix**: Products only seeded when collection is empty (no more data wipe)
- [x] File upload allowed for sellers (not just admins)

## Prioritized Backlog

### P1
- [ ] Product filtering/search by grade on Products page
- [ ] "Both" role users: dual dashboard view (switch between buyer/seller views)

### P2
- [ ] Razorpay payment integration for accepted bids
- [ ] Offline payment options (Wire Transfer, L/C)
- [ ] Contact form email (SMTP) - needs user credentials

### P3
- [ ] Invoice generation system
- [ ] Order & shipping management
- [ ] Shipping cost calculator

## Testing
- Backend: 22/22 API tests passed (iteration 6) - full 3-role system
- Frontend: All targeted flows verified (iteration 6 + iteration 7)
- Iteration 7: 19/19 tests passed — product search/filter + both-role switching
- Test reports: /app/test_reports/iteration_7.json
