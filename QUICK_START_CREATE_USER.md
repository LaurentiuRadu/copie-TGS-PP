# Quick Start: Create Your First Test User

## Option 1: Using Supabase Dashboard (Easiest)

### Step 1: Create the User
1. Open your Supabase Dashboard
2. Go to **Authentication** → **Users**
3. Click **"Add User"** → **"Create new user"**
4. Fill in the form:
   - **Email:** `testuser@company.local`
   - **Password:** `test123` (or your preferred password)
   - **Auto Confirm User:** ✅ **Check this box!**
   - **User Metadata:** Click "Add metadata" and paste:
     ```json
     {
       "username": "testuser",
       "full_name": "Test User"
     }
     ```
5. Click **"Create user"**

### Step 2: Assign Role
1. Go to **SQL Editor** in Supabase Dashboard
2. Copy the user's ID from the Users page (it's a UUID like `123e4567-e89b-12d3-a456-426614174000`)
3. Run this SQL (replace `YOUR_USER_ID` with the actual UUID):
   ```sql
   INSERT INTO user_roles (user_id, role)
   VALUES ('YOUR_USER_ID', 'employee');
   ```
4. Click **Run**

### Step 3: Verify Creation
Run this SQL to verify everything worked:
```sql
SELECT
    au.email,
    p.username,
    p.full_name,
    ur.role
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
LEFT JOIN user_roles ur ON au.id = ur.user_id
WHERE au.email = 'testuser@company.local';
```

You should see:
```
email                   | username  | full_name | role
testuser@company.local  | testuser  | Test User | employee
```

### Step 4: Test Login
1. Go to your application's login page: `/auth`
2. Enter:
   - **Username:** `testuser`
   - **Password:** `test123` (whatever you set)
3. Click **Login**
4. You should be redirected to `/mobile` (employee dashboard)

---

## Option 2: Using the Edge Function (Recommended for Production)

### Prerequisites
- You must be logged in as an admin
- You need your admin JWT token

### Step 1: Get Your Admin JWT Token
1. Login as admin at `/admin-login`
2. Open browser DevTools (F12)
3. Go to **Console** tab
4. Paste and run:
   ```javascript
   const session = await supabase.auth.getSession();
   console.log(session.data.session.access_token);
   ```
5. Copy the token that appears (starts with `eyJ...`)

### Step 2: Create User via API
Open a terminal and run (replace `YOUR_JWT_TOKEN` with the token from Step 1):

```bash
curl -X POST 'https://xxxxxxxxxxxx.supabase.co/functions/v1/create-user' \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "firstName": "Test",
    "lastName": "User",
    "password": "test123",
    "role": "employee"
  }'
```

**Note:** Replace `xxxxxxxxxxxx.supabase.co` with your actual Supabase project URL (find it in your `.env` file as `VITE_SUPABASE_URL`)

### Step 3: Verify Success
You should see a response like:
```json
{
  "success": true,
  "message": "User created successfully",
  "user": {
    "id": "uuid-here",
    "username": "testuser",
    "fullName": "Test User",
    "email": "testuser@company.local"
  }
}
```

### Step 4: Test Login
Same as Option 1, Step 4 above.

---

## Creating Multiple Test Users

### Using Dashboard
Repeat Option 1 for each user:

**Example Users:**
1. Employee: `johnsmith@company.local` (username: `johnsmith`)
2. Employee: `janedoe@company.local` (username: `janedoe`)
3. Admin: `admin2@company.local` (username: `admin2`, role: `admin`)

### Using Edge Function
Create a script file `create_test_users.sh`:

```bash
#!/bin/bash

# Set your variables
SUPABASE_URL="https://xxxxxxxxxxxx.supabase.co"
ADMIN_JWT="YOUR_JWT_TOKEN_HERE"

# Create multiple employees
curl -X POST "$SUPABASE_URL/functions/v1/create-user" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"username":"johnsmith","firstName":"John","lastName":"Smith","password":"test123","role":"employee"}'

curl -X POST "$SUPABASE_URL/functions/v1/create-user" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"username":"janedoe","firstName":"Jane","lastName":"Doe","password":"test123","role":"employee"}'

curl -X POST "$SUPABASE_URL/functions/v1/create-user" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"username":"bobsmith","firstName":"Bob","lastName":"Smith","password":"test123","role":"employee"}'

echo "Users created!"
```

Make executable and run:
```bash
chmod +x create_test_users.sh
./create_test_users.sh
```

---

## Troubleshooting

### Error: "Profile was not created automatically"

**Fix:**
```sql
-- Get user ID
SELECT id FROM auth.users WHERE email = 'testuser@company.local';

-- Create profile manually (replace USER_ID)
INSERT INTO profiles (id, username, full_name)
VALUES (
  'USER_ID',
  'testuser',
  'Test User'
);
```

### Error: "User can't login - Invalid credentials"

**Check email confirmation:**
```sql
SELECT email, email_confirmed_at
FROM auth.users
WHERE email = 'testuser@company.local';
```

If `email_confirmed_at` is NULL:
```sql
UPDATE auth.users
SET email_confirmed_at = now()
WHERE email = 'testuser@company.local';
```

### Error: "User has no role"

**Fix:**
```sql
-- Get user ID
SELECT id FROM auth.users WHERE email = 'testuser@company.local';

-- Assign role (replace USER_ID)
INSERT INTO user_roles (user_id, role)
VALUES ('USER_ID', 'employee');
```

### Error: Edge function returns 403 "Admin access required"

**Your JWT token expired or you're not an admin.**

Get a fresh token:
1. Login as admin again
2. Get new JWT token from browser console
3. Use the new token in your curl command

---

## Verification SQL Query

Run this to see all your test users:

```sql
SELECT
    au.email,
    au.raw_user_meta_data->>'username' as username,
    p.full_name,
    ur.role,
    au.email_confirmed_at IS NOT NULL as email_confirmed,
    p.id IS NOT NULL as has_profile,
    ur.role IS NOT NULL as has_role,
    au.created_at
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
LEFT JOIN user_roles ur ON au.id = ur.user_id
ORDER BY au.created_at DESC;
```

Expected result:
```
email                   | username  | full_name | role     | email_confirmed | has_profile | has_role
testuser@company.local  | testuser  | Test User | employee | true           | true        | true
```

All columns should be `true` for the user to login successfully!

---

## Clean Up Test Users

When you're done testing, delete test users:

```sql
-- View test users
SELECT id, email FROM auth.users WHERE email LIKE '%test%';

-- Delete a specific test user (cascades to profiles and user_roles)
-- Option 1: Via Supabase Dashboard
-- Go to Authentication → Users → Click user → Delete User

-- Option 2: Via SQL (replace USER_ID)
DELETE FROM auth.users WHERE id = 'USER_ID';
```

**Note:** Deleting from `auth.users` automatically deletes related records in `profiles` and `user_roles` due to CASCADE constraints.

---

## Next Steps

After creating your test user:

1. **Test Login** - Try logging in with employee credentials
2. **Test Clock In/Out** - Use the time tracking features
3. **Test Admin Functions** - Create users, approve time entries
4. **Test Mobile Features** - Install as PWA, test offline mode
5. **Review Sessions** - Check `employee_sessions` table for session creation
6. **Test GDPR Consent** - First login should show consent dialog

---

## Production Notes

**Before going to production:**

1. Remove the testing RLS policy:
   ```sql
   DROP POLICY IF EXISTS "Users can insert their own role testing" ON user_roles;
   ```

2. Change default test passwords to secure passwords

3. Implement rate limiting on login endpoints

4. Add audit logging for user creation

5. Set up email verification for admin accounts

6. Review all test users and delete them

7. Document your production user creation process

---

## Summary

**Fastest way to create a test user:**
1. Supabase Dashboard → Authentication → Users → Add User
2. Email: `testuser@company.local`, Password: `test123`, Auto-confirm: ✅
3. Metadata: `{"username":"testuser","full_name":"Test User"}`
4. SQL Editor: `INSERT INTO user_roles (user_id, role) VALUES ('USER_ID', 'employee');`
5. Test login at `/auth` with username: `testuser`, password: `test123`

**That's it! You now have a working test user.**
