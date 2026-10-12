// Puts the lessons back as the seed has them, before and after every sessions/* flow (their
// onFlowStart / onFlowComplete hooks), so a flow that fails part-way leaves nothing for the next:
// - a running lesson of any tutor the flows use is discarded;
// - every draft of those people is deleted (the seed has none);
// - every lesson from the last week that the seed did not make is deleted (seed ids are all
//   "xxxxxxxx-0000-4000-8000-…"; the app's are random), with its assessments and reflection.
// Errors are tolerated: there is usually nothing to clean. Never anything but localhost.
// Run one device at a time against the local database (as `npm run e2e:mobile` does): a clean on
// one device would delete the lesson a flow on the other is in the middle of.
var ORG = 'chmi';
var ADMIN = 'priya.raghavan@gmail.com';
var PEOPLE = [ADMIN, 'alex.chen.math@gmail.com', 'maria.okafor@gmail.com', 'sanjay.patel.nc@gmail.com'];
var SEEDED = /^[0-9a-f]{8}-0000-4000-8000-[0-9a-f]{12}$/;

function call(method, path, as) {
  var response = http.request('http://localhost:8787/api' + path, {
    method: method,
    headers: { 'Content-Type': 'application/json', 'X-Dev-User': as, 'X-Organization': ORG },
  });
  return { status: response.status, body: response.body ? json(response.body) : null };
}

var removed = 0;
PEOPLE.forEach(function (as) {
  if (call('DELETE', '/sessions/active', as).status < 300) removed++;
  var drafts = call('GET', '/sessions/drafts', as);
  ((drafts.body && drafts.body.data) || []).forEach(function (draft) {
    if (call('DELETE', '/sessions/drafts/' + draft.id, as).status < 300) removed++;
  });
});

var from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
var lessons = call('GET', '/sessions?from=' + from + '&limit=200', ADMIN);
((lessons.body && lessons.body.data) || []).forEach(function (lesson) {
  if (!SEEDED.test(lesson.id) && call('DELETE', '/sessions/' + lesson.id, ADMIN).status < 300) removed++;
});
output.cleanedSessions = removed;
