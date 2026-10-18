// Puts the Assessment menu back as the seed has it, before and after every canvas-assessments/*
// flow (Phase 38): chmi's switch on, its unreviewed trial off and (Phase 40) 10 questions an
// assessment, and every assessment still in
// progress there discarded (as Priya, an admin, who may discard any), so a flow that failed
// part-way leaves no "Continue" for the next. Submitted ones cannot be taken back through the API;
// the runner resets the database around a run. Never anything but localhost.
var ORG = 'chmi';
var ADMIN = 'priya.raghavan@gmail.com';

function call(method, path, body) {
  var response = http.request('http://localhost:8787/api' + path, {
    method: method,
    headers: { 'Content-Type': 'application/json', 'X-Dev-User': ADMIN, 'X-Organization': ORG },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: response.body ? json(response.body) : null };
}

var settings = call('PATCH', '/organization/settings', {
  canvas_assessments: true,
  canvas_assessments_unreviewed: false,
  canvas_assessment_questions: 10,
});
if (settings.status >= 300) throw new Error('Could not switch the Assessment menu back on: ' + settings.status);

var discarded = 0;
var list = call('GET', '/canvas-assessments');
((list.body && list.body.data) || []).forEach(function (row) {
  if (row.status === 'in_progress' && call('POST', '/canvas-assessments/' + row.id + '/discard', {}).status < 300) {
    discarded++;
  }
});
output.discarded = discarded;
