const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyDb() {
    console.log('Applying Error Reports Table and RLS...');
    
    const sql = `
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
        CREATE POLICY "Developers can view all error reports" ON public.error_reports
            FOR SELECT TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.users 
                    WHERE email = auth.jwt() ->> 'email' 
                    AND role = 'DEVELOPER'
                )
            );
    `;

    try {
        // We attempt to use exec_sql. If it fails, we notify the user.
        const { error } = await supabase.rpc('exec_sql', { sql });
        if (error) {
            console.error('Error applying SQL via RPC:', error.message);
            console.log('\n--- MANUAL ACTION REQUIRED ---');
            console.log('Please copy-paste the content of error_reports_table.sql into the Supabase SQL Editor.');
        } else {
            console.log('Database schema applied successfully!');
        }
    } catch (err) {
        console.error('Failed to execute RPC:', err.message);
    }
}

applyDb();
