const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkDesync() {
    console.log('--- Checking for ID Desync between Users and Contacts ---');
    
    // 1. Get all users and their emails
    const { data: users, error: userError } = await supabase.from('users').select('id, email, name');
    if (userError) return console.error(userError);

    // 2. Get all contacts with non-null assignments
    const { data: contacts, error: contactError } = await supabase.from('contacts').select('id, assigned_to');
    if (contactError) return console.error(contactError);

    const userMap = {}; 
    users.forEach(u => { userMap[u.id] = u; });

    const desyncedAssignments = [];
    contacts.forEach(c => {
        if (c.assigned_to && !userMap[c.assigned_to]) {
            // Found a contact assigned to an ID that is no longer in the users table!
            desyncedAssignments.push(c);
        }
    });

    console.log(`Total Contacts: ${contacts.length}`);
    console.log(`Contacts with non-existent assigned_to: ${desyncedAssignments.length}`);
    
    if (desyncedAssignments.length > 0) {
        const uniqueMissingIds = [...new Set(desyncedAssignments.map(c => c.assigned_to))];
        console.log('Missing IDs found in contacts table:', uniqueMissingIds);
        
        // Check if any of these missing IDs match an old ID format of a current user
        // (We can't easily know old IDs unless we find them by email)
        // Wait, if they are missing from userMap, it means they are NOT the current ID.
        // Let's see if we can find these users by email if we had their old IDs.
        // Actually, we can check if some users have NO contacts assigned to their CURRENT ID.
        
        console.log('\n--- Checking Users with 0 assignments (potential desync) ---');
        users.forEach(u => {
            const count = contacts.filter(c => c.assigned_to === u.id).length;
            if (count === 0) {
                // This user has no contacts assigned to their CURRENT ID. 
                // Do they have contacts assigned to some OTHER ID that might be their old one?
                // This is hard to know without historical data.
            } else {
                console.log(`User ${u.name} (${u.email}) has ${count} contacts.`);
            }
        });
    }
}

checkDesync();
