const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updateRLS() {
    console.log('Updating Error Reports RLS to include ADMIN...');
    
    const sql = `
        -- 1. Drop existing selector policy
        DROP POLICY IF EXISTS "Developers can view all error reports" ON public.error_reports;

        -- 2. Create new selector policy for Developers AND Admins
        CREATE POLICY "Devs and Admins can view error reports" ON public.error_reports
            FOR SELECT TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.users 
                    WHERE email = auth.jwt() ->> 'email' 
                    AND role IN ('DEVELOPER', 'ADMIN')
                )
            );

        -- 3. Create update policy for Developers AND Admins
        DROP POLICY IF EXISTS "Developers can update error reports" ON public.error_reports;
        CREATE POLICY "Devs and Admins can update error reports" ON public.error_reports
            FOR UPDATE TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.users 
                    WHERE email = auth.jwt() ->> 'email' 
                    AND role IN ('DEVELOPER', 'ADMIN')
                )
            );
    `;

    try {
        const { error } = await supabase.rpc('exec_sql', { sql });
        if (error) {
            console.error('Error applying SQL:', error.message);
            console.log('\n--- MANUAL ACTION REQUIRED ---');
            console.log('Please run the following SQL in Supabase Editor:');
            console.log(sql);
        } else {
            console.log('RLS updated successfully!');
        }
    } catch (err) {
        console.error('failed:', err.message);
    }
}

updateRLS();
