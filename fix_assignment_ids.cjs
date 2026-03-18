const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runFix() {
    console.log('--- Starting Contact Assignment Fix ---');

    // 1. Specific Fix for 장선영 (tjdwns05280303)
    const oldId = 'Da4h0xTvDCfMgqZqPecK13KHI5y2'; // Associated with tjdwns05280404@gmail.com
    const newId = 'e6a0ccbc-88b0-407c-ba62-acdd8a54c4ec'; // Current Supabase UUID for tjdwns05280303@gmail.com

    console.log(`Fixing 장선영: Moving assignments from ${oldId} to ${newId}...`);

    const { count, error: updateError } = await supabase
        .from('contacts')
        .update({ assigned_to: newId })
        .eq('assigned_to', oldId);

    if (updateError) {
        console.error('Error updating contacts for 장선영:', updateError.message);
    } else {
        console.log(`Successfully updated ${count || 0} contacts for 장선영.`);
    }

    // Update user record name to "장선영" if it's currently different
    const { error: userUpdateError } = await supabase
        .from('users')
        .update({ name: '장선영' })
        .eq('id', newId);
    
    if (userUpdateError) {
        console.error('Error updating user name:', userUpdateError.message);
    } else {
        console.log('User name updated to 장선영.');
    }

    // 2. Scan for other non-UUID assignments
    console.log('Scanning for other non-UUID assignments...');
    const { data: allContacts, error: fetchError } = await supabase
        .from('contacts')
        .select('id, assigned_to')
        .not('assigned_to', 'is', null);

    if (fetchError) {
        console.error('Error fetching contacts:', fetchError.message);
        return;
    }

    const nonUUIDMap = new Map();
    allContacts.forEach(c => {
        if (c.assigned_to && !c.assigned_to.includes('-')) {
            const count = nonUUIDMap.get(c.assigned_to) || 0;
            nonUUIDMap.set(c.assigned_to, count + 1);
        }
    });

    if (nonUUIDMap.size === 0) {
        console.log('No other non-UUID assignments found.');
    } else {
        for (const [id, count] of nonUUIDMap.entries()) {
            console.log(`Found ${count} contacts assigned to non-UUID ID: ${id}`);
            
            // Try to find the user in our users table
            const { data: user } = await supabase.from('users').select('email, name').eq('id', id).maybeSingle();
            if (user) {
                console.log(`  Target user email: ${user.email}, Name: ${user.name}`);
                // Try to find if this user has a UUID profile now
                const { data: newUser } = await supabase.from('users').select('id').ilike('email', user.email).not('id', 'eq', id).maybeSingle();
                if (newUser) {
                    console.log(`  Found matching UUID profile: ${newUser.id}. Repairing...`);
                    const { count: repairedCount } = await supabase.from('contacts').update({ assigned_to: newUser.id }).eq('assigned_to', id);
                    console.log(`  Repaired ${repairedCount} contacts.`);
                } else {
                    console.log(`  User ${user.email} has no UUID profile yet. They need to log in first.`);
                }
            } else {
                console.log(`  ID ${id} is missing from users table.`);
            }
        }
    }

    console.log('--- Fix Complete ---');
}

runFix();
