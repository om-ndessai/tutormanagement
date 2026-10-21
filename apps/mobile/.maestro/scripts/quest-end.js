// Puts Question Quest (Phase 42) back as the seed has it, before and after every quest/* flow,
// whatever happened in between: Sofia's level cleared, then chmi's switch OFF -- every Quest route
// answers 403 while it is off, so the level is cleared with the switch on first. As Priya (an
// admin), through the LOCAL Worker only. Answers and points stay; the runner resets the database
// around a run, and the flows read their expectations from the server (quest-start.js).
var ORG = 'chmi';
var ADMIN = 'priya.raghavan@gmail.com';
var SOFIA_ID = '00000000-0000-4000-8000-000000000008';

function call(method, path, body) {
  var response = http.request('http://localhost:8787/api' + path, {
    method: method,
    headers: { 'Content-Type': 'application/json', 'X-Dev-User': ADMIN, 'X-Organization': ORG },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: response.body };
}

var on = call('PATCH', '/organization/settings', { gamify_question_quest: true });
if (on.status >= 300) throw new Error('Could not reach Question Quest: ' + on.status + ' ' + on.body);
var cleared = call('PUT', '/quest/students/' + SOFIA_ID + '/level', { level_id: null });
var off = call('PATCH', '/organization/settings', { gamify_question_quest: false });
if (off.status >= 300) throw new Error('Could not switch Question Quest back off: ' + off.status + ' ' + off.body);
if (cleared.status >= 300) throw new Error("Could not clear Sofia's level: " + cleared.status + ' ' + cleared.body);
