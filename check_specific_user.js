
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUser() {
    const email = 'yeojeany@gmail.com';
    console.log(`Checking user: ${email}`);
    
    // Case insensitive check just in case
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .ilike('email', email);
        
    if (error) {
        console.error('Error fetching user:', error);
        return;
    }
    
    if (data && data.length > 0) {
        console.log('Found user(s):');
        console.log(JSON.stringify(data, null, 2));
    } else {
        console.log('No user found with that email.');
    }
}

checkUser();
