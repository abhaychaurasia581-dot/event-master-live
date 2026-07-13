# Database Audit Report

## Overview
Verification of `schema.sql` against backend Models and requirements.

### Schema Validation
- **users table**: Valid. Uses `CHAR(36)` for UUIDs. Contains role enums (`ADMIN`, `ORGANIZER`, `USER`).
- **events table**: Valid. Has strict `NOT NULL` constraints on `organizer_id` and `category_id`.
- **categories table**: Exists.
- **bookings table**: Exists.

### Identified Issues
1. **Model Synchronization**: Models in `/server/models/` mostly exist (`userModel.js`, `eventModel.js`, `bookingModel.js`), but they are not fully wired to controllers. `eventModel.js` exists but lacks `eventController.js` to utilize it.
2. **Missing Initial Seed Data**: The `events` table requires `category_id` and `organizer_id`. Without an initial SQL seed file for Categories, event creation will fail due to Foreign Key constraint violations.
3. **Foreign Key Integrity**: The schema uses strict `ON DELETE CASCADE`. This is good for data integrity, but requires careful handling during entity deletion to prevent accidental massive cascading drops.

## Summary
The raw database schema is well-designed for a MySQL-based application. However, the application layer fails to utilize it for 80% of the platform's features.
