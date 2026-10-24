// Puts the feature sets (Phase 50) back as the seed has them, before and after every features/*
// flow: chmi allowed all three, riverside Tutoring and Assessment, assess Assessment alone; assess's
// Assessment switch on and every assessment still in progress there discarded (as Ines, its admin),
// so a flow that failed part-way leaves no "Continue" for the next. Submitted ones cannot be taken
// back through the API; the runner resets the database around a run. Errors are tolerated. Never
// anything but localhost.
var NAV = 'ndessai@gmail.com';
var INES = 'ines.ferreira.assess@gmail.com';
var SEEDED = {
  chmi: { feature_tutoring: true, feature_assessment: true, feature_quest: true },
  riverside: { feature_tutoring: true, feature_assessment: true, feature_quest: false },
  assess: { feature_tutoring: false, feature_assessment: true, feature_quest: false },
};

function call(method, path, body, who, org) {
  var headers = { 'Content-Type': 'application/json', 'X-Dev-User': who };
  if (org) headers['X-Organization'] = org;
  var response = http.request('http://localhost:8787/api' + path, {
    method: method,
    headers: headers,
    body: body === undefined ? (method === 'POST' ? '{}' : undefined) : JSON.stringify(body),
  });
  return { status: response.status, body: response.body ? json(response.body) : null };
}

var list = call('GET', '/platform/organizations', undefined, NAV);
var reset = 0;
((list.body && list.body.data) || []).forEach(function (org) {
  var want = SEEDED[org.slug];
  if (!want) return;
  if (
    org.feature_tutoring !== want.feature_tutoring ||
    org.feature_assessment !== want.feature_assessment ||
    org.feature_quest !== want.feature_quest
  ) {
    if (call('PUT', '/platform/organizations/' + org.id + '/features', want, NAV).status < 300) reset++;
  }
});

call('PATCH', '/organization/settings', { canvas_assessments: true }, INES, 'assess');
var discarded = 0;
var rows = call('GET', '/canvas-assessments', undefined, INES, 'assess');
((rows.body && rows.body.data) || []).forEach(function (row) {
  if (row.status === 'in_progress' && call('POST', '/canvas-assessments/' + row.id + '/discard', {}, INES, 'assess').status < 300) {
    discarded++;
  }
});
output.featuresReset = reset;
output.discarded = discarded;
