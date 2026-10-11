// Puts the standing schedules back as the seed has them, before and after every flow that adds one
// (onFlowStart / onFlowComplete): any schedule in chmi that the seed did not make is deleted (seed
// ids are all "xxxxxxxx-0000-4000-8000-…"; the app's are random), so a failed run leaves nothing
// for the next. Errors are tolerated. Never anything but localhost.
var ORG = 'chmi';
var ADMIN = 'priya.raghavan@gmail.com';
var SEEDED = /^[0-9a-f]{8}-0000-4000-8000-[0-9a-f]{12}$/;

function call(method, path) {
  var response = http.request('http://localhost:8787/api' + path, {
    method: method,
    headers: { 'Content-Type': 'application/json', 'X-Dev-User': ADMIN, 'X-Organization': ORG },
  });
  return { status: response.status, body: response.body ? json(response.body) : null };
}

var removed = 0;
var list = call('GET', '/schedules');
((list.body && list.body.data) || []).forEach(function (schedule) {
  if (!SEEDED.test(schedule.id) && call('DELETE', '/schedules/' + schedule.id).status < 300) removed++;
});
output.cleanedSchedules = removed;
