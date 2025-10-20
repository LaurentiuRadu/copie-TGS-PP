# User Creation and Login Verification Guide

## Quick Reference

**Current System Status:**
- ✅ Database Schema: Properly configured
- ✅ RLS Enabled: user_roles, profiles
- ✅ Profile Sync: 100% (1/1 users have profiles)
- ✅ Role Assignment: 100% (1/1 users have roles)
- ✅ Existing Admin: laurentiu.radu@tgservices.ro

## Method 1: Create User via Edge Function (Recommended)

### Prerequisites
- Admin JWT token
- Supabase project URL and anon key
- curl or API testing tool (Postman, Insomnia)

### Step 1: Get Admin JWT Token

Login as admin and copy the JWT token from the browser:

**Option A: Browser DevTools**
```javascript
// In browser console after logging in as admin:
const session = await supabase.auth.getSession();
console.log('JWT Token:', session.data.session.access_token);
```

**Option B: Login via API**
```bash
curl -X POST 'https://YOUR_PROJECT_ID.supabase.co/auth/v1/token?grant_type=password' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "laurentiu.radu@tgservices.ro",
    "password": "YOUR_PASSWORD"
  }'
```

### Step 2: Create Employee User

```bash
curl -X POST 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/create-user' \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johnsmith",
    "firstName": "John",
    "lastName": "Smith",
    "password": "secure123",
    "role": "employee"
  }'
```

**Expected Response (Success):**
```json
{
  "success": true,
  "message": "User created successfully",
  "user": {
    "id": "uuid-here",
    "username": "johnsmith",
    "fullName": "John Smith",
    "email": "johnsmith@company.local"
  }
}
```

**Possible Errors:**

```json
// 401 - Missing Authorization
{"error": "Missing authorization header"}

// 403 - Not Admin
{"error": "Admin access required"}

// 400 - Validation Error
{"error": "Password must be at least 6 characters"}
{"error": "Missing required fields"}

// 400 - Duplicate User
{"error": "User already exists"}
```

### Step 3: Create Admin User

```bash
curl -X POST 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/create-user' \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin2",
    "firstName": "Admin",
    "lastName": "Two",
    "password": "admin_secure_password",
    "role": "admin"
  }'
```

This creates: `admin2@company.local` with admin privileges

## Method 2: Create User via Supabase Dashboard

### Step 1: Navigate to Authentication
1. Open Supabase Dashboard
2. Go to Authentication → Users
3. Click "Add User" → "Create new user"

### Step 2: Fill User Details

**For Employee:**
- Email: `username@company.local` (e.g., `johnsmith@company.local`)
- Password: Minimum 6 characters
- Auto Confirm: ✅ Yes (check this box)
- User Metadata (JSON):
  ```json
  {
    "username": "johnsmith",
    "full_name": "John Smith"
  }
  ```

**For Admin:**
- Email: Real email address (e.g., `admin@tgservices.ro`)
- Password: Strong password
- Auto Confirm: ✅ Yes
- User Metadata (JSON):
  ```json
  {
    "username": "admin",
    "full_name": "Admin Name"
  }
  ```

### Step 3: Assign Role (SQL Editor)

After creating the user, run this SQL in Supabase SQL Editor:

```sql
-- Get the user ID first
SELECT id, email FROM auth.users WHERE email = 'johnsmith@company.local';

-- Then insert the role (replace with actual UUID)
INSERT INTO user_roles (user_id, role)
VALUES ('USER_UUID_HERE', 'employee');

-- For admin:
INSERT INTO user_roles (user_id, role)
VALUES ('ADMIN_UUID_HERE', 'admin');
```

### Step 4: Verify Profile Creation

```sql
-- Check if profile was auto-created
SELECT
    au.email,
    p.username,
    p.full_name,
    ur.role
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
LEFT JOIN user_roles ur ON au.id = ur.user_id
WHERE au.email = 'johnsmith@company.local';
```

Expected: Profile should exist with matching username and full_name

## Method 3: Bulk User Creation Script

For creating multiple users, use this SQL script:

```sql
-- ⚠️ Run this via edge function in production
-- This is for development/testing only

DO $$
DECLARE
    new_users TEXT[][] := ARRAY[
        ['johnsmith', 'John', 'Smith', 'employee'],
        ['janedoe', 'Jane', 'Doe', 'employee'],
        ['bobmanager', 'Bob', 'Manager', 'admin']
    ];
    user_data TEXT[];
    new_email TEXT;
    new_username TEXT;
    new_firstname TEXT;
    new_lastname TEXT;
    new_fullname TEXT;
    new_role app_role;
BEGIN
    FOREACH user_data SLICE 1 IN ARRAY new_users LOOP
        new_username := user_data[1];
        new_firstname := user_data[2];
        new_lastname := user_data[3];
        new_role := user_data[4]::app_role;

        new_email := new_username || '@company.local';
        new_fullname := new_firstname || ' ' || new_lastname;

        RAISE NOTICE 'Creating user: % (%) - Role: %', new_fullname, new_email, new_role;

        -- In production, call the create-user edge function instead
        RAISE NOTICE 'Use edge function: POST /functions/v1/create-user';
        RAISE NOTICE 'Body: {"username":"%","firstName":"%","lastName":"%","password":"SECURE_PASSWORD","role":"%"}',
            new_username, new_firstname, new_lastname, new_role;
    END LOOP;
END $$;
```

## Login Verification Tests

### Test 1: Employee Login (Username)

**Frontend Login Form:**
- Username: `johnsmith` (lowercase, no domain)
- Password: `secure123`
- Expected: Redirect to `/mobile`

**Behind the Scenes:**
1. System converts username to `johnsmith@company.local`
2. Attempts login with this email
3. If fails, tries fallback `johnsmith@employee.local`
4. If fallback succeeds, migrates to new domain
5. Creates session in `employee_sessions` table
6. Checks GDPR consent (shows dialog if missing)

### Test 2: Admin Login (Email)

**Frontend Login Form:**
- Email: `laurentiu.radu@tgservices.ro`
- Password: Admin password
- Expected: Redirect to `/admin`

**Behind the Scenes:**
1. Direct authentication with email
2. Fetches role from `user_roles`
3. Creates session in `admin_sessions` table
4. No GDPR consent check for admins

### Test 3: Invalid Credentials

**Test Cases:**
```javascript
// Wrong password
{ username: "johnsmith", password: "wrong" }
// Expected: "Username sau parolă incorectă"

// Non-existent user
{ username: "nonexistent", password: "anything" }
// Expected: "Username sau parolă incorectă"

// Empty fields
{ username: "", password: "" }
// Expected: "Username-ul trebuie să aibă minim 3 caractere"
```

### Test 4: Session Creation

After successful login, verify session was created:

```sql
-- For employee
SELECT
    s.session_id,
    s.device_fingerprint,
    s.last_activity,
    s.expires_at,
    au.email
FROM employee_sessions s
JOIN auth.users au ON s.user_id = au.id
WHERE s.invalidated_at IS NULL
ORDER BY s.created_at DESC
LIMIT 5;

-- For admin
SELECT
    s.session_id,
    s.device_fingerprint,
    s.last_activity,
    s.expires_at,
    au.email
FROM admin_sessions s
JOIN auth.users au ON s.user_id = au.id
WHERE s.invalidated_at IS NULL
ORDER BY s.created_at DESC
LIMIT 5;
```

### Test 5: Profile Data Access

After login, verify user can access their profile:

```sql
-- As employee (should only see own profile)
SELECT * FROM profiles WHERE id = auth.uid();

-- As admin (should see all profiles)
SELECT
    p.username,
    p.full_name,
    au.email,
    ur.role
FROM profiles p
JOIN auth.users au ON p.id = au.id
JOIN user_roles ur ON au.id = ur.user_id
ORDER BY p.created_at DESC;
```

## Verification Checklist

After creating a new user, verify:

- [ ] User exists in `auth.users` table
- [ ] Profile auto-created in `profiles` table
- [ ] Role assigned in `user_roles` table
- [ ] Profile data matches metadata (username, full_name)
- [ ] Email format correct (`username@company.local` for employees)
- [ ] User can login with correct credentials
- [ ] Login fails with incorrect credentials
- [ ] User redirected to correct page (/mobile or /admin)
- [ ] Session created in appropriate table (admin_sessions or employee_sessions)
- [ ] Session expires in 24 hours
- [ ] GDPR consent dialog shown for employees (first login)

## Troubleshooting

### Issue: Profile Not Created Automatically

**Cause:** Trigger `on_auth_user_created` may have failed

**Solution:**
```sql
-- Manually create profile
INSERT INTO profiles (id, username, full_name)
SELECT
    id,
    raw_user_meta_data->>'username',
    raw_user_meta_data->>'full_name'
FROM auth.users
WHERE id = 'USER_UUID_HERE'
ON CONFLICT (id) DO NOTHING;
```

### Issue: User Can't Login

**Possible Causes:**
1. Email not confirmed (`email_confirmed_at` is NULL)
2. No role assigned in `user_roles`
3. Wrong email domain format
4. Account disabled

**Check:**
```sql
SELECT
    au.id,
    au.email,
    au.email_confirmed_at,
    ur.role,
    au.banned_until,
    au.deleted_at
FROM auth.users au
LEFT JOIN user_roles ur ON au.id = ur.user_id
WHERE au.email = 'user@company.local';
```

**Fix:**
```sql
-- Confirm email
UPDATE auth.users
SET email_confirmed_at = now()
WHERE email = 'user@company.local';

-- Assign role if missing
INSERT INTO user_roles (user_id, role)
SELECT id, 'employee'::app_role
FROM auth.users
WHERE email = 'user@company.local'
ON CONFLICT (user_id, role) DO NOTHING;
```

### Issue: Legacy Domain Migration Not Working

**Check for legacy users:**
```sql
SELECT email, created_at
FROM auth.users
WHERE email LIKE '%@employee.local';
```

**Manual migration:**
```sql
-- Update email domain (requires service role)
-- Do this via Supabase Dashboard or admin API
UPDATE auth.users
SET email = REPLACE(email, '@employee.local', '@company.local')
WHERE email LIKE '%@employee.local';
```

### Issue: Session Not Created

**Verify RLS policies allow session creation:**
```sql
-- Test as user (should succeed)
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims.sub TO 'USER_UUID_HERE';

INSERT INTO employee_sessions (user_id, session_id, device_fingerprint)
VALUES (
    'USER_UUID_HERE',
    'test-session-' || gen_random_uuid(),
    'test-device'
)
RETURNING *;

-- Reset role
RESET ROLE;
```

## Security Notes

### Password Policy
- Minimum 6 characters (enforced by edge function)
- No complexity requirements currently
- Recommend: Add uppercase, lowercase, number, special char requirements

### Session Security
- Sessions expire after 24 hours
- Device fingerprinting tracks login devices
- Multi-device support (can be logged in on multiple devices)
- Session invalidation on sign-out

### RLS Protection
- Users can only view their own data
- Admins can view all data
- All tables have RLS enabled
- Cannot bypass via SQL injection

### Testing Policy (⚠️ Production Risk)
- Policy "Users can insert their own role testing" allows self-role-assignment
- **MUST BE REMOVED** before production deployment
- Only for development/testing purposes

## Best Practices

1. **Always use edge function for user creation in production**
2. **Never store passwords in plain text anywhere**
3. **Use strong passwords for admin accounts**
4. **Regularly clean up expired sessions** (run `cleanup_expired_sessions_by_role()`)
5. **Audit admin actions** (implement logging)
6. **Remove testing RLS policy** before production
7. **Implement rate limiting** on login endpoints
8. **Monitor failed login attempts** for security
9. **Regular backups** of auth.users and user_roles tables
10. **Document all user creation** for audit purposes

## Quick Commands Reference

```bash
# Create employee via API
curl -X POST "$SUPABASE_URL/functions/v1/create-user" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"username":"user","firstName":"First","lastName":"Last","password":"pass123","role":"employee"}'

# Create admin via API
curl -X POST "$SUPABASE_URL/functions/v1/create-user" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","firstName":"Admin","lastName":"User","password":"adminpass","role":"admin"}'

# Login as employee
curl -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@company.local","password":"pass123"}'

# Login as admin
curl -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@tgservices.ro","password":"adminpass"}'
```

## Support

For issues or questions:
1. Check DATABASE_ANALYSIS.md for schema details
2. Run diagnostic queries from TEST_SCRIPTS.sql
3. Review error logs in Supabase Dashboard
4. Check browser console for frontend errors
5. Verify environment variables are set correctly
