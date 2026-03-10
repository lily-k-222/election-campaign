import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RAW_DATA_DIR = path.join(__dirname, 'data', 'raw_contacts');

const files = ['강진 권리당원 명부(2025.1.).xlsx', '강진 당원명부(2025.5.).xlsx'];

files.forEach(file => {
    const filePath = path.join(RAW_DATA_DIR, file);
    try {
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" }); // defval to see all columns even if empty
        console.log(`\n\n--- File: ${file} (${rows.length} rows) ---`);
        console.log("Headers of first row:", Object.keys(rows[0]));
        console.log("First row data:", rows[0]);
    } catch (e) {
        console.error(`Error reading ${file}:`, e.message);
    }
});
