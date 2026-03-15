
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role for admin access

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUsers() {
    const userNames = ['이왕재', '윤여진'];
    console.log(`Checking users: ${userNames.join(', ')}`);
    
    for (const name of userNames) {
        console.log(`\n--- Searching for: ${name} ---`);
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .ilike('name', `%${name}%`);
            
        if (error) {
            console.error(`Error fetching user ${name}:`, error);
            continue;
        }
        
        if (data && data.length > 0) {
            console.log(`Found ${data.length} user(s):`);
            console.log(JSON.stringify(data, null, 2));
            
            for (const user of data) {
                // Check if they have contacts
                const { count, error: contactError } = await supabase
                    .from('contacts')
                    .select('*', { count: 'exact', head: true })
                    .eq('assigned_to', user.id);
                
                if (contactError) {
                    console.error(`Error checking contacts for ${user.name}:`, contactError);
                } else {
                    console.log(`User ${user.name} (${user.id}) has ${count} contacts assigned.`);
                }
            }
        } else {
            console.log(`No user found with name containing "${name}".`);
        }
    }
}

checkUsers();
