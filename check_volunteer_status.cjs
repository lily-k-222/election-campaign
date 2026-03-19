const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
    const email = 'tjdwns05280303@gmail.com'; // 장선영2222
    console.log(`--- Checking User: ${email} ---`);
    
    // 1. Auth check
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
    const authUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (authUser) {
        console.log(`Auth User Found! ID: ${authUser.id}`);
    } else {
        console.log('Auth User NOT FOUND. User hasn\'t signed up/logged in via Supabase yet.');
    }

    // 2. DB check
    const { data: dbUser, error: dbError } = await supabase.from('users').select('*').ilike('email', email).maybeSingle();
    if (dbUser) {
        console.log(`DB User Found! ID: ${dbUser.id}, Name: ${dbUser.name}, Role: ${dbUser.role}`);
        
        // 3. Assignment check
        const { count, error: contactError } = await supabase
            .from('contacts')
            .select('*', { count: 'exact', head: true })
            .eq('assigned_to', dbUser.id);
        console.log(`Contacts assigned to CURRENT DB ID (${dbUser.id}): ${count}`);
        
        if (authUser && authUser.id !== dbUser.id) {
            console.log(`CRITICAL: ID MISMATCH! Auth ID is ${authUser.id} but DB ID is ${dbUser.id}`);
            const { count: oldIdCount } = await supabase
                .from('contacts')
                .select('*', { count: 'exact', head: true })
                .eq('assigned_to', authUser.id);
            console.log(`Contacts assigned to AUTH ID (${authUser.id}): ${oldIdCount}`);
        }
    } else {
        console.log('DB User NOT FOUND.');
    }
}

check();
