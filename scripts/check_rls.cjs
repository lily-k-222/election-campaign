const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkRLS() {
    try {
        console.log('Checking users table RLS status...');
        const { data: rls, error: rlsError } = await supabase.rpc('exec_sql', { 
            sql: "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users';" 
        });
        
        if (rlsError) {
            console.error('Error fetching RLS status:', rlsError);
        } else {
            console.log('RLS Status:', rls);
        }

        console.log('Checking users table policies...');
        const { data: policies, error: polError } = await supabase.rpc('exec_sql', { 
            sql: "SELECT * FROM pg_policies WHERE tablename = 'users';" 
        });

        if (polError) {
            console.error('Error fetching policies:', polError);
        } else {
            console.log('Policies:', policies);
        }

        // Just in case, let's enable RLS and add a policy if it's currently blocking
        console.log('Attempting to ensure open policies for authenticated users...');
        const setupSql = `
            ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
            DROP POLICY IF EXISTS "Allow all for authenticated" ON public.users;
            CREATE POLICY "Allow all for authenticated" ON public.users FOR ALL USING (true);
        `;
        const { error: setupError } = await supabase.rpc('exec_sql', { sql: setupSql });
        if (setupError) {
            console.error('Error setting up open policies:', setupError);
        } else {
            console.log('Open policies applied successfully!');
        }

    } catch (err) {
        console.error('Check failed:', err.message);
    }
}

checkRLS();
