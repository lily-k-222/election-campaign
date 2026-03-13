
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectUsers() {
    const email = 'tjdwns05280404@gmail.com';
    console.log(`Inspecting records for: ${email}`);
    
    // Check users table
    const { data: users, error: userError } = await supabase
        .from('users')
        .select('*')
        .ilike('email', email);
        
    if (userError) {
        console.error('Error fetching users:', userError);
        return;
    }
    
    console.log('--- User Records ---');
    console.log(JSON.stringify(users, null, 2));

    if (users && users.length > 0) {
        for (const user of users) {
            // Check contacts assigned to this particular ID
            const { count, error: countError } = await supabase
                .from('contacts')
                .select('*', { count: 'exact', head: true })
                .eq('assigned_to', user.id);
            
            console.log(`User ${user.id} (${user.name}) has ${count} contacts assigned.`);
            
            // If they have contacts, maybe check some details
            if (count > 0) {
                const { data: sampleContacts } = await supabase
                    .from('contacts')
                    .select('id, name, status, notes')
                    .eq('assigned_to', user.id)
                    .limit(5);
                console.log(`Sample contacts for ${user.name}:`, sampleContacts);
            }
        }
    }
}

inspectUsers();
