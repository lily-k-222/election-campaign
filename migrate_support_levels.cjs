const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase credentials in .env file.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrate() {
    console.log('Starting migration: 다른후보 지지 -> 지지하지 않음');
    
    // We check for both versions with and without space just in case
    const categoriesToMigrate = ['다른후보 지지', '다른후보지지'];
    
    try {
        const { data: contacts, error: fetchError } = await supabase
            .from('contacts')
            .select('id, support_level')
            .in('support_level', categoriesToMigrate);
            
        if (fetchError) throw fetchError;
        
        if (!contacts || contacts.length === 0) {
            console.log('No records found that need migration.');
            return;
        }
        
        console.log(`Found ${contacts.length} records to migrate.`);
        const ids = contacts.map(c => c.id);
        
        const { error: updateError } = await supabase
            .from('contacts')
            .update({ support_level: '지지하지 않음' })
            .in('id', ids);
            
        if (updateError) throw updateError;
        
        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err.message);
    }
}

migrate();
