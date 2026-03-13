
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log('--- Database Status Check ---');
    console.log(`URL: ${supabaseUrl}`);
    
    // Check users
    const { count: userCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
    console.log(`Table 'users': ${userCount} rows`);

    // Check contacts
    const { count: contactCount } = await supabase.from('contacts').select('*', { count: 'exact', head: true });
    console.log(`Table 'contacts': ${contactCount} rows`);

    // Check for other potential tables
    // Since we can't easily list tables via client without RPC, let's guess common names or check if some specific columns exist
    
    if (contactCount > 0) {
        const { data: samples } = await supabase.from('contacts').select('*').limit(1);
        console.log('--- Contacts Column Sample ---');
        if (samples && samples.length > 0) {
            console.log(Object.keys(samples[0]));
            console.log('First Row Sample:', samples[0]);
        }
    }
}

checkSchema();
