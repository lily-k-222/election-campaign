const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addColumn() {
    console.log('Adding fixed_at column to error_reports...');
    const { error } = await supabase.rpc('exec_sql', { 
        sql: 'ALTER TABLE public.error_reports ADD COLUMN IF NOT EXISTS fixed_at TIMESTAMPTZ;' 
    });
    if (error) console.error(error);
    else console.log('Column added successfully!');
}

addColumn();
