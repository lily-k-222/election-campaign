
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const emails = ['wangjaelee@gmail.com', 'yeojeany@gmail.com'];
    console.log(`Checking Supabase Auth for: ${emails.join(', ')}`);
    
    try {
        const { data: { users }, error } = await supabase.auth.admin.listUsers();
        
        if (error) {
            console.error('Admin API error:', error);
            return;
        }

        for (const email of emails) {
            const authUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
            if (authUser) {
                console.log(`Email: ${email} -> Supabase UUID: ${authUser.id}`);
            } else {
                console.log(`Email: ${email} -> No Supabase Auth user found.`);
            }
        }
    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

run();
