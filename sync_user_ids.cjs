const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function syncUserIDs() {
    console.log('Starting User ID Synchronization (Linking migrated accounts)...');
    
    try {
        // 1. Get all users from Auth
        const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
        if (authError) throw authError;
        
        console.log(`Found ${authData.users.length} users in Supabase Auth.`);
        
        // 2. Get all users from public.users
        const { data: dbData, error: dbError } = await supabase.from('users').select('*');
        if (dbError) throw dbError;
        
        console.log(`Found ${dbData.length} users in public.users table.`);
        
        let linkCount = 0;
        let failCount = 0;
        
        for (const authUser of authData.users) {
            const dbUser = dbData.find(u => u.email.toLowerCase() === authUser.email.toLowerCase());
            
            if (dbUser && dbUser.id !== authUser.id) {
                console.log(`Link required: ${authUser.email} (${dbUser.id} -> ${authUser.id})`);
                
                // Attempt to update the ID
                // Note: If there are foreign keys, this might fail unless CASCADE is set.
                const { error: updateError } = await supabase
                    .from('users')
                    .update({ id: authUser.id })
                    .eq('email', dbUser.email);
                
                if (updateError) {
                    console.error(`  - Failed to link ${authUser.email}:`, updateError.message);
                    failCount++;
                } else {
                    console.log(`  - Successfully linked ${authUser.email}`);
                    linkCount++;
                }
            }
        }
        
        console.log(`Synchronization Summary: ${linkCount} linked, ${failCount} failed.`);
    } catch (err) {
        console.error('Critical failure:', err.message);
    }
}

syncUserIDs();
