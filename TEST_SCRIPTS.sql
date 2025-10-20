-- ================================================================
-- TGS PP Database Test Scripts
-- Generated: 2025-10-20
-- Purpose: Test user creation, authentication, and role management
-- ================================================================

-- ================================================================
-- SECTION 1: DIAGNOSTIC QUERIES
-- ================================================================

-- 1.1 Check Current User Count by Role
SELECT
    'User Statistics' as report_section,
    COUNT(*) as total_users,
    COUNT(CASE WHEN ur.role = 'admin' THEN 1 END) as admin_count,
    COUNT(CASE WHEN ur.role = 'employee' THEN 1 END) as employee_count,
    COUNT(CASE WHEN ur.role IS NULL THEN 1 END) as users_without_role
FROM auth.users au
LEFT JOIN user_roles ur ON au.id = ur.user_id;

-- 1.2 List All Users with Details
SELECT
    au.id,
    au.email,
    au.raw_user_meta_data->>'username' as username,
    au.raw_user_meta_data->>'full_name' as full_name,
    ur.role,
    p.username as profile_username,
    p.full_name as profile_full_name,
    au.email_confirmed_at,
    au.created_at,
    au.last_sign_in_at
FROM auth.users au
LEFT JOIN user_roles ur ON au.id = ur.user_id
LEFT JOIN profiles p ON au.id = p.id
ORDER BY au.created_at DESC;

-- 1.3 Check Profile-User Synchronization
SELECT
    'Profile Sync Check' as report_section,
    COUNT(DISTINCT au.id) as total_auth_users,
    COUNT(DISTINCT p.id) as total_profiles,
    COUNT(DISTINCT au.id) - COUNT(DISTINCT p.id) as missing_profiles
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id;

-- 1.4 Check Role Assignment Integrity
SELECT
    'Role Assignment Check' as report_section,
    COUNT(DISTINCT au.id) as total_auth_users,
    COUNT(DISTINCT ur.user_id) as users_with_roles,
    COUNT(DISTINCT au.id) - COUNT(DISTINCT ur.user_id) as users_without_roles
FROM auth.users au
LEFT JOIN user_roles ur ON au.id = ur.user_id;

-- 1.5 List Users Without Roles (Should be empty in production)
SELECT
    au.id,
    au.email,
    au.created_at,
    'WARNING: User exists without role assignment' as issue
FROM auth.users au
LEFT JOIN user_roles ur ON au.id = ur.user_id
WHERE ur.user_id IS NULL;

-- 1.6 List Users Without Profiles (Should be empty)
SELECT
    au.id,
    au.email,
    au.created_at,
    'WARNING: User exists without profile' as issue
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
WHERE p.id IS NULL;

-- ================================================================
-- SECTION 2: SESSION MANAGEMENT QUERIES
-- ================================================================

-- 2.1 Check Active Admin Sessions
SELECT
    'Active Admin Sessions' as report_section,
    COUNT(*) as active_sessions,
    COUNT(DISTINCT user_id) as unique_users
FROM admin_sessions
WHERE invalidated_at IS NULL
    AND expires_at > now();

-- 2.2 Check Active Employee Sessions
SELECT
    'Active Employee Sessions' as report_section,
    COUNT(*) as active_sessions,
    COUNT(DISTINCT user_id) as unique_users
FROM employee_sessions
WHERE invalidated_at IS NULL
    AND expires_at > now();

-- 2.3 List All Active Sessions with User Details
SELECT
    'Admin' as user_type,
    s.session_id,
    au.email,
    p.username,
    p.full_name,
    s.last_activity,
    s.expires_at,
    s.device_fingerprint
FROM admin_sessions s
JOIN auth.users au ON s.user_id = au.id
JOIN profiles p ON au.id = p.id
WHERE s.invalidated_at IS NULL
    AND s.expires_at > now()
UNION ALL
SELECT
    'Employee' as user_type,
    s.session_id,
    au.email,
    p.username,
    p.full_name,
    s.last_activity,
    s.expires_at,
    s.device_fingerprint
FROM employee_sessions s
JOIN auth.users au ON s.user_id = au.id
JOIN profiles p ON au.id = p.id
WHERE s.invalidated_at IS NULL
    AND s.expires_at > now()
ORDER BY last_activity DESC;

-- ================================================================
-- SECTION 3: RLS POLICY TESTING
-- ================================================================

-- 3.1 Verify has_role() Function Works Correctly
-- Test with existing admin user
DO $$
DECLARE
    admin_user_id UUID;
    is_admin BOOLEAN;
    is_employee BOOLEAN;
BEGIN
    SELECT id INTO admin_user_id FROM auth.users LIMIT 1;

    SELECT has_role(admin_user_id, 'admin'::app_role) INTO is_admin;
    SELECT has_role(admin_user_id, 'employee'::app_role) INTO is_employee;

    RAISE NOTICE 'Admin User ID: %', admin_user_id;
    RAISE NOTICE 'Is Admin: %', is_admin;
    RAISE NOTICE 'Is Employee: %', is_employee;
    RAISE NOTICE 'Expected: Is Admin = TRUE, Is Employee = FALSE';
END $$;

-- 3.2 Test app_role ENUM Values
SELECT
    'app_role ENUM Values' as report_section,
    enumlabel as allowed_role
FROM pg_enum
WHERE enumtypid = 'app_role'::regtype
ORDER BY enumsortorder;

-- ================================================================
-- SECTION 4: DATA VALIDATION QUERIES
-- ================================================================

-- 4.1 Check for Duplicate Usernames
SELECT
    username,
    COUNT(*) as count,
    'WARNING: Duplicate username detected' as issue
FROM profiles
WHERE username IS NOT NULL
GROUP BY username
HAVING COUNT(*) > 1;

-- 4.2 Check for Invalid Email Domains
SELECT
    email,
    CASE
        WHEN email LIKE '%@company.local' THEN 'Employee (Current)'
        WHEN email LIKE '%@employee.local' THEN 'Employee (Legacy - Needs Migration)'
        ELSE 'Admin or Other'
    END as email_type,
    ur.role,
    au.created_at
FROM auth.users au
LEFT JOIN user_roles ur ON au.id = ur.user_id
ORDER BY au.created_at DESC;

-- 4.3 Find Users with Inconsistent Metadata
SELECT
    au.id,
    au.email,
    au.raw_user_meta_data->>'username' as metadata_username,
    p.username as profile_username,
    au.raw_user_meta_data->>'full_name' as metadata_fullname,
    p.full_name as profile_fullname,
    'WARNING: Metadata mismatch' as issue
FROM auth.users au
JOIN profiles p ON au.id = p.id
WHERE (au.raw_user_meta_data->>'username' != p.username
    OR au.raw_user_meta_data->>'full_name' != p.full_name)
    AND p.username IS NOT NULL;

-- ================================================================
-- SECTION 5: TEST USER CREATION (SQL Direct Method)
-- ================================================================

-- ⚠️ WARNING: These scripts create real users in the database
-- Only run in development/testing environments
-- Comment out in production

-- 5.1 Create Test Employee User (Direct SQL - For Testing Only)
-- Note: This bypasses the edge function and creates users directly
-- In production, always use the create-user edge function

/*
DO $$
DECLARE
    test_user_id UUID;
    test_email TEXT := 'testemployee@company.local';
    test_username TEXT := 'testemployee';
    test_full_name TEXT := 'Test Employee';
BEGIN
    -- Check if user already exists
    SELECT id INTO test_user_id
    FROM auth.users
    WHERE email = test_email;

    IF test_user_id IS NOT NULL THEN
        RAISE NOTICE 'User already exists: %', test_email;
        RETURN;
    END IF;

    -- Create user in auth.users (requires service role)
    -- This would normally be done via edge function
    RAISE NOTICE 'Cannot create auth.users directly from SQL';
    RAISE NOTICE 'Use the create-user edge function instead';
    RAISE NOTICE 'Or use Supabase Dashboard > Authentication > Add User';

END $$;
*/

-- 5.2 Verify Test User Creation
-- Run this after creating a test user via edge function or dashboard
/*
SELECT
    au.id,
    au.email,
    au.raw_user_meta_data->>'username' as username,
    ur.role,
    p.username as profile_username,
    p.full_name as profile_fullname
FROM auth.users au
LEFT JOIN user_roles ur ON au.id = ur.user_id
LEFT JOIN profiles p ON au.id = p.id
WHERE au.email LIKE '%test%'
ORDER BY au.created_at DESC;
*/

-- ================================================================
-- SECTION 6: CLEANUP SCRIPTS
-- ================================================================

-- 6.1 Delete Test Users (Use with caution!)
-- Uncomment to delete test users

/*
-- Delete specific test user by email
DO $$
DECLARE
    test_user_id UUID;
BEGIN
    -- Find the test user
    SELECT id INTO test_user_id
    FROM auth.users
    WHERE email = 'testemployee@company.local';

    IF test_user_id IS NULL THEN
        RAISE NOTICE 'Test user not found';
        RETURN;
    END IF;

    -- Delete from user_roles (will cascade from auth.users deletion)
    DELETE FROM user_roles WHERE user_id = test_user_id;

    -- Delete from profiles (will cascade from auth.users deletion)
    DELETE FROM profiles WHERE id = test_user_id;

    -- Delete from auth.users (requires service role)
    -- This should be done via Supabase Dashboard or admin API
    RAISE NOTICE 'User data cleaned up. Delete from auth.users via dashboard: %', test_user_id;

END $$;
*/

-- 6.2 Clean up expired sessions
SELECT cleanup_expired_sessions_by_role();

-- 6.3 List expired but not cleaned sessions
SELECT
    'Expired Admin Sessions' as session_type,
    COUNT(*) as count
FROM admin_sessions
WHERE expires_at < now() OR invalidated_at IS NOT NULL
UNION ALL
SELECT
    'Expired Employee Sessions' as session_type,
    COUNT(*) as count
FROM employee_sessions
WHERE expires_at < now() OR invalidated_at IS NOT NULL;

-- ================================================================
-- SECTION 7: SECURITY AUDIT QUERIES
-- ================================================================

-- 7.1 List all RLS policies
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd as command,
    CASE
        WHEN qual IS NOT NULL THEN 'Has USING clause'
        ELSE 'No USING clause'
    END as using_clause,
    CASE
        WHEN with_check IS NOT NULL THEN 'Has WITH CHECK clause'
        ELSE 'No WITH CHECK clause'
    END as with_check_clause
FROM pg_policies
WHERE tablename IN ('user_roles', 'profiles', 'admin_sessions', 'employee_sessions', 'time_entries')
ORDER BY tablename, policyname;

-- 7.2 Check for tables without RLS enabled
SELECT
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('user_roles', 'profiles', 'admin_sessions', 'employee_sessions', 'time_entries')
ORDER BY tablename;

-- 7.3 Verify CASCADE constraints
SELECT
    tc.table_schema,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule,
    rc.update_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name IN ('user_roles', 'profiles', 'admin_sessions', 'employee_sessions')
ORDER BY tc.table_name;

-- ================================================================
-- SECTION 8: PERFORMANCE QUERIES
-- ================================================================

-- 8.1 Check index usage on key tables
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan as times_used,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename IN ('user_roles', 'profiles', 'admin_sessions', 'employee_sessions')
ORDER BY tablename, idx_scan DESC;

-- 8.2 Table sizes
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS index_size
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('user_roles', 'profiles', 'admin_sessions', 'employee_sessions', 'time_entries')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ================================================================
-- END OF TEST SCRIPTS
-- ================================================================

-- Usage Instructions:
-- 1. Run SECTION 1 to get current database statistics
-- 2. Run SECTION 2 to check active sessions
-- 3. Run SECTION 3 to verify RLS policies
-- 4. Run SECTION 4 to validate data integrity
-- 5. Use SECTION 5 for test user creation (via edge function recommended)
-- 6. Run SECTION 7 for security audits
-- 7. Run SECTION 8 for performance analysis
-- 8. Use SECTION 6 carefully for cleanup operations
