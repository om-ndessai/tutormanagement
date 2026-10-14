// Sets up a lesson for the reminder sheet (Phase 33), through the LOCAL Worker only (sign-in off,
// X-Dev-User):
// - a new online location of Alex's, "Reminder room" (reminder 0 -- the flow sets it in the app),
//   added to his pairing with Ben, so no other lesson shares its reminder;
// - a weekly schedule of Alex and Ben in that room on TOMORROW's weekday, starting between 23 h 30
//   and 23 h 45 from now on the organization's clock -- inside a one-day reminder. Tomorrow, not
//   today: a date with a lesson already recorded for the pair is left out of the upcoming list,
//   and the seed records lessons for Alex's pairs today.
// clean-schedules.js removes the schedule, then clean-locations.js the room (and its pairing row).
// Sets output.studentName, output.locationName, output.scheduleId.
var ORG = 'chmi';
var ADMIN = 'priya.raghavan@gmail.com';
var ALEX = 'alex.chen.math@gmail.com';
var ALEX_ID = '00000000-0000-4000-8000-000000000003';
var BEN = { id: '00000000-0000-4000-8000-000000000009', name: 'Ben Whitfield' };
var ALEX_BEN = 'a0000000-0000-4000-8000-000000000002';
var ALEX_BEN_SEEDED = [
  '0c100000-0000-4000-8000-000000000001', // Alex: Institute, room 2
  '0c100000-0000-4000-8000-000000000002', // Alex: Online room
  '0c100000-0000-4000-8000-000000000004', // Ben: Home
];
var ROOM = 'Reminder room';

function call(who, method, path, body) {
  var response = http.request('http://localhost:8787/api' + path, {
    method: method,
    headers: { 'Content-Type': 'application/json', 'X-Dev-User': who, 'X-Organization': ORG },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status >= 300) throw new Error(method + ' ' + path + ': ' + response.status + ' ' + response.body);
  return response.body ? json(response.body) : null;
}

// The organization's clock: America/New_York (see seed-next-up.js).
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
var tomorrow = new Date(local.getTime() + 24 * 3600 * 1000);
var minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
// 15 to 30 minutes earlier in the day than now, tomorrow: always under 24 hours away.
var start = Math.max(0, Math.floor(minutes / 15) * 15 - 15);
function clock(m) {
  return (m < 600 ? '0' : '') + Math.floor(m / 60) + ':' + (m % 60 < 10 ? '0' : '') + (m % 60);
}

var room = call(ALEX, 'POST', '/locations', {
  owner_user_id: ALEX_ID,
  name: ROOM,
  kind: 'virtual',
  address: 'https://meet.example.com/reminder',
  reminder_minutes: 0,
}).data;
call(ADMIN, 'PUT', '/assignments/' + ALEX_BEN + '/locations', { location_ids: ALEX_BEN_SEEDED.concat([room.id]) });
var schedule = call(ALEX, 'POST', '/schedules', {
  tutor_user_id: ALEX_ID,
  student_user_id: BEN.id,
  day_of_week: tomorrow.getUTCDay(),
  start_time: clock(start),
  duration_minutes: 30,
  mode: 'virtual',
  starts_on: tomorrow.toISOString().slice(0, 10),
  location_ids: [room.id],
}).data;
output.scheduleId = schedule.id;
output.studentName = BEN.name;
output.locationName = ROOM;
