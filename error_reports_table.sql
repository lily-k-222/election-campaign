-- 1. Create error_reports table
CREATE TABLE IF NOT EXISTS public.error_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    user_id TEXT,
    user_email TEXT,
    user_name TEXT,
    category TEXT,
    description TEXT,
    metadata JSONB,
    status TEXT DEFAULT 'PENDING'
);

-- 2. Enable RLS
ALTER TABLE public.error_reports ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies if any
DROP POLICY IF EXISTS "Anyone can insert error reports" ON public.error_reports;
DROP POLICY IF EXISTS "Developers can view all error reports" ON public.error_reports;

-- 4. Create Policies
-- Allow any authenticated user to insert an error report
CREATE POLICY "Anyone can insert error reports" ON public.error_reports
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- Allow only DEVELOPER role to select/view reports
-- We check the role from the public.users table using the email from the JWT
CREATE POLICY "Developers can view all error reports" ON public.error_reports
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE email = auth.jwt() ->> 'email' 
            AND role = 'DEVELOPER'
        )
    );
