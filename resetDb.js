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
    
    // Delete existing
    const deleteBatch = writeBatch(db);
    let count = 0;
    snap.docs.forEach(docSnap => {
        deleteBatch.delete(docSnap.ref);
        count++;
    });
    console.log(`Deleting ${count} existing contacts...`);
    await deleteBatch.commit();
    console.log("Deleted existing contacts.");

    // Add 30 dummy
    const addBatch = writeBatch(db);
    for (let i = 1; i <= 30; i++) {
        const newId = `test_c_${Date.now()}_${i}`;
        const docRef = doc(db, 'contacts', newId);
        addBatch.set(docRef, {
            id: newId,
            name: `테스트당원 ${i}`,
            age: `${20 + (i % 5)*10}대`,
            memberType: i % 2 === 0 ? '권리당원' : '일반당원',
            region: `테스트동 ${i}구`,
            phone: `010-1234-1234`, // requested by user
            status: 'UNASSIGNED',
            surveyResult: null,
            supportLevel: null,
            notes: '테스트용 데이터입니다.',
            assignedTo: null
        });
    }
    console.log(`Adding 30 new test contacts...`);
    await addBatch.commit();
    console.log("Success! DB has been reset with 30 test contacts.");
    process.exit(0);
  } catch (err) {
    console.error("Error resetting DB:", err);
    process.exit(1);
  }
};

resetDB();
