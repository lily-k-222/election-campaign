import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, writeBatch, doc, query, limit } from "firebase/firestore";
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Setup environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function wipeAndReseed() {
    try {
        console.log("🚀 Starting wipe and reseed process...");
        
        // 1. Read the new contacts data
        const contactsPath = path.join(__dirname, '..', 'src', 'data', 'contacts.json');
        const contactsData = JSON.parse(fs.readFileSync(contactsPath, 'utf8'));
        console.log(`📂 Read ${contactsData.length} contacts from src/data/contacts.json`);

        // 2. Wipe existing contacts
        console.log("🧹 Wiping existing contacts in Firestore...");
        let totalDeleted = 0;
        let hasMore = true;
        
        while (hasMore) {
            const q = query(collection(db, 'contacts'), limit(450));
            const snapshot = await getDocs(q);
            
            if (snapshot.empty) {
                hasMore = false;
                break;
            }

            const batch = writeBatch(db);
            snapshot.docs.forEach(docSnap => {
                batch.delete(docSnap.ref);
            });
            await batch.commit();
            totalDeleted += snapshot.size;
            console.log(`🗑️ Deleted ${totalDeleted} contacts so far...`);
            
            // Wait a bit to avoid hitting rate limits too hard if quota is tight
            await new Promise(r => setTimeout(r, 500));
        }
        console.log(`✅ Finished wiping! Total ${totalDeleted} documents removed.`);

        // 3. Reseed with new data
        console.log(`📤 Seeding ${contactsData.length} new contacts...`);
        const chunkSize = 450;
        let totalSeeded = 0;
        
        for (let i = 0; i < contactsData.length; i += chunkSize) {
            const chunk = contactsData.slice(i, i + chunkSize);
            const batch = writeBatch(db);
            
            chunk.forEach(contact => {
                const docRef = doc(db, 'contacts', contact.id);
                // Ensure no redundant nested objects if any
                batch.set(docRef, {
                    ...contact,
                    status: contact.status || 'UNASSIGNED',
                    assignedTo: contact.assignedTo || null
                });
            });
            
            await batch.commit();
            totalSeeded += chunk.length;
            console.log(`📈 Seeded ${totalSeeded}/${contactsData.length} contacts...`);
            
            // Wait a bit to avoid hitting rate limits
            await new Promise(r => setTimeout(r, 500));
        }

        console.log("✨ Firestore has been successfully reseeded with Gangjin Party Members!");
        process.exit(0);
    } catch (err) {
        console.error("❌ Error during wipe and reseed:", err);
        process.exit(1);
    }
}

wipeAndReseed();
