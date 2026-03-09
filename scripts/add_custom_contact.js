import fs from 'fs';

const filePath = 'src/data/contacts.json';
const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

data.unshift({
    id: "custom_" + Date.now(),
    name: "윤여진",
    phone: "010-3226-3872",
    ageGroup: "알 수 없음",
    gender: "알 수 없음",
    region: "알 수 없음",
    address: "",
    assignedTo: "v1", // 김민준의 ID
    status: "PENDING",
    surveyResult: null,
    notes: "",
    rawDetails: {}
});

fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
console.log('Added 윤여진 to contacts and assigned to v1 (김민준)');
