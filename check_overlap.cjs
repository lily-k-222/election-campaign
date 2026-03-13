
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOverlap() {
    const id1 = 'evJH0SJDomMjqEmmcwFkzPH8VoC2'; // 장선영2222 (0303)
    const id2 = 'Da4h0xTvDCfMgqZqPecK13KHI5y2'; // 장선영0404 (0404)
    
    console.log(`Checking overlap between ${id1} and ${id2}`);
    
    const { data: c1 } = await supabase.from('contacts').select('id').eq('assigned_to', id1);
    const { data: c2 } = await supabase.from('contacts').select('id').eq('assigned_to', id2);
    
    const set1 = new Set(c1.map(c => c.id));
    const set2 = new Set(c2.map(c => c.id));
    
    const intersection = [...set1].filter(x => set2.has(x));
    
    console.log(`User 1 has ${set1.size} contacts.`);
    console.log(`User 2 has ${set2.size} contacts.`);
    console.log(`Overlap count: ${intersection.length}`);
    
    if (intersection.length > 0) {
        console.log('Sample overlapping IDs:', intersection.slice(0, 5));
    }
}

checkOverlap();
