# Cardamom Spices Centre - B2B E-Commerce Platform

## Problem Statement
Build a full-featured B2B e-commerce platform for a cardamom export business (similar to bodiemart.com). Single seller model with admin and customer roles.

## User Personas
- **Admin**: Manages inventory, updates daily rates, approves B2B buyer accounts, generates invoices, manages quotes
- **Customer (B2B Buyer)**: Views daily rates, filters products by grade, requests bulk quotes, views order history

## Core Requirements
1. **Auth System**: JWT-based with admin/customer roles, admin approval for new customers
2. **Product Catalog**: Cardamom varieties by grade (6-7mm, 7-8mm, 8mm+)
3. **Quote System**: Request a Quote for bulk orders, admin responds with pricing
4. **Admin Dashboard**: User management, quote management, product management
5. **Customer Dashboard**: View quotes, request new quotes, order history
6. **Payment**: Razorpay (domestic + intl), Wire Transfer, L/C offline options
7. **Contact Form**: Email notifications on inquiry submission
8. **Invoice Generation**: Commercial invoices for export orders

## Tech Stack
- **Frontend**: React, Tailwind CSS, Shadcn UI, Framer Motion
- **Backend**: FastAPI, Motor (async MongoDB driver)
- **Database**: MongoDB
- **Auth**: JWT (python-jose), bcrypt (passlib)

## Architecture
```
/app/
├── backend/
│   ├── server.py          # All backend logic
│   ├── tests/             # Pytest test files
│   └── .env               # Backend env vars
├── frontend/
│   └── src/
│       ├── components/    # Navbar, Footer, ProtectedRoute, ui/
│       ├── context/       # AuthContext.js
│       └── pages/         # Home, Products, Contact, Login, Register, AdminDashboard, CustomerDashboard, PendingApproval
└── memory/
    └── PRD.md
```

## Admin Credentials (Dev)
- Email: admin@cardamomspicescentre.com
- Password: admin123

## What's Been Implemented (as of Mar 20, 2026)
- [x] Static homepage with hero, features, about, product preview, CTA sections
- [x] Products page with 3 cardamom varieties
- [x] Contact page with inquiry form
- [x] Backend JWT auth system (register, login, me endpoints)
- [x] Admin endpoints (user management, quote management)
- [x] Customer quote endpoints (request quote, view my quotes)
- [x] **Login Modal popup** — opens over current page with dark backdrop (not a separate page)
- [x] Frontend Login page (fallback /login route also uses modal)
- [x] Frontend Register page with all fields (separate page)
- [x] AuthContext with login/register/logout/token persistence
- [x] AdminDashboard with user management + quote tabs
- [x] CustomerDashboard with quotes list
- [x] PendingApproval page
- [x] ProtectedRoute component for /admin and /dashboard
- [x] Navbar with auth buttons (desktop + mobile) — login triggers modal
- [x] Fixed .env formatting bug (CORS_ORIGINS and JWT_SECRET_KEY merged)
- [x] Fixed product.grade → product.size bug in Home.js
- [x] Cleaned up obsolete static-site directory

## Prioritized Backlog

### P0 (Next Sprint)
- [x] Admin: Product management (add/edit/delete products from dashboard)
- [x] Admin: Quote response form with pricing fields
- [x] Customer: "Request a Quote" form on Products page

### P1
- [ ] Product filtering/search by grade on Products page
- [ ] Customer order history view
- [ ] Admin dashboard: daily rate management

### P2
- [ ] Razorpay payment integration
- [ ] Offline payment options (Wire Transfer, L/C)
- [ ] Contact form email (SMTP) - needs user credentials

### P3
- [ ] Invoice generation system
- [ ] Order & shipping management
- [ ] Shipping cost calculator

## Testing
- Backend: 21/21 API tests passed (iteration 2)
- Frontend: 16/16 features verified (iteration 2)
- Test reports: /app/test_reports/iteration_1.json, /app/test_reports/iteration_2.json
