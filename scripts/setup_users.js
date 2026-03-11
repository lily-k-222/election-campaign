import { createClient } from '@supabase/supabase-js';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupUsersTable() {
    const sql = `
        CREATE TABLE IF NOT EXISTS public.users (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'UNAUTHORIZED'
        );

        -- Optional RLS if needed, but we keep it open for authenticated frontend 
        -- or entirely bypass it via service role
        -- ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
        -- DROP POLICY IF EXISTS "Allow authenticated" ON public.users;
        -- CREATE POLICY "Allow authenticated" ON public.users FOR ALL USING (true) WITH CHECK (true);
    `;

    const { error } = await supabase.rpc('exec_sql', { sql });
    if (error) {
        console.error("Error creating users table:", error.message);
        // Fallback or handle error
    } else {
        console.log("Users table setup completed in Supabase!");
    }
}

setupUsersTable();
