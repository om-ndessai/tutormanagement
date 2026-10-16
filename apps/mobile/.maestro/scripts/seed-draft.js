// Leaves Alex (tutor in chmi) a write-up draft from today on the organization's clock, for Home's
// "Finish write-up" card (UI upgrades U6): his lesson with Sofia, 12:00-1:00 AM so it is never in
// the future, with a covered note. Through the LOCAL Worker only (sign-in off, X-Dev-User).
// clean-sessions.js deletes his drafts afterwards. Sets output.draftId.
var ORG = 'chmi';
var ALEX = 'alex.chen.math@gmail.com';
var ALEX_ID = '00000000-0000-4000-8000-000000000003';
var SOFIA_ID = '00000000-0000-4000-8000-000000000008';

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
var today = new Date(now.getTime() + offsetHours * 3600 * 1000).toISOString().slice(0, 10);

var response = http.post('http://localhost:8787/api/sessions/drafts', {
  headers: { 'Content-Type': 'application/json', 'X-Dev-User': ALEX, 'X-Organization': ORG },
  body: JSON.stringify({
    tutor_user_id: ALEX_ID,
    student_user_id: SOFIA_ID,
    occurred_on: today,
    started_at: '00:00',
    ended_at: '01:00',
    mode: 'in_person',
    notes: 'Fractions on the number line.',
  }),
});
if (response.status !== 201 && response.status !== 200) {
  throw new Error('Could not seed the draft: ' + response.status + ' ' + response.body);
}
output.draftId = json(response.body).data.id;
