const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAssignments() {
    console.log('--- Checking User Assignment Status ---');
    
    // 1. Get all users
    const { data: users, error: userError } = await supabase.from('users').select('id, email, name, role');
    if (userError) return console.error(userError);

    // 2. Count contacts per user in DB
    const { data: counts, error: countError } = await supabase.from('contacts').select('assigned_to');
    if (countError) return console.error(countError);

    const assignmentCounts = {};
    counts.forEach(c => {
        if (c.assigned_to) {
            assignmentCounts[c.assigned_to] = (assignmentCounts[c.assigned_to] || 0) + 1;
        }
    });

    console.log('\n--- Active Volunteers (with assignments) ---');
    users.forEach(u => {
        const count = assignmentCounts[u.id] || 0;
        if (count > 0) {
            console.log(`${u.name} (${u.email}) - ID: ${u.id} - Role: ${u.role} - Contacts: ${count}`);
        }
    });

    console.log('\n--- Assignment IDs with NO user in public.users ---');
    const userIds = new Set(users.map(u => u.id));
    Object.keys(assignmentCounts).forEach(id => {
        if (!userIds.has(id)) {
            console.log(`Missing User ID: ${id} (Assigned to ${assignmentCounts[id]} contacts)`);
        }
    });
}

checkAssignments();
