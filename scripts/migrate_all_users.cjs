
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateAll() {
    console.log('--- Starting Comprehensive User Migration ---');
    
    try {
        // 1. Get all users from Supabase Auth
        const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers();
        if (authError) throw authError;
        console.log(`Found ${authUsers.length} users in Supabase Auth.`);

        // 2. Get all users from our 'users' table
        const { data: dbUsers, error: dbError } = await supabase.from('users').select('*');
        if (dbError) throw dbError;
        console.log(`Found ${dbUsers.length} users in 'users' table.`);

        for (const authUser of authUsers) {
            const email = authUser.email.toLowerCase();
            const supabaseId = authUser.id;
            
            // Check if there's a user in our DB with this email but different ID
            const matchingDbUser = dbUsers.find(u => u.email.toLowerCase() === email);
            
            if (matchingDbUser) {
                if (matchingDbUser.id !== supabaseId) {
                    const oldId = matchingDbUser.id;
                    console.log(`Migrating: ${email} | Old ID: ${oldId} -> New ID: ${supabaseId}`);
                    
                    // Update user ID in 'users' table
                    // Note: We can't update the primary key directly if it has foreign key constraints without cascading.
                    // Let's check if 'contacts' references it.
                    
                    // Since we want to update the ID, and 'id' is likely the PK, 
                    // we might need to insert a new record and delete old one, or update if no constraints.
                    // But if it's the same record, we can try to update it.
                    
                    const { error: updateError } = await supabase
                        .from('users')
                        .update({ id: supabaseId })
                        .eq('email', email);

                    if (updateError) {
                        console.error(`  Failed to update user record for ${email}:`, updateError.message);
                        // If update fails (likely due to PK constraint or existing record), 
                        // we might need to be more careful. 
                        // If a record with supabaseId already exists, we should merge or delete the old one.
                        const { data: existingNewId } = await supabase.from('users').select('*').eq('id', supabaseId).maybeSingle();
                        if (existingNewId) {
                            console.log(`  Record with new ID already exists for ${existingNewId.email}. Deleting old record ${oldId}.`);
                            await supabase.from('users').delete().eq('id', oldId);
                        }
                    } else {
                        console.log(`  Successfully updated user record.`);
                    }

                    // Update 'contacts' table to point to the new ID
                    const { count: updatedContacts, error: contactError } = await supabase
                        .from('contacts')
                        .update({ assigned_to: supabaseId })
                        .eq('assigned_to', oldId);
                    
                    if (contactError) {
                        console.error(`  Failed to update contacts for ${email}:`, contactError.message);
                    } else {
                        console.log(`  Updated ${updatedContacts} contact assignments.`);
                    }
                } else {
                    console.log(`Skipping: ${email} | ID already matches Supabase ID.`);
                }
            } else {
                console.log(`No record in 'users' table for Auth user: ${email}. The frontend will create it upon login.`);
            }
        }

        // 3. Final Check: Find any contacts assigned to IDs that don't exist in 'users'
        const { data: currentUsers } = await supabase.from('users').select('id');
        const validUserIds = new Set(currentUsers.map(u => u.id));
        
        const { data: orphanContacts } = await supabase.from('contacts').select('assigned_to').not('assigned_to', 'is', null);
        const orphanIds = [...new Set(orphanContacts.map(c => c.assigned_to).filter(id => !validUserIds.has(id)))];
        
        if (orphanIds.length > 0) {
            console.log('\n--- Orphaned Contact Assignments Found ---');
            for (const oid of orphanIds) {
                console.log(`  ID: ${oid} has assignments but no user record.`);
            }
        }

        console.log('\n--- Migration Complete ---');
    } catch (err) {
        console.error('Migration failed:', err);
    }
}

migrateAll();
