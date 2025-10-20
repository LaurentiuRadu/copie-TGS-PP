# TGS PP Authentication System Documentation

## Overview

This directory contains comprehensive documentation for the TGS PP (Time Tracking System) authentication and user management system. The system is built on Supabase with custom role-based access control (RBAC) for admin and employee users.

## Documentation Files

### 📋 Quick Reference
- **[QUICK_START_CREATE_USER.md](QUICK_START_CREATE_USER.md)** - Fast track guide to create your first test user
  - Step-by-step dashboard instructions
  - Edge function API examples
  - Troubleshooting common issues

### 📊 Executive Summary
- **[AUTHENTICATION_SUMMARY.md](AUTHENTICATION_SUMMARY.md)** - High-level overview of the entire system
  - Architecture diagrams
  - User types and permissions
  - Authentication flows
  - Security features
  - Quick operations reference

### 🔬 Technical Deep Dive
- **[DATABASE_ANALYSIS.md](DATABASE_ANALYSIS.md)** - Comprehensive schema and security analysis
  - Database schema documentation
  - Table structures and relationships
  - Row Level Security (RLS) policies
  - Edge function analysis
  - Security recommendations
  - Current system state

### 🛠️ Testing & Diagnostics
- **[TEST_SCRIPTS.sql](TEST_SCRIPTS.sql)** - SQL queries for testing and debugging
  - User statistics queries
  - Session management queries
  - RLS policy verification
  - Data validation checks
  - Performance analysis
  - Cleanup scripts

### 👥 User Management Guide
- **[USER_CREATION_GUIDE.md](USER_CREATION_GUIDE.md)** - Complete user creation and login guide
  - Three methods for creating users
  - Login verification procedures
  - Troubleshooting guide
  - Best practices
  - Security notes

## Quick Links

| Task | Document | Section |
|------|----------|---------|
| Create first test user | [QUICK_START_CREATE_USER.md](QUICK_START_CREATE_USER.md) | Option 1 |
| Understand system architecture | [AUTHENTICATION_SUMMARY.md](AUTHENTICATION_SUMMARY.md) | Architecture Diagram |
| Review database schema | [DATABASE_ANALYSIS.md](DATABASE_ANALYSIS.md) | Section 1 |
| Test user login | [USER_CREATION_GUIDE.md](USER_CREATION_GUIDE.md) | Login Verification Tests |
| Debug user issues | [TEST_SCRIPTS.sql](TEST_SCRIPTS.sql) | Section 1 & 4 |
| Check security policies | [DATABASE_ANALYSIS.md](DATABASE_ANALYSIS.md) | Section 2 |
| Create via API | [USER_CREATION_GUIDE.md](USER_CREATION_GUIDE.md) | Method 1 |

## System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     Frontend Layer                        │
│  ┌─────────────────┐        ┌──────────────────┐        │
│  │  Employee Login │        │   Admin Login    │        │
│  │  (Username)     │        │   (Email)        │        │
│  └────────┬────────┘        └────────┬─────────┘        │
│           │                          │                   │
│           └──────────┬───────────────┘                   │
│                      │                                   │
│           ┌──────────▼──────────┐                        │
│           │   AuthContext       │                        │
│           │  (Session Mgmt)     │                        │
│           └──────────┬──────────┘                        │
└──────────────────────┼───────────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────────┐
│                  Supabase Backend                         │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Edge Functions                                    │  │
│  │  • create-user (Admin-only)                        │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Database (PostgreSQL + RLS)                       │  │
│  │  • auth.users (Supabase managed)                   │  │
│  │  • user_roles (Custom RBAC)                        │  │
│  │  • profiles (User metadata)                        │  │
│  │  • admin_sessions / employee_sessions              │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

## Key Concepts

### User Types
- **Admin:** Full system access, manages users and system configuration
- **Employee:** Limited access, can track time and view own data

### Email Patterns
- **Admins:** Real email (e.g., `admin@tgservices.ro`)
- **Employees:** Generated from username (e.g., `johnsmith@company.local`)
- **Legacy Employees:** Old domain `@employee.local` with auto-migration support

### Authentication Methods
- **Username-based:** Employees login with username (converted to email internally)
- **Email-based:** Admins login with full email address
- **JWT Tokens:** Session management via Supabase JWT tokens
- **Device Tracking:** Fingerprinting for security and multi-device support

### Security Layers
1. **Supabase Auth:** Email/password authentication
2. **Row Level Security (RLS):** Database-level access control
3. **Role-Based Access Control (RBAC):** Custom roles table
4. **Session Management:** Time-limited sessions with device tracking
5. **Edge Function Auth:** Admin verification for user creation

## Common Tasks

### Create a New Employee
```bash
# Method 1: Supabase Dashboard
1. Go to Authentication → Users
2. Add User with email: username@company.local
3. Set metadata: {"username":"...", "full_name":"..."}
4. Insert role: INSERT INTO user_roles (user_id, role) VALUES (..., 'employee');

# Method 2: Edge Function API
curl -X POST "$SUPABASE_URL/functions/v1/create-user" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -d '{"username":"...","firstName":"...","lastName":"...","password":"...","role":"employee"}'
```

### Verify User Setup
```sql
SELECT
    au.email,
    p.username,
    p.full_name,
    ur.role,
    au.email_confirmed_at IS NOT NULL as confirmed
FROM auth.users au
JOIN profiles p ON au.id = p.id
JOIN user_roles ur ON au.id = ur.user_id
WHERE au.email = 'username@company.local';
```

### Check Active Sessions
```sql
-- All active sessions
SELECT
    'admin' as type, COUNT(*) as count
FROM admin_sessions
WHERE invalidated_at IS NULL AND expires_at > now()
UNION ALL
SELECT
    'employee' as type, COUNT(*) as count
FROM employee_sessions
WHERE invalidated_at IS NULL AND expires_at > now();
```

### Debug Login Issues
```sql
-- Check if user exists and is properly configured
SELECT
    au.email,
    au.email_confirmed_at,
    ur.role,
    p.id IS NOT NULL as has_profile
FROM auth.users au
LEFT JOIN user_roles ur ON au.id = ur.user_id
LEFT JOIN profiles p ON au.id = p.id
WHERE au.email = 'problem-user@company.local';

-- Common fixes:
-- 1. Confirm email: UPDATE auth.users SET email_confirmed_at = now() WHERE email = '...';
-- 2. Add role: INSERT INTO user_roles (user_id, role) VALUES ('...', 'employee');
-- 3. Create profile: INSERT INTO profiles (id, username, full_name) VALUES (...);
```

## Database Schema Summary

### Core Tables
| Table | Purpose | Key Fields |
|-------|---------|------------|
| `auth.users` | User accounts | email, encrypted_password, raw_user_meta_data |
| `user_roles` | Role assignments | user_id, role (admin/employee) |
| `profiles` | User profiles | id, username, full_name |
| `admin_sessions` | Admin sessions | session_id, device_fingerprint, expires_at |
| `employee_sessions` | Employee sessions | session_id, device_fingerprint, expires_at |

### Security Functions
| Function | Purpose |
|----------|---------|
| `has_role(user_id, role)` | Check if user has specific role (used in RLS) |
| `get_active_sessions_count(user_id, role)` | Count active sessions for user |
| `invalidate_sessions_by_role(...)` | Invalidate user sessions |
| `cleanup_expired_sessions_by_role()` | Remove old expired sessions |

### Triggers
| Trigger | Purpose |
|---------|---------|
| `on_auth_user_created` | Auto-creates profile when user is created |
| `update_profiles_updated_at` | Updates timestamp on profile changes |

## Security Best Practices

### ✅ Implemented
- Row Level Security on all custom tables
- Admin-only user creation via edge function
- JWT token authentication
- Device fingerprinting
- Session expiration (24 hours)
- Password minimum length (6 characters)
- Profile auto-creation via trigger
- Cascade deletion (user → roles, profiles, sessions)

### ⚠️ Recommended Improvements
- Remove testing RLS policy before production
- Implement rate limiting on login endpoints
- Add password complexity requirements
- Implement audit logging for admin actions
- Add multi-factor authentication (2FA)
- Email verification for admin accounts
- Session timeout configuration per role
- Failed login attempt tracking

## Current System State

**Live Statistics:**
```sql
-- Run this query to get current stats
SELECT
    'Total Users' as metric,
    COUNT(*) as value
FROM auth.users
UNION ALL
SELECT
    'Admin Users',
    COUNT(CASE WHEN role = 'admin' THEN 1 END)
FROM user_roles
UNION ALL
SELECT
    'Employee Users',
    COUNT(CASE WHEN role = 'employee' THEN 1 END)
FROM user_roles;
```

**As of last update:**
- Total Users: 1
- Admin Users: 1
- Employee Users: 0

## Troubleshooting Guide

### Issue: User can't login
**Check:**
1. Email confirmed? → `SELECT email_confirmed_at FROM auth.users WHERE email = '...'`
2. Role assigned? → `SELECT role FROM user_roles WHERE user_id = '...'`
3. Profile exists? → `SELECT * FROM profiles WHERE id = '...'`
4. Correct password? → Verify via Supabase Dashboard

### Issue: Profile not auto-created
**Fix:**
```sql
INSERT INTO profiles (id, username, full_name)
SELECT
    id,
    raw_user_meta_data->>'username',
    raw_user_meta_data->>'full_name'
FROM auth.users
WHERE id = 'USER_UUID'
ON CONFLICT (id) DO NOTHING;
```

### Issue: Edge function returns 403
**Cause:** Not authenticated as admin
**Fix:** Get fresh JWT token from admin session

### Issue: Session not created
**Check:** RLS policies allow session insertion
```sql
-- Test session creation
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims.sub TO 'USER_UUID';
INSERT INTO employee_sessions (user_id, session_id, device_fingerprint)
VALUES ('USER_UUID', 'test-session', 'test-device');
RESET ROLE;
```

## File Organization

```
project/
├── supabase/
│   ├── functions/
│   │   └── create-user/
│   │       └── index.ts          # Edge function for user creation
│   └── migrations/
│       ├── 20250930201526_*.sql  # Core schema (users, roles, profiles)
│       ├── 20251001130623_*.sql  # Time entries and work locations
│       └── 20251020100806_*.sql  # Session management (admin/employee split)
├── src/
│   ├── pages/
│   │   ├── Auth.tsx              # Employee login page
│   │   └── AdminAuth.tsx         # Admin login page
│   ├── contexts/
│   │   └── AuthContext.tsx       # Session management and auth state
│   └── integrations/
│       └── supabase/
│           └── client.ts         # Supabase client configuration
└── docs/ (this directory)
    ├── AUTHENTICATION_README.md           # This file (index)
    ├── QUICK_START_CREATE_USER.md         # Quick start guide
    ├── AUTHENTICATION_SUMMARY.md          # Executive summary
    ├── DATABASE_ANALYSIS.md               # Technical deep dive
    ├── TEST_SCRIPTS.sql                   # SQL test queries
    └── USER_CREATION_GUIDE.md             # Complete user guide
```

## Getting Started

**New to the system?** Start here:

1. Read [AUTHENTICATION_SUMMARY.md](AUTHENTICATION_SUMMARY.md) for system overview
2. Follow [QUICK_START_CREATE_USER.md](QUICK_START_CREATE_USER.md) to create a test user
3. Test login at `/auth` (employee) or `/admin-login` (admin)
4. Review [DATABASE_ANALYSIS.md](DATABASE_ANALYSIS.md) for technical details
5. Use [TEST_SCRIPTS.sql](TEST_SCRIPTS.sql) for diagnostics

**Need to create users?**
1. [QUICK_START_CREATE_USER.md](QUICK_START_CREATE_USER.md) - Fastest method
2. [USER_CREATION_GUIDE.md](USER_CREATION_GUIDE.md) - Complete guide

**Troubleshooting issues?**
1. [USER_CREATION_GUIDE.md](USER_CREATION_GUIDE.md) - Troubleshooting section
2. [TEST_SCRIPTS.sql](TEST_SCRIPTS.sql) - Diagnostic queries
3. Check Supabase Dashboard logs

## Support

For additional help:
- Check error messages in browser console (F12)
- Review Supabase Dashboard → Logs
- Run diagnostic queries from TEST_SCRIPTS.sql
- Verify environment variables in `.env`
- Check network requests in DevTools

## Version Information

- **Supabase Client:** v2.58.0
- **Database:** PostgreSQL (Supabase managed)
- **Authentication:** Supabase Auth
- **Framework:** React 18.3.1 + TypeScript 5.8.3
- **Last Updated:** 2025-10-20

## Contributing

When making changes to authentication:
1. Document in appropriate guide
2. Update schema in DATABASE_ANALYSIS.md
3. Add test queries to TEST_SCRIPTS.sql
4. Update this README with new sections
5. Test thoroughly in development before production

## License

Internal documentation for TGS PP Time Tracking System.
