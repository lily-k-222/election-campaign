-- 1. Ensure RLS is enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing problematic policies
DROP POLICY IF EXISTS "Allow authenticated read users" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.users;
DROP POLICY IF EXISTS "Admins can do everything on contacts" ON public.contacts;
DROP POLICY IF EXISTS "Volunteers can read assigned contacts" ON public.contacts;
DROP POLICY IF EXISTS "Volunteers can update assigned contacts" ON public.contacts;

-- 3. Define new Email-based policies for users migration

-- USERS table
-- Authenticated users can read all users (to see manager lists)
CREATE POLICY "Allow authenticated read users" ON public.users 
    FOR SELECT TO authenticated 
    USING (true);

-- Allow users to insert their own profile upon first login
CREATE POLICY "Users can insert their own profile" ON public.users
    FOR INSERT TO authenticated
    WITH CHECK (email = auth.jwt() ->> 'email');

-- Allow users to update their own profile (e.g., for ID migration)
CREATE POLICY "Users can update their own profile" ON public.users
    FOR UPDATE TO authenticated
    USING (email = auth.jwt() ->> 'email')
    WITH CHECK (email = auth.jwt() ->> 'email');

-- ADMINS can update any user profile
CREATE POLICY "Admins can update all profiles" ON public.users 
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE email = auth.jwt() ->> 'email' 
            AND role IN ('ADMIN', 'DEVELOPER')
        )
    );

-- CONTACTS table
-- ADMINS/DEVELOPERS can do everything
CREATE POLICY "Admins can do everything on contacts" ON public.contacts 
    FOR ALL TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE email = auth.jwt() ->> 'email' 
            AND role IN ('ADMIN', 'DEVELOPER')
        )
    );

-- VOLUNTEERS can read/update assigned contacts
CREATE POLICY "Volunteers can read assigned contacts" ON public.contacts 
    FOR SELECT TO authenticated 
    USING (
        assigned_to = auth.uid()::text 
        OR 
        assigned_to = (SELECT id FROM public.users WHERE email = auth.jwt() ->> 'email')
    );

CREATE POLICY "Volunteers can update assigned contacts" ON public.contacts 
    FOR UPDATE TO authenticated 
    USING (
        assigned_to = auth.uid()::text 
        OR 
        assigned_to = (SELECT id FROM public.users WHERE email = auth.jwt() ->> 'email')
    );
