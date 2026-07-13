# API Contract Audit

## Overview
This document inventories the backend endpoints and verifies their contracts against the frontend implementation.

### 1. Authentication (`/api/v1/auth`)
- **POST `/register`**: Implemented. Validation rules present. Frontend handles 422 correctly.
- **POST `/login`**: Implemented. Returns JWT.
- **GET `/me`**: Implemented. Returns user profile.
- **POST `/logout`**: Implemented.

### 2. Events (`/api/v1/events`)
- **GET `/`**: **BROKEN/MOCKED**. Currently returns `[]`. `eventController.js` is completely missing.
- **GET `/:id`**: **MISSING**. Frontend expects this for Event Details, but the route doesn't exist.
- **POST `/`**: **MISSING**. Frontend `CreateEvent.jsx` has a mock `setTimeout` instead of calling this.
- **PUT `/:id`**, **DELETE `/:id`**: **MISSING**.

### 3. Bookings & Payments (`/api/v1/bookings`, `/api/v2/payments`)
- **POST `/api/v1/bookings`**: **MISSING**. Frontend `Checkout.jsx` uses mock timeouts.
- **GET `/api/v1/bookings/my-tickets`**: **MISSING**. Dashboard uses hardcoded tickets.

### 4. Dashboards (`/api/v1/dashboards`)
- **GET `/admin`**: **MISSING**. `AdminDashboard.jsx` uses hardcoded `$45,231` revenue.

## Summary
- Total APIs Expected: ~20
- Working APIs: 3 (Auth module)
- Broken/Mocked APIs: 1 (`GET /events`)
- Missing APIs: 16+ (Events CRUD, Bookings, Analytics, Wishlist)
- Mismatches: High. Frontend heavily relies on local state and timeouts because the backend contracts are unfulfilled.
