import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrateData() {
    try {
        const contactsPath = path.join(__dirname, '../src/data/contacts.json');
        const contactsData = JSON.parse(fs.readFileSync(contactsPath, 'utf8'));

        console.log(`Starting migration of ${contactsData.length} contacts to Supabase...`);

        // Chunking to avoid large request payload limits
        const chunkSize = 200;
        for (let i = 0; i < contactsData.length; i += chunkSize) {
            const chunk = contactsData.slice(i, i + chunkSize).map(c => ({
                id: c.id,
                name: c.name,
                phone: c.phone,
                region: c.region,
                job_title: c.jobTitle,
                member_type: c.memberType,
                status: c.status || 'UNASSIGNED',
                survey_result: c.surveyResult || null,
                notes: c.notes || '',
                assigned_to: (c.assignedTo === 'UNASSIGNED' || !c.assignedTo) ? null : c.assignedTo
            }));

            const { error } = await supabase
                .from('contacts')
                .upsert(chunk, { onConflict: 'id' });

            if (error) {
                console.error(`Error migrating chunk starting at ${i}:`, error.message);
            } else {
                console.log(`Migrated ${Math.min(i + chunkSize, contactsData.length)}/${contactsData.length} contacts.`);
            }
        }

        console.log('Migration completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error.message);
    }
}

migrateData();
