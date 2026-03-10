import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, writeBatch, doc } from "firebase/firestore";
import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';
import csvParser from 'csv-parser';
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

const RAW_DATA_DIR = path.join(__dirname, '..', 'data', 'raw_contacts');
const contactsMap = new Map(); // phone -> contact object

// Helper: Normalize phone
function normalizePhone(str) {
    if (!str) return null;
    let digits = String(str).replace(/\D/g, '');
    if (digits.startsWith('82')) digits = '0' + digits.substring(2);
    
    // Check for Excel dropping the leading zero (e.g., 1012345678)
    if (digits.length === 10 && digits.startsWith('10')) {
        digits = '0' + digits;
    }
    
    if (!digits.startsWith('010')) return null; 
    
    // If it's exactly 11 digits:
    if (digits.length === 11) {
        return `${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7)}`;
    } else if (digits.length === 10) {
        return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`;
    }
    return null;
}

// Helper: Extract Year from Filename
function extractYear(filename) {
    const match = filename.match(/20\d{2}/);
    if (match) return parseInt(match[0], 10);
    return 2024; // Default if not found
}

// Helper: Determine File Type Flags
function getFileFlags(filename, sheetName = '') {
    const combined = `${filename} ${sheetName}`.toLowerCase();
    const isRightsMember = combined.includes('권리');
    const isPartyFile = combined.includes('당원');
    return {
        memberType: isPartyFile ? (isRightsMember ? '권리당원' : '일반당원') : null
    };
}

// Helper: Combine Notes
function appendNote(existingNotes, newNote) {
    if (!newNote) return existingNotes;
    if (!existingNotes || existingNotes === '테스트용 데이터입니다.') return newNote;
    if (existingNotes.includes(newNote)) return existingNotes;
    return `${existingNotes}\n${newNote}`;
}

// Parse CSV
function parseCSV(filePath) {
    return new Promise((resolve) => {
        const results = [];
        fs.createReadStream(filePath)
            .pipe(csvParser())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results));
    });
}

// Standardize Row to generic object
function standardizeRow(row) {
    const values = Object.values(row).map(v => typeof v === 'string' ? v.trim() : v);
    const keys = Object.keys(row).map(k => k.trim().toLowerCase());
    
    let name = '';
    let phone = '';
    let title = '';
    let region = '';
    let note = '';

    keys.forEach((key, index) => {
        const val = values[index];
        if (!val) return;

        if (key.includes('성명') || key.includes('이름') || key === '명' || key.includes('당원명')) name = val;
        else if (key.includes('연락처') || key.includes('전화') || key.includes('폰')) phone = val;
        else if (key.includes('직위') || key.includes('직함') || key.includes('구분') || key.includes('유형')) {
            title = title ? `${title} / ${val}` : val;
        }
        else if (key.includes('읍면') || key.includes('주소') || key.includes('거주지') || key.includes('행정동')) {
            region = region ? `${region} ${val}` : val;
        }
        else if (key.includes('비고') || key.includes('메모') || key.includes('시도당') || key.includes('위원회')) note = note ? `${note} / ${val}` : val;
    });

    // Fallback if headers are missing but values look like them
    if (!phone) {
        values.forEach(v => {
            const strV = String(v);
            if ((strV.includes('-') && /\d/.test(strV)) || strV.startsWith('010')) {
                phone = strV;
            }
        });
    }

    return { name, phone, title, region, note };
}

async function processFiles() {
    console.log("Reading raw files...");
    const files = fs.readdirSync(RAW_DATA_DIR);
    
    for (const file of files) {
        const filePath = path.join(RAW_DATA_DIR, file);
        const ext = path.extname(file).toLowerCase();
        const year = extractYear(file);

        let rows = [];
        if (ext === '.csv') {
            const csvRows = await parseCSV(filePath);
            csvRows.forEach(r => r._sheetName = 'CSV');
            rows = csvRows;
        } else if (ext === '.xlsx' || ext === '.xls') {
            const workbook = xlsx.readFile(filePath);
            workbook.SheetNames.forEach(sheetName => {
                const sheetRows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
                sheetRows.forEach(r => r._sheetName = sheetName);
                rows = rows.concat(sheetRows);
            });
        } else {
            continue;
        }

        console.log(`Processing ${file} (${rows.length} rows) - Year: ${year}`);

        for (const row of rows) {
            const { memberType } = getFileFlags(file, row._sheetName);
            const standardized = standardizeRow(row);
            const phone = normalizePhone(standardized.phone);
            if (!phone) continue;

            if (!contactsMap.has(phone)) {
                contactsMap.set(phone, {
                    phone,
                    name: standardized.name || '이름 없음',
                    region: standardized.region || '',
                    title: standardized.title || '',
                    memberType: memberType || '일반구민',
                    latestYear: year,
                    notes: standardized.note ? standardized.note : '',
                    sourceFiles: [`${file}(${row._sheetName})`]
                });
            } else {
                const existing = contactsMap.get(phone);
                
                // Update Name if missing
                if (existing.name === '이름 없음' && standardized.name) existing.name = standardized.name;
                
                // Update Region if missing
                if (!existing.region && standardized.region) existing.region = standardized.region;

                // Member Type Priority: 권리당원 > 일반당원 > 일반구민
                if (memberType === '권리당원') existing.memberType = '권리당원';
                else if (memberType === '일반당원' && existing.memberType === '일반구민') existing.memberType = '일반당원';

                // Handle titles based on year
                if (standardized.title && standardized.title !== existing.title) {
                    if (!existing.title) {
                        existing.title = standardized.title;
                        existing.latestYear = year;
                    } else if (year > existing.latestYear) {
                        // Current is newer -> Move old title to notes, update to new
                        existing.notes = appendNote(existing.notes, `과거 직함(${existing.latestYear}): ${existing.title}`);
                        existing.title = standardized.title;
                        existing.latestYear = year;
                    } else if (year < existing.latestYear) {
                        // Current is older -> Add this older title to notes directly
                        existing.notes = appendNote(existing.notes, `과거 직함(${year}): ${standardized.title}`);
                    } else { // year === existing.latestYear
                        if (!existing.title.includes(standardized.title)) {
                            existing.title = `${existing.title} / ${standardized.title}`;
                        }
                    }
                }

                // Append any extra notes
                if (standardized.note) {
                    existing.notes = appendNote(existing.notes, standardized.note);
                }

                const sourceKey = `${file}(${row._sheetName})`;
                if (!existing.sourceFiles.includes(sourceKey)) {
                    existing.sourceFiles.push(sourceKey);
                }
            }
        }
    }

    const mergedContacts = Array.from(contactsMap.values());
    console.log(`Merged down to ${mergedContacts.length} unique contacts based on phone numbers.`);
    
    // Push defaults and generate Firestore IDs
    const finalContacts = mergedContacts.map((c, i) => {
        const docId = `contact_raw_${Date.now()}_${i}`;
        
        // Final note combination involving title if they have one but we want it visible
        return {
            id: docId,
            name: c.name,
            phone: c.phone,
            age: '', // Derived if possible, else empty
            jobTitle: c.title || '', // Added explicitly
            memberType: c.memberType,
            region: c.region,
            status: 'UNASSIGNED',
            surveyResult: null,
            supportLevel: null,
            assignedTo: null,
            notes: c.notes || '' // Removed title prefix from notes as it's now in jobTitle
        };
    });

    const outputPath = path.join(__dirname, '..', 'src', 'data', 'contacts.json');
    fs.writeFileSync(outputPath, JSON.stringify(finalContacts, null, 2));
    console.log(`✨ All ${finalContacts.length} merged contacts have been written to src/data/contacts.json!`);
    process.exit(0);
}

processFiles().catch(err => {
    console.error(err);
    process.exit(1);
});
