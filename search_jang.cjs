
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function searchJang() {
    console.log('Searching for users named like "장선영"');
    
    const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .ilike('name', '%장선영%');
        
    if (error) {
        console.error('Error:', error);
        return;
    }
    
    console.log('--- Found Users ---');
    console.log(JSON.stringify(users, null, 2));

    for (const user of users) {
        const { count } = await supabase
            .from('contacts')
            .select('*', { count: 'exact', head: true })
            .eq('assigned_to', user.id);
        
         const { count: calledCount } = await supabase
            .from('contacts')
            .select('*', { count: 'exact', head: true })
            .eq('assigned_to', user.id)
            .eq('status', 'CALLED');
            
        console.log(`User ${user.id}: Name="${user.name}", Email="${user.email}", Assigned=${count}, Called=${calledCount}`);
    }
}

searchJang();
