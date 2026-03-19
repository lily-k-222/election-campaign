const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verify() {
    console.log('--- Verifying ID Alignment ---');
    
    // 1. Get all users
    const { data: users, error: userError } = await supabase.from('users').select('id, email, name');
    if (userError) {
        console.error('User fetch error:', userError);
        return;
    }
    
    const userIds = new Set(users.map(u => u.id));
    const userEmails = users.map(u => u.email);
    console.log(`User IDs in DB: ${users.length}`);
    console.log('Sample User IDs:', users.slice(0, 3).map(u => u.id));

    // 2. Get distinct assigned_to from contacts
    const { data: assignedIds, error: contactError } = await supabase
        .from('contacts')
        .select('assigned_to')
        .not('assigned_to', 'is', null);
    
    if (contactError) {
        console.error('Contact fetch error:', contactError);
        return;
    }

    const distinctAssigned = [...new Set(assignedIds.map(c => c.assigned_to))];
    console.log(`Distinct assigned_to IDs in contacts: ${distinctAssigned.length}`);
    
    const mismatches = distinctAssigned.filter(id => !userIds.has(id));
    console.log(`Mismatched IDs (assigned in contacts but not in users table): ${mismatches.length}`);
    if (mismatches.length > 0) {
        console.log('Mismatched Samples:', mismatches.slice(0, 10));
    }

    // 3. Check for auth.users if possible (admin only)
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    if (!authError) {
        const authIds = new Set(authUsers.users.map(u => u.id));
        const authMismatches = Array.from(userIds).filter(id => !authIds.has(id));
        console.log(`User table IDs not in Auth: ${authMismatches.length}`);
        if (authMismatches.length > 0) {
            console.log('Table-only ID Samples (Old IDs?):', authMismatches.slice(0, 5));
        }
    }
}

verify();
