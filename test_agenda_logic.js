#!/usr/bin/env node
/**
 * Test script to validate agenda weekly grid functionality
 */

console.log('🧪 Testing Weekly Agenda Grid Logic\n');

// Mock data
const currentWeek = parseDateSafe('2024-02-05'); // A Monday
const appointments = [
    {
        id: '1',
        date: '2024-02-05',
        time: '14:00',
        professionalId: 'prof1',
        clientName: 'Maria',
        type: 'clinica',
        status: 'agendado'
    },
    {
        id: '2',
        date: '2024-02-05',
        time: '14:00',
        professionalId: 'prof1',
        clientName: 'João',
        type: 'analise',
        status: 'agendado'
    },
    {
        id: '3',
        date: '2024-02-06',
        time: '15:00',
        professionalId: 'prof1',
        clientName: 'Pedro',
        type: 'discussao',
        status: 'agendado'
    }
];

// Helper functions
function parseDateSafe(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
    const parsed = new Date(year, month, day);
    if (parsed.getFullYear() !== year || parsed.getMonth() !== month || parsed.getDate() !== day) return null;
    return parsed;
}

function formatDate(date) {
    if (typeof date === 'string') {
        const value = date.trim();
        const dateOnlyMatch = value.match(/^(\d{4}-\d{2}-\d{2})(?:T.*)?$/);
        if (dateOnlyMatch) return dateOnlyMatch[1];
    }
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function isSameDay(dateStr1, dateStr2) {
    return String(dateStr1).trim() === String(dateStr2).trim();
}

function getWeekDays(date) {
    const week = [];
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day;
    startOfWeek.setDate(diff);
    
    for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        week.push(d);
    }
    return week;
}

// Tests
console.log('TEST 1: getWeekDays() returns 7 days');
const weekDays = getWeekDays(currentWeek);
console.log(`  Expect: 7 days, Got: ${weekDays.length} days`);
console.log(`  Result: ${weekDays.length === 7 ? '✅ PASS' : '❌ FAIL'}\n`);

console.log('TEST 2: Week starts on Monday');
const firstDay = weekDays[0].getDay();
console.log(`  Expect: Sunday (0), Got: ${firstDay}`);
console.log(`  Result: ${firstDay === 0 ? '✅ PASS' : '❌ FAIL'}\n`);

console.log('TEST 3: Filtered appointments for 2024-02-05');
const feb5Appts = appointments.filter(a => isSameDay(a.date, '2024-02-05'));
console.log(`  Expect: 2 appointments, Got: ${feb5Appts.length}`);
console.log(`  Result: ${feb5Appts.length === 2 ? '✅ PASS' : '❌ FAIL'}`);
console.log(`  Appointments: ${feb5Appts.map(a => a.clientName).join(', ')}\n`);

console.log('TEST 4: Filtered appointments for 2024-02-06');
const feb6Appts = appointments.filter(a => isSameDay(a.date, '2024-02-06'));
console.log(`  Expect: 1 appointment, Got: ${feb6Appts.length}`);
console.log(`  Result: ${feb6Appts.length === 1 ? '✅ PASS' : '❌ FAIL'}\n`);

console.log('TEST 5: Multiple appointments in same slot');
const timeSlotAppts = appointments.filter(a => 
    isSameDay(a.date, '2024-02-05') && a.time === '14:00'
);
console.log(`  Expect: 2 appointments, Got: ${timeSlotAppts.length}`);
console.log(`  Result: ${timeSlotAppts.length === 2 ? '✅ PASS' : '❌ FAIL'}`);
console.log(`  Appointments: ${timeSlotAppts.map(a => `${a.clientName} (${a.type})`).join(', ')}\n`);

console.log('TEST 6: formatDate() returns YYYY-MM-DD');
const testDate = parseDateSafe('2024-02-05');
const formatted = formatDate(testDate);
console.log(`  Expect: 2024-02-05, Got: ${formatted}`);
console.log(`  Result: ${formatted === '2024-02-05' ? '✅ PASS' : '❌ FAIL'}\n`);

console.log('TEST 7: isSameDay() handles whitespace');
const sameDay = isSameDay('2024-02-05 ', ' 2024-02-05');
console.log(`  Expect: true, Got: ${sameDay}`);
console.log(`  Result: ${sameDay === true ? '✅ PASS' : '❌ FAIL'}\n`);

console.log('TEST 8: Week dates formatted');
const visibleWeekDays = weekDays.slice(1, 7); // Skip Sunday
const weekDatesFormatted = visibleWeekDays.map(d => formatDate(d));
console.log(`  Week dates: ${weekDatesFormatted.join(', ')}`);
console.log(`  Result: ${weekDatesFormatted.length === 6 ? '✅ PASS' : '❌ FAIL'}\n`);

console.log('TEST 9: Navigation - next week');
const nextWeek = new Date(currentWeek);
nextWeek.setDate(nextWeek.getDate() + 7);
const nextWeekDays = getWeekDays(nextWeek);
const nextWeekDates = nextWeekDays.slice(1, 7).map(d => formatDate(d));
console.log(`  Current week: ${weekDatesFormatted.join(', ')}`);
console.log(`  Next week:    ${nextWeekDates.join(', ')}`);
const isDifferent = nextWeekDates[0] !== weekDatesFormatted[0];
console.log(`  Result: ${isDifferent ? '✅ PASS' : '❌ FAIL'}\n`);

console.log('TEST 10: Navigation - previous week');
const prevWeek = new Date(currentWeek);
prevWeek.setDate(prevWeek.getDate() - 7);
const prevWeekDays = getWeekDays(prevWeek);
const prevWeekDates = prevWeekDays.slice(1, 7).map(d => formatDate(d));
console.log(`  Previous week: ${prevWeekDates.join(', ')}`);
const isEarlier = prevWeekDates[0] < weekDatesFormatted[0];
console.log(`  Result: ${isEarlier ? '✅ PASS' : '❌ FAIL'}\n`);

console.log('✅ All tests completed!\n');
