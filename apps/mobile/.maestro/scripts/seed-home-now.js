// The tutor's Now card (Phase 43), made deterministic: a weekly schedule for Alex and Sofia (chmi,
// in person at his room) whose lesson is placed relative to NOW on the organization's clock, and every
// other lesson that would take the card cancelled for its date (note NOTE; clean-home-now.js restores
// them, clean-schedules.js removes the schedule). Through the LOCAL Worker only (X-Dev-User).
//
// env MODE:
//   ended -- the lesson ended about 30 minutes ago and is unrecorded: the celebration.
//   next  -- the lesson starts in 30-45 minutes (tomorrow at 8 AM late in the evening): the
//            personal message and the brief.
// Sets output.scheduleId, output.studentName, output.dayPattern (the record sheet's day line),
// output.startClock ("4:05", as a time range writes its start), output.homework (the homework set at
// Sofia's last lesson, which the Homework review starts with).
var ORG = 'chmi';
var ALEX = 'alex.chen.math@gmail.com';
var ALEX_ID = '00000000-0000-4000-8000-000000000003';
var ALEX_ROOM = '0c100000-0000-4000-8000-000000000001';
var SOFIA = { id: '00000000-0000-4000-8000-000000000008', name: 'Sofia Okafor' };
var NOTE = 'Maestro: tutor home';
var mode = typeof MODE === 'undefined' ? 'ended' : MODE;

// The organization's clock: America/New_York (as seed-next-up.js; Maestro's engine has no zones).
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
var minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
function dayOf(shift) {
  return new Date(local.getTime() + shift * 24 * 3600 * 1000).toISOString().slice(0, 10);
}
function weekdayOf(shift) {
  return (local.getUTCDay() + shift + 7) % 7;
}
function clock(m) {
  return (m < 600 ? '0' : '') + Math.floor(m / 60) + ':' + (m % 60 < 10 ? '0' : '') + (m % 60);
}
function call(method, path, body) {
  var response = http.request('http://localhost:8787/api' + path, {
    method: method,
    headers: { 'Content-Type': 'application/json', 'X-Dev-User': ALEX, 'X-Organization': ORG },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status >= 300) throw new Error(method + ' ' + path + ' answered ' + response.status + ' ' + response.body);
  return response.body ? json(response.body) : null;
}

// Where the lesson goes, in minutes from today's midnight, and on which day.
var shift = 0;
var start;
if (mode === 'ended') {
  var end = Math.floor((minutes - 30) / 5) * 5;
  if (end - 60 < 0) {
    // Just after midnight: yesterday's lesson, still inside the 24 hours.
    end = Math.min(end, -5) + 24 * 60;
    shift = -1;
  }
  start = end - 60;
} else {
  start = Math.ceil((minutes + 30) / 15) * 15;
  if (start + 60 > 24 * 60 - 15) {
    start = 8 * 60;
    shift = 1;
  }
}
var date = dayOf(shift);

var created = call('POST', '/schedules', {
  tutor_user_id: ALEX_ID,
  student_user_id: SOFIA.id,
  day_of_week: weekdayOf(shift),
  start_time: clock(start),
  duration_minutes: 60,
  mode: 'in_person',
  starts_on: date,
  location_ids: [ALEX_ROOM],
});
var mine = created.data.id;

function cancel(lesson) {
  call('POST', '/schedules/' + lesson.schedule_id + '/cancellations', { occurs_on: lesson.occurs_on, note: NOTE });
}

// Nothing else may take the card: every other finished lesson waiting to be recorded, and (for
// `next`) any lesson of the seed's that comes sooner than ours, is cancelled for its date.
var home = null;
for (var round = 0; round < 6; round++) {
  home = call('GET', '/home/tutor').data;
  var others = home.unrecorded.filter(function (lesson) {
    return lesson.schedule_id !== mine;
  });
  others.forEach(cancel);
  var nextIsOther = mode === 'next' && home.next && home.next.schedule_id !== mine;
  if (nextIsOther) cancel(home.next);
  if (others.length === 0 && !nextIsOther) break;
}
if (mode === 'ended' && !(home.unrecorded.length === 1 && home.unrecorded[0].schedule_id === mine)) {
  throw new Error('The finished lesson is not the only one waiting: ' + JSON.stringify(home.unrecorded));
}
if (mode === 'next' && !(home.next && home.next.schedule_id === mine && home.unrecorded.length === 0)) {
  throw new Error('Our lesson is not next: ' + JSON.stringify(home.next));
}

output.scheduleId = mine;
output.studentName = SOFIA.name;
output.dayPattern = shift === 0 ? 'Today' : '.*';
var hour12 = Math.floor(start / 60) % 12 === 0 ? 12 : Math.floor(start / 60) % 12;
output.startClock = hour12 + ':' + (start % 60 < 10 ? '0' : '') + (start % 60);
output.homework = mode === 'ended' ? home.unrecorded[0].homework_last || '' : '';
