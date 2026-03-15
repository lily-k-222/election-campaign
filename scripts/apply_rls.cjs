const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyRLS() {
    const sql = `
        -- 1. Enable RLS on all tables
        ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

        -- 2. Drop existing policies to avoid conflicts
        DROP POLICY IF EXISTS "Users can read their own profile" ON public.users;
        DROP POLICY IF EXISTS "Admins can read all profiles" ON public.users;
        DROP POLICY IF EXISTS "Admins can update all profiles" ON public.users;
        DROP POLICY IF EXISTS "Allow all for authenticated" ON public.users;
        
        DROP POLICY IF EXISTS "Volunteers can read assigned contacts" ON public.contacts;
        DROP POLICY IF EXISTS "Volunteers can update assigned contacts" ON public.contacts;
        DROP POLICY IF EXISTS "Admins can do everything on contacts" ON public.contacts;
        
        DROP POLICY IF EXISTS "Public read for settings" ON public.settings;
        DROP POLICY IF EXISTS "Admin write for settings" ON public.settings;
        
        DROP POLICY IF EXISTS "Public read for announcements" ON public.announcements;
        DROP POLICY IF EXISTS "Admin write for announcements" ON public.announcements;

        -- 3. Define new policies
        -- users: Users read own, Admins read/update all
        CREATE POLICY "Users can read their own profile" ON public.users FOR SELECT USING (auth.uid()::text = id OR (auth.jwt() ->> 'email' = email));
        CREATE POLICY "Users can update their own profile during migration" ON public.users FOR UPDATE 
            USING (auth.jwt() ->> 'email' = email)
            WITH CHECK (auth.jwt() ->> 'email' = email);
            
        CREATE POLICY "Admins can read all profiles" ON public.users FOR SELECT USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid()::text AND role IN ('ADMIN', 'DEVELOPER')));
        CREATE POLICY "Admins can update all profiles" ON public.users FOR UPDATE USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid()::text AND role IN ('ADMIN', 'DEVELOPER')));

        -- contacts: Volunteers read/update assigned, Admins all
        CREATE POLICY "Volunteers can read assigned contacts" ON public.contacts FOR SELECT USING (assigned_to = auth.uid()::text);
        CREATE POLICY "Volunteers can update assigned contacts" ON public.contacts FOR UPDATE USING (assigned_to = auth.uid()::text);
        CREATE POLICY "Admins can do everything on contacts" ON public.contacts FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid()::text AND role IN ('ADMIN', 'DEVELOPER')));

        -- settings/announcements: Everyone read, Admins all
        CREATE POLICY "Public read for settings" ON public.settings FOR SELECT USING (true);
        CREATE POLICY "Admin write for settings" ON public.settings FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid()::text AND role IN ('ADMIN', 'DEVELOPER')));
        CREATE POLICY "Public read for announcements" ON public.announcements FOR SELECT USING (true);
        CREATE POLICY "Admin write for announcements" ON public.announcements FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid()::text AND role IN ('ADMIN', 'DEVELOPER')));
    `;

    try {
        console.log('Applying RLS and Policies...');
        const { error } = await supabase.rpc('exec_sql', { sql });
        if (error) {
            console.error('Error applying SQL:', error.message);
        } else {
            console.log('RLS and Policies applied successfully!');
        }
    } catch (err) {
        console.error('Operation failed:', err.message);
    }
}

applyRLS();
