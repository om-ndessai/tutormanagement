// Puts the directory back as the seed has it, before and after the people/* flows that change it
// (their onFlowStart / onFlowComplete hooks), so a flow that fails part-way leaves nothing behind:
// - everyone the seed did not make (seed ids are all "xxxxxxxx-0000-4000-8000-…"; the API's are
//   random) is deleted for good (?hard=true), deactivated or not;
// - Maria's phone, which people/edit changes, is put back.
// Errors are tolerated. Never anything but localhost. One device at a time (see clean-sessions.js).
var ORG = 'chmi';
var ADMIN = 'priya.raghavan@gmail.com';
var SEEDED = /^[0-9a-f]{8}-0000-4000-8000-[0-9a-f]{12}$/;

function call(method, path, body) {
  var response = http.request('http://localhost:8787/api' + path, {
    method: method,
    headers: { 'Content-Type': 'application/json', 'X-Dev-User': ADMIN, 'X-Organization': ORG },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: response.body ? json(response.body) : null };
}

var strangers = [];
for (var offset = 0; offset < 1000; offset += 100) {
  var page = call('GET', '/users?include_deleted=true&limit=100&offset=' + offset);
  var rows = (page.body && page.body.data) || [];
  rows.forEach(function (user) {
    if (!SEEDED.test(user.id)) strangers.push(user.id);
  });
  if (rows.length < 100) break;
}
// Two passes: the API may refuse a parent while a student still needs them, until the student goes.
var removed = 0;
[1, 2].forEach(function () {
  strangers = strangers.filter(function (id) {
    if (call('DELETE', '/users/' + id + '?hard=true').status < 300) {
      removed++;
      return false;
    }
    return true;
  });
});
call('PATCH', '/users/00000000-0000-4000-8000-000000000004', { phone: '(919) 555-0155' });
output.cleanedPeople = removed;
