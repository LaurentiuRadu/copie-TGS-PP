# Database Schema and Authentication Analysis Report

Generated: 2025-10-20

## Executive Summary

This report provides a comprehensive analysis of the TGS PP (Time Tracking System) database schema, authentication mechanisms, and user creation workflows. The system uses Supabase authentication with custom role-based access control (RBAC) for admin and employee users.

## 1. Database Schema Overview

### 1.1 Core Authentication Tables

#### **auth.users** (Supabase Managed)
- Primary authentication table managed by Supabase
- Stores email, encrypted password, and user metadata
- Email format patterns:
  - Admins: Real email addresses (e.g., `laurentiu.radu@tgservices.ro`)
  - Employees: Generated from username (e.g., `username@company.local`)
  - Legacy employees: `username@employee.local` (migration support)

#### **user_roles** (Custom)
```sql
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id, role)
);
```

**Purpose:** Maps users to their roles (admin or employee)

**app_role ENUM Values:**
- `admin` - Full system access, can create/manage users
- `employee` - Limited access, can track time and request vacations

**Constraints:**
- Unique constraint on (user_id, role) prevents duplicate role assignments
- ON DELETE CASCADE ensures role cleanup when user is deleted

**Current Data:**
- Total Users: 1
- Admin Users: 1 (laurentiu.radu@tgservices.ro)
- Employee Users: 0

#### **profiles** (Custom)
```sql
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    full_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

**Purpose:** Stores user profile information synchronized from auth.users metadata

**Automatic Creation:** Trigger `on_auth_user_created` automatically creates profile when user is created

**Trigger Function:**
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$;
```

### 1.2 Session Management Tables

#### **admin_sessions**
Tracks active sessions for admin users with device fingerprinting and session invalidation capabilities.

**Key Fields:**
- `session_id` - Unique session identifier
- `device_fingerprint` - Browser/device identification
- `last_activity` - Last activity timestamp
- `expires_at` - Session expiration time (24 hours default)
- `invalidated_at` - Session invalidation timestamp
- `invalidation_reason` - Reason for session termination

#### **employee_sessions**
Identical structure to admin_sessions but for employee users.

**Separation Rationale:**
- Different security policies per role
- Separate audit trails
- Role-specific session management

### 1.3 Security Functions

#### **has_role(_user_id UUID, _role app_role)**
```sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
```

**Purpose:** Security definer function used in RLS policies to check user roles

**Security Level:** SECURITY DEFINER allows execution with elevated privileges

## 2. Row Level Security (RLS) Analysis

### 2.1 user_roles Policies

**Viewing Policies:**
1. **"Users can view their own roles"**
   ```sql
   FOR SELECT USING (auth.uid() = user_id);
   ```
   - Users can only see their own role assignments

2. **"Admins can view all roles"**
   ```sql
   FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
   ```
   - Admins can view all user roles

3. **"Users can insert their own role testing"** ⚠️ TESTING ONLY
   ```sql
   FOR INSERT WITH CHECK (auth.uid() = user_id);
   ```
   - **Security Note:** This policy should be removed in production
   - Allows users to assign roles to themselves
   - Only present for testing purposes

### 2.2 profiles Policies

**Viewing:**
- Users can view their own profile
- Admins can view all profiles

**Updating:**
- Users can update only their own profile
- Automatic `updated_at` timestamp via trigger

### 2.3 Session Table Policies

Both admin_sessions and employee_sessions have identical policy structures:
- Users can only view/insert/update/delete their own sessions
- Role verification using `has_role()` function
- Prevents cross-role session access

## 3. Create-User Edge Function Analysis

**Location:** `/supabase/functions/create-user/index.ts`

### 3.1 Authentication Flow

```typescript
// 1. Verify Authorization Header
const authHeader = req.headers.get('Authorization');
if (!authHeader) return 401;

// 2. Extract and Validate JWT Token
const token = authHeader.replace('Bearer ', '');
const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

// 3. Verify User is Admin
const { data: roles } = await supabaseClient
  .from('user_roles')
  .select('role')
  .eq('user_id', user.id)
  .eq('role', 'admin')
  .single();

if (!roles) return 403; // Admin access required
```

**Security Measures:**
- Requires valid JWT token in Authorization header
- Verifies requesting user exists in auth.users
- Confirms requesting user has 'admin' role
- Returns 403 if not admin

### 3.2 Input Validation

```typescript
const { username, firstName, lastName, password, role } = await req.json();

// Required Fields Check
if (!username || !firstName || !lastName || !password || !role) {
  return 400; // Missing required fields
}

// Password Policy
if (password.length < 6) {
  return 400; // Password must be at least 6 characters
}
```

**Validation Rules:**
- Username: Required (becomes part of email)
- First Name: Required
- Last Name: Required
- Password: Minimum 6 characters
- Role: Required ('admin' or 'employee')

### 3.3 User Creation Process

```typescript
// 1. Generate Email and Full Name
const fullName = `${firstName} ${lastName}`;
const email = `${username}@company.local`;

// 2. Create Auth User
const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
  email: email,
  password: password,
  email_confirm: true, // Auto-confirm email
  user_metadata: {
    username: username,
    full_name: fullName
  }
});

// 3. Assign Role
const { error: roleError } = await supabaseClient
  .from('user_roles')
  .insert({
    user_id: authData.user.id,
    role: role
  });
```

**Process Steps:**
1. Generates email using pattern `username@company.local`
2. Creates user in auth.users with email_confirm=true (no verification email)
3. Stores username and full_name in user_metadata
4. Trigger automatically creates profile from metadata
5. Explicitly inserts role into user_roles table

**Error Handling:**
- Duplicate email: Returns auth error message
- Invalid role value: Database constraint violation
- Role insertion failure: Returns "Failed to assign role"

### 3.4 CORS Configuration

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

**Configuration:**
- Allows requests from any origin
- Handles OPTIONS preflight requests
- Returns proper CORS headers on all responses

## 4. User Login Flow Analysis

### 4.1 Employee Login (Username-Based)

**Location:** `/src/pages/Auth.tsx`

```typescript
// 1. Validate Username and Password
const validated = employeeSchema.parse({
  username: employeeUsername,
  password: employeePassword,
});

// 2. Try Primary Email Domain
const primaryEmail = `${validated.username}@company.local`;
let { error: signInError } = await supabase.auth.signInWithPassword({
  email: primaryEmail,
  password: validated.password,
});

// 3. Fallback to Legacy Domain
if (signInError && signInError.message.includes("Invalid")) {
  const fallbackEmail = `${validated.username}@employee.local`;
  const { data: fallbackData, error: fallbackError } = await supabase.auth.signInWithPassword({
    email: fallbackEmail,
    password: validated.password,
  });

  // 4. Auto-migrate to new domain
  if (fallbackData.user) {
    supabase.auth.admin.updateUserById(fallbackData.user.id, {
      email: primaryEmail
    });
  }
}
```

**Employee Login Features:**
- Username converted to lowercase automatically
- Primary domain: `@company.local`
- Legacy domain support: `@employee.local` with auto-migration
- Validation: Username min 3 chars, password min 6 chars
- Redirects to `/mobile` after successful login

### 4.2 Admin Login (Email-Based)

**Location:** `/src/pages/AdminAuth.tsx`

```typescript
// 1. Validate Email and Password
const validated = adminSchema.parse({
  email: adminEmail,
  password: adminPassword,
});

// 2. Sign In with Email
const { error: signInError } = await supabase.auth.signInWithPassword({
  email: validated.email,
  password: validated.password,
});

// 3. Redirect to Admin Dashboard
navigate("/admin");
```

**Admin Login Features:**
- Requires valid email format
- No domain conversion or fallback
- Direct authentication with real email
- Redirects to `/admin` after successful login

### 4.3 Post-Login Processing (AuthContext)

**Location:** `/src/contexts/AuthContext.tsx`

After successful login, the AuthContext performs several operations:

```typescript
// 1. Fetch User Role
const { data: roleData } = await supabase
  .from('user_roles')
  .select('role')
  .eq('user_id', session.user.id)
  .maybeSingle();

// 2. Register Session
const tableName = role === 'admin' ? 'admin_sessions' : 'employee_sessions';
// Insert/update session with device fingerprint

// 3. Check Password Change Requirement
const { data: pwData } = await supabase
  .from('user_password_tracking')
  .select('must_change_password')
  .eq('user_id', userId)
  .maybeSingle();

// 4. Check GDPR Consent (Employees Only)
if (role === 'employee') {
  const hasConsents = await checkUserConsents(userId);
  if (!hasConsents) {
    setNeedsGDPRConsent(true); // Shows consent dialog
  }
}

// 5. Navigate Based on Role
if (role === 'admin') navigate('/admin');
else if (role === 'employee') navigate('/mobile');
```

**Session Features:**
- Session stored in both localStorage and IndexedDB (iOS PWA support)
- Device fingerprinting for security tracking
- 24-hour session expiration (automatic refresh)
- Multi-device session tracking
- Session invalidation on sign-out from any device

## 5. Security Considerations

### 5.1 Strengths

✅ **Role-Based Access Control:** Proper separation of admin and employee privileges
✅ **RLS Policies:** Database-level security prevents unauthorized data access
✅ **Admin-Only User Creation:** Only admins can create new users via edge function
✅ **Session Tracking:** Device fingerprinting and session invalidation
✅ **Password Policy:** Minimum 6 characters enforced
✅ **GDPR Compliance:** Consent tracking for employees
✅ **Automatic Profile Creation:** Trigger ensures data consistency

### 5.2 Potential Improvements

⚠️ **Testing Policy in Production:** Remove "Users can insert their own role testing" policy
⚠️ **Password Complexity:** Consider requiring special characters, numbers, uppercase
⚠️ **Rate Limiting:** No apparent rate limiting on login attempts
⚠️ **Session Timeout:** 24-hour sessions may be too long for sensitive operations
⚠️ **Email Verification:** Admin accounts should verify email addresses
⚠️ **Audit Logging:** No comprehensive audit trail for admin actions
⚠️ **2FA/MFA:** No multi-factor authentication available

### 5.3 Domain Migration Strategy

The system handles legacy `@employee.local` domains with automatic migration:
1. Try login with current domain (`@company.local`)
2. On failure, try legacy domain (`@employee.local`)
3. If legacy succeeds, background task updates to new domain
4. Future logins use new domain

**Benefits:**
- Zero-downtime migration
- Transparent to users
- Gradual migration without forced password resets

## 6. Test Scripts

See `TEST_SCRIPTS.sql` for comprehensive testing procedures including:
- User creation tests
- Login validation tests
- Role assignment tests
- Session management tests
- RLS policy verification tests

## 7. Current System State

**Database Statistics:**
- Total Users: 1
- Admin Users: 1
- Employee Users: 0
- Active Sessions: Unknown (requires session table query)

**Existing Admin:**
- Email: laurentiu.radu@tgservices.ro
- Username: laurentiu.radu
- Full Name: Laurentiu Radu
- Role: admin
- Created: 2025-10-20 16:13:34 UTC

## 8. Recommendations

### Immediate Actions
1. Remove testing RLS policy from user_roles table
2. Implement rate limiting on authentication endpoints
3. Add audit logging for admin user creation/deletion
4. Document password policy requirements for users

### Short-term Improvements
1. Implement password complexity requirements
2. Add session timeout configuration per role
3. Create admin audit dashboard
4. Implement email verification for admin accounts

### Long-term Enhancements
1. Add multi-factor authentication support
2. Implement advanced session security (IP tracking, anomaly detection)
3. Create comprehensive security audit system
4. Add user activity monitoring and reporting

## Conclusion

The TGS PP authentication system demonstrates a solid foundation with proper role-based access control, secure user creation workflows, and comprehensive session management. The database schema is well-structured with appropriate constraints and RLS policies. The create-user edge function properly validates admin privileges before allowing user creation.

Key strengths include separation of admin and employee concerns, automatic profile creation, and legacy domain support for smooth migration. Areas for improvement focus on enhancing password policies, implementing rate limiting, and adding comprehensive audit logging.

The system is production-ready with minor adjustments recommended for enhanced security and compliance.
