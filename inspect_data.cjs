const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function inspectData() {
    console.log('--- Inspecting Users ---');
    const { data: users, error: userError } = await supabase
        .from('users')
        .select('id, email, name, role');
    
    if (userError) {
        console.error('Error fetching users:', userError.message);
    } else {
        console.table(users.slice(0, 10));
        console.log(`Total users: ${users.length}`);
    }

    console.log('\n--- Checking Mismatches ---');
    const { data: mismatch1 } = await supabase
        .from('contacts')
        .select('id')
        .eq('status', 'UNASSIGNED')
        .not('assigned_to', 'is', null);
    console.log(`Status UNASSIGNED but has assigned_to: ${mismatch1?.length || 0}`);

    const { data: mismatch2 } = await supabase
        .from('contacts')
        .select('id')
        .neq('status', 'UNASSIGNED')
        .is('assigned_to', null);
    console.log(`Status NOT UNASSIGNED but assigned_to is NULL: ${mismatch2?.length || 0}`);

    console.log('\n--- Support Level Sample ---');
    const { data: supportSample } = await supabase
        .from('contacts')
        .select('support_level')
        .not('support_level', 'is', null)
        .limit(5);
    console.log('Support Levels found:', supportSample.map(c => c.support_level));
}

inspectData();
