const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixRLS() {
    console.log('Applying Robust RLS (Email-based Role Checks)...');
    
    const sql = `
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
        -- We match by ID OR by Email to ensure migrated users can always find themselves
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
        -- We check role by matching the current user's email from JWT against the users table
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
        -- Matches by EITHER the new Supabase ID (auth.uid()) OR by searching the users table for their email
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
    `;

    try {
        const { error } = await supabase.rpc('exec_sql', { sql });
        if (error) {
            console.error('Error applying SQL:', error.message);
        } else {
            console.log('Robust RLS applied successfully!');
        }
    } catch (err) {
        console.error('failed:', err.message);
    }
}

fixRLS();
