const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function migrateUsers() {
    try {
        console.log('--- User Migration: Firestore -> Supabase ---');
        console.log('Fetching users from Firestore...');
        
        const snapshot = await getDocs(collection(db, 'users'));
        const users = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            // Ensure we don't migrate the internal/mock 'u4' etc if not needed, 
            // but usually we want all real users who have an email.
            if (data.email) {
                users.push({
                    id: doc.id,
                    email: data.email,
                    name: data.name || '이름 없음',
                    role: data.role || 'UNAUTHORIZED'
                });
            }
        });

        if (users.length === 0) {
            console.log('No users found in Firestore to migrate.');
            return;
        }

        console.log(`Found ${users.length} users. Migrating to Supabase...`);

        const { data, error } = await supabase
            .from('users')
            .upsert(users, { onConflict: 'id' });

        if (error) {
            throw error;
        }

        console.log('Success! All users have been migrated to Supabase.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exit(1);
    }
}

migrateUsers();
