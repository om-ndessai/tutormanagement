// Restores the lessons seed-home-now.js cancelled to make the tutor's Now card deterministic (those
// with its note), before and after each home/now-* flow. Errors are tolerated: there is usually
// nothing to restore. Never anything but localhost.
var ORG = 'chmi';
var ADMIN = 'priya.raghavan@gmail.com';
var NOTE = 'Maestro: tutor home';

function call(method, path) {
  var response = http.request('http://localhost:8787/api' + path, {
    method: method,
    headers: { 'Content-Type': 'application/json', 'X-Dev-User': ADMIN, 'X-Organization': ORG },
  });
  return { status: response.status, body: response.body ? json(response.body) : null };
}

var restored = 0;
var list = call('GET', '/schedules/cancellations?limit=200');
((list.body && list.body.data) || []).forEach(function (row) {
  if (row.note === NOTE && call('DELETE', '/schedules/' + row.schedule_id + '/cancellations/' + row.occurs_on).status < 300) {
    restored++;
  }
});
output.restoredLessons = restored;
