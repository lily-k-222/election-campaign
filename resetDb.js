import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, writeBatch, doc } from "firebase/firestore";

import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

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

const resetDB = async () => {
  try {
    console.log("Starting DB Reset...");
    const contactsRef = collection(db, 'contacts');
    const snap = await getDocs(contactsRef);
    
    // Delete existing contacts in chunks of 400
    let count = 0;
    for (let i = 0; i < snap.docs.length; i += 400) {
        const chunk = snap.docs.slice(i, i + 400);
        const deleteBatch = writeBatch(db);
        chunk.forEach(docSnap => {
            deleteBatch.delete(docSnap.ref);
            count++;
        });
        await deleteBatch.commit();
        console.log(`Deleted chunk of ${chunk.length} contacts...`);
    }
    console.log(`Deleted total ${count} existing contacts.`);

    // Add 1000 dummy contacts in chunks of 400
    console.log(`Adding 1000 new test contacts...`);
    for (let i = 0; i < 1000; i += 400) {
        const addBatch = writeBatch(db);
        const end = Math.min(i + 400, 1000);
        
        for (let j = i + 1; j <= end; j++) {
            const newId = `test_c_${Date.now()}_${j}`;
            const docRef = doc(db, 'contacts', newId);
            addBatch.set(docRef, {
                id: newId,
                name: `테스트당원 ${j}`,
                age: `${20 + (j % 5)*10}대`,
                memberType: j % 2 === 0 ? '권리당원' : '일반당원',
                region: `테스트동 ${j%10 + 1}구`,
                phone: `010-1234-1234`,
                status: 'UNASSIGNED',
                surveyResult: null,
                supportLevel: null,
                notes: '테스트용 데이터입니다.',
                assignedTo: null
            });
        }
        await addBatch.commit();
        console.log(`Added chunk of ${end - i} test contacts...`);
    }

    console.log("Success! DB has been reset with 1000 test contacts.");
    process.exit(0);
  } catch (err) {
    console.error("Error resetting DB:", err);
    process.exit(1);
  }
};

resetDB();
