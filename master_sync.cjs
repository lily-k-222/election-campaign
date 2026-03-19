const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function masterSync() {
    console.log('--- Master Sync: Aligning All IDs ---');
    
    try {
        // 1. Get all users from Auth
        const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers();
        if (authError) throw authError;
        console.log(`Found ${authUsers.length} users in Auth.`);

        // 2. Get all users from DB
        const { data: dbUsers, error: dbError } = await supabase.from('users').select('*');
        if (dbError) throw dbError;

        for (const authUser of authUsers) {
            const dbUser = dbUsers.find(u => u.email.toLowerCase() === authUser.email.toLowerCase());
            
            if (dbUser && dbUser.id !== authUser.id) {
                const oldId = dbUser.id;
                console.log(`\nSyncing User: ${dbUser.email}`);
                console.log(`  - Changing ID: ${oldId} -> ${authUser.id}`);

                // Update users table
                const { error: userUpdErr } = await supabase
                    .from('users')
                    .update({ id: authUser.id })
                    .eq('email', dbUser.email);
                
                if (userUpdErr) {
                    console.error(`  - Failed to update users table: ${userUpdErr.message}`);
                    continue;
                }

                // Update contacts table
                const { error: contactUpdErr } = await supabase
                    .from('contacts')
                    .update({ assigned_to: authUser.id })
                    .eq('assigned_to', oldId);
                
                if (contactUpdErr) {
                    console.error(`  - Failed to update contacts table: ${contactUpdErr.message}`);
                } else {
                    console.log(`  - Successfully synced contacts.`);
                }
            }
        }
        
        console.log('\n--- Sync Complete ---');
        
    } catch (err) {
        console.error('Master Sync failed:', err.message);
    }
}

masterSync();
