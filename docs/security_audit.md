# Security Audit Report

## Overview
Analysis of the security posture of the backend and frontend.

### Strengths
- **Authentication**: JWT token issuance and validation middleware is implemented and working.
- **Password Security**: Passwords are hashed before storage.
- **Validation**: `express-validator` is used extensively in auth routes.

### Weaknesses & Missing Integrations
- **Redis Rate Limiting**: Disabled/commented out in `server.js` to prevent crashes. The app is currently vulnerable to brute-force and DDoS.
- **CSRF Protection**: `csrfMiddleware.js` exists but is heavily commented out or bypassed to aid in development.
- **XSS & Sanitizer**: `sanitizerMiddleware.js` is present but partially disabled or not universally applied.
- **RBAC**: Role-Based Access Control logic needs to be strictly enforced on routes like `POST /events` (should only allow `ORGANIZER` or `ADMIN`).

## Summary
Security Score: **40%**. Basic JWT auth works, but enterprise-grade protections (Rate limiting, CSRF, strict RBAC) are deactivated or incomplete.
