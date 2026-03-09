import fs from 'fs';
import Papa from 'papaparse';

const fileContent = fs.readFileSync('data.csv', 'utf-8');

const { data, errors } = Papa.parse(fileContent, {
    header: true,
    skipEmptyLines: true,
});

if (errors.length) {
    console.error('Errors parsing CSV:', errors);
}

const contacts = data.map((row) => {
    // 주민번호 example: 610221*******
    const jumin = row['주민번호'] || '';
    let ageGroup = '알 수 없음';
    let gender = '알 수 없음';

    if (jumin.length >= 7) {
        const yearPrefix = parseInt(jumin.charAt(6), 10) <= 2 ? 1900 : parseInt(jumin.charAt(6), 10) <= 4 ? 2000 : 1900;
        const year = yearPrefix + parseInt(jumin.substring(0, 2), 10);
        const currentYear = new Date().getFullYear();
        const age = currentYear - year;

        if (age < 20) ageGroup = '10대 이하';
        else if (age < 30) ageGroup = '20대';
        else if (age < 40) ageGroup = '30대';
        else if (age < 50) ageGroup = '40대';
        else if (age < 60) ageGroup = '50대';
        else if (age < 70) ageGroup = '60대';
        else ageGroup = '70대 이상';

        const genderDigit = parseInt(jumin.charAt(6), 10);
        if (genderDigit === 1 || genderDigit === 3 || genderDigit === 5 || genderDigit === 7) gender = '남성';
        else if (genderDigit === 2 || genderDigit === 4 || genderDigit === 6 || genderDigit === 8) gender = '여성';
    }

    return {
        id: row['당원번호'] || Math.random().toString(36).substr(2, 9),
        name: row['당원명'] || '이름 없음',
        phone: row['휴대폰번호'] || row['전화번호'] || '전화번호 없음',
        ageGroup,
        gender,
        region: row['행정동'] || row['시도당'] || '지역 없음',
        address: row['도로명주소'] || '',
        assignedTo: row['담당 작업자'] ? row['담당 작업자'] : null,
        status: row['할당 상태'] === '완료' ? 'CALLED' : 'PENDING',
        surveyResult: row['지지 성향'] || null,
        notes: row['통화 메모'] || '',
        rawDetails: {
            당원구분: row['당원구분'],
            당원분류: row['당원분류'],
            지역위원회: row['지역위원회'],
            입당일자: row['입당일자']
        }
    };
});

fs.mkdirSync('src/data', { recursive: true });
fs.writeFileSync('src/data/contacts.json', JSON.stringify(contacts, null, 2));
console.log(`Saved ${contacts.length} contacts to src/data/contacts.json`);
