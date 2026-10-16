// Gives Alex (tutor in chmi) a lesson AT HAND for Home's Next up card (#43): a weekly schedule on
// today's weekday, begun an hour ago on the organization's clock and running two hours, so it is
// under way, starts before any other lesson of his still running today, and is his "Next up".
// Through the LOCAL Worker only (sign-in off, X-Dev-User). clean-schedules.js removes it.
// Sets output.studentId, output.studentName, output.scheduleId, output.startPattern, output.startClock.
var ORG = 'chmi';
var ALEX = 'alex.chen.math@gmail.com';
var ALEX_ID = '00000000-0000-4000-8000-000000000003';
var ALEX_ONLINE_ROOM = '0c100000-0000-4000-8000-000000000002';
var SOFIA = { id: '00000000-0000-4000-8000-000000000008', name: 'Sofia Okafor', day: 2 };
var BEN = { id: '00000000-0000-4000-8000-000000000009', name: 'Ben Whitfield', day: 6 };

// The organization's clock: America/New_York (US daylight time from 2 AM on the second Sunday of
// March to 2 AM on the first Sunday of November). Maestro's script engine has no time zones.
function nthSunday(year, month, n) {
  var first = new Date(Date.UTC(year, month, 1)).getUTCDay();
  return 1 + ((7 - first) % 7) + (n - 1) * 7;
}
var now = new Date();
var year = now.getUTCFullYear();
var dstStart = Date.UTC(year, 2, nthSunday(year, 2, 2), 7);
var dstEnd = Date.UTC(year, 10, nthSunday(year, 10, 1), 6);
var offsetHours = now.getTime() >= dstStart && now.getTime() < dstEnd ? -4 : -5;
var local = new Date(now.getTime() + offsetHours * 3600 * 1000);
var today = local.toISOString().slice(0, 10);
var weekday = local.getUTCDay();
var minutes = local.getUTCHours() * 60 + local.getUTCMinutes();

// A student whose own weekly lesson is not today, so the two never meet on the strip.
var student = weekday === SOFIA.day ? BEN : SOFIA;
var start = Math.max(0, Math.floor(minutes / 15) * 15 - 60);
var duration = Math.min(120, 24 * 60 - 15 - start);
if (minutes >= start + duration) throw new Error('Too close to midnight to seed a lesson under way.');
function clock(m) {
  return (m < 600 ? '0' : '') + Math.floor(m / 60) + ':' + (m % 60 < 10 ? '0' : '') + (m % 60);
}

var response = http.post('http://localhost:8787/api/schedules', {
  headers: { 'Content-Type': 'application/json', 'X-Dev-User': ALEX, 'X-Organization': ORG },
  body: JSON.stringify({
    tutor_user_id: ALEX_ID,
    student_user_id: student.id,
    day_of_week: weekday,
    start_time: clock(start),
    duration_minutes: duration,
    mode: 'virtual',
    starts_on: today,
    // Phase 33: a schedule has at least one location from its pairing -- Alex's online room,
    // which the seed allows on both his pairings.
    location_ids: [ALEX_ONLINE_ROOM],
  }),
});
if (response.status !== 201 && response.status !== 200) {
  throw new Error('Could not seed the lesson: ' + response.status + ' ' + response.body);
}
output.scheduleId = json(response.body).data.id;
output.studentId = student.id;
output.studentName = student.name;
var hour12 = Math.floor(start / 60) % 12 === 0 ? 12 : Math.floor(start / 60) % 12;
// A pattern, not text: the time pickers put a narrow no-break space before AM/PM.
output.startPattern =
  hour12 + ':' + (start % 60 < 10 ? '0' : '') + (start % 60) + '.' + (start < 720 ? 'AM' : 'PM');
// The start without its AM/PM ("9:45"): a range names the half of the day once, at its end.
output.startClock = hour12 + ':' + (start % 60 < 10 ? '0' : '') + (start % 60);
