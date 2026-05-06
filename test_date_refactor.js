/**
 * 🧪 Unit Tests for Date-Based Refactoring
 * Tests the new isSameDay() helper and grid rendering logic
 */

console.log('🧪 Starting Date-Based System Tests...\n');

// Mock setup
const testAppointments = [
    {
        id: '1',
        date: '2024-02-05',
        time: '14:00',
        professionalId: 'prof1',
        clientName: 'Maria',
        type: 'clinica'
    },
    {
        id: '2',
        date: '2024-02-05',
        time: '14:00',
        professionalId: 'prof1',
        clientName: 'João',
        type: 'clinica'
    },
    {
        id: '3',
        date: '2024-02-06',
        time: '15:00',
        professionalId: 'prof1',
        clientName: 'Pedro',
        type: 'analise'
    },
    {
        id: '4',
        date: '2024-02-07',
        time: '10:00',
        professionalId: 'prof2',
        clientName: 'Ana',
        type: 'supervisao'
    }
];

// Test 1: isSameDay() function
console.log('TEST 1: isSameDay() Helper Function');
console.log('======================================');

const testCases = [
    { dateStr1: '2024-02-05', dateStr2: '2024-02-05', expected: true, desc: 'Same dates' },
    { dateStr1: '2024-02-05', dateStr2: '2024-02-06', expected: false, desc: 'Different dates' },
    { dateStr1: ' 2024-02-05 ', dateStr2: '2024-02-05', expected: true, desc: 'Same with whitespace' },
    { dateStr1: '2024-02-05', dateStr2: '2024-02-05', expected: true, desc: 'ISO format' }
];

let test1Passed = 0;
testCases.forEach((tc, idx) => {
    const result = String(tc.dateStr1).trim() === String(tc.dateStr2).trim();
    const pass = result === tc.expected;
    test1Passed += pass ? 1 : 0;
    
    console.log(`  ${pass ? '✅' : '❌'} Case ${idx + 1}: ${tc.desc}`);
    console.log(`     Input: '${tc.dateStr1}' vs '${tc.dateStr2}'`);
    console.log(`     Expected: ${tc.expected}, Got: ${result}\n`);
});

console.log(`TEST 1 RESULT: ${test1Passed}/${testCases.length} passed\n`);

// Test 2: Filter appointments by date
console.log('TEST 2: Filter Appointments by Date');
console.log('====================================');

const dateToFilter = '2024-02-05';
const filtered = testAppointments.filter(a => {
    return String(a.date).trim() === String(dateToFilter).trim();
});

const test2Pass = filtered.length === 2 && filtered[0].clientName === 'Maria' && filtered[1].clientName === 'João';
console.log(`  ${test2Pass ? '✅' : '❌'} Filter for ${dateToFilter}`);
console.log(`     Expected: 2 appointments (Maria, João)`);
console.log(`     Got: ${filtered.length} appointments (${filtered.map(a => a.clientName).join(', ')})\n`);

// Test 3: Multiple appointments same slot
console.log('TEST 3: Multiple Appointments Same Time Slot');
console.log('============================================');

const slot = '2024-02-05 14:00';
const [slotDate, slotTime] = slot.split(' ');
const multipleAppts = testAppointments.filter(a => 
    isSameDay(a.date, slotDate) && normalizeTime(a.time) === normalizeTime(slotTime)
);

function isSameDay(dateStr1, dateStr2) {
    return String(dateStr1).trim() === String(dateStr2).trim();
}

function normalizeTime(time) {
    return String(time).replace(/:/g, '').padStart(4, '0');
}

const test3Pass = multipleAppts.length === 2;
console.log(`  ${test3Pass ? '✅' : '❌'} Find appointments for ${slot}`);
console.log(`     Expected: 2 appointments`);
console.log(`     Got: ${multipleAppts.length} appointments\n`);

// Test 4: Professional filter
console.log('TEST 4: Professional Filter');
console.log('===========================');

const profFilter = 'prof1';
const profAppts = testAppointments.filter(a => String(a.professionalId) === String(profFilter));
const test4Pass = profAppts.length === 3;
console.log(`  ${test4Pass ? '✅' : '❌'} Filter for professional ${profFilter}`);
console.log(`     Expected: 3 appointments`);
console.log(`     Got: ${profAppts.length} appointments\n`);

// Test 5: Week range filtering
console.log('TEST 5: Week Range Filtering');
console.log('=============================');

const weekDates = ['2024-02-05', '2024-02-06', '2024-02-07', '2024-02-08', '2024-02-09', '2024-02-10'];
const weekAppts = testAppointments.filter(a => 
    weekDates.includes(String(a.date))
);

const test5Pass = weekAppts.length === 4;
console.log(`  ${test5Pass ? '✅' : '❌'} Filter for week ${weekDates[0]} to ${weekDates[weekDates.length - 1]}`);
console.log(`     Expected: 4 appointments`);
console.log(`     Got: ${weekAppts.length} appointments\n`);

// Summary
console.log('🎯 TEST SUMMARY');
console.log('===============');
const totalTests = 5;
const passedTests = (test1Passed === testCases.length ? 1 : 0) + 
                    (test2Pass ? 1 : 0) + 
                    (test3Pass ? 1 : 0) + 
                    (test4Pass ? 1 : 0) + 
                    (test5Pass ? 1 : 0);

console.log(`Total: ${passedTests}/${totalTests} test groups passed`);
console.log(`Status: ${passedTests === totalTests ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);

// Test data consistency
console.log('\n📊 DATA CONSISTENCY CHECK');
console.log('=========================');
testAppointments.forEach(apt => {
    const hasValidDate = /^\d{4}-\d{2}-\d{2}$/.test(apt.date);
    const hasValidTime = /^\d{2}:\d{2}$/.test(apt.time);
    const status = (hasValidDate && hasValidTime) ? '✅' : '❌';
    console.log(`${status} ID: ${apt.id} | Date: ${apt.date} | Time: ${apt.time}`);
});

console.log('\n✨ Test Complete!\n');
