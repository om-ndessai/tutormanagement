// Puts the Phase 33 locations back as the seed has them, before and after every locations/* flow
// (onFlowStart / onFlowComplete), so a flow that fails part-way leaves nothing behind:
// - every location of Alex, Sanjay, Sofia and Ben that the seed did not make is deleted (seed ids are
//   all "xxxxxxxx-0000-4000-8000-…"; the API's are random);
// - their seeded locations' reminders go back to 0 (the seed's), so no other flow meets a reminder
//   sheet it did not ask for;
// - the pairings of Alex with Sofia and with Ben allow their three seeded locations again.
// Run clean-schedules.js FIRST: a location a schedule uses cannot be deleted.
// Errors are tolerated. Never anything but localhost. One device at a time (see clean-sessions.js).
var ORG = 'chmi';
var ADMIN = 'priya.raghavan@gmail.com';
var SEEDED = /^[0-9a-f]{8}-0000-4000-8000-[0-9a-f]{12}$/;
var OWNERS = [
  '00000000-0000-4000-8000-000000000003', // Alex Chen
  '00000000-0000-4000-8000-000000000006', // Sanjay Patel
  '00000000-0000-4000-8000-000000000008', // Sofia Okafor
  '00000000-0000-4000-8000-000000000009', // Ben Whitfield
];
var ALEX_SOFIA = 'a0000000-0000-4000-8000-000000000001';
var ALEX_BEN = 'a0000000-0000-4000-8000-000000000002';
var ALEX_BEN_LOCATIONS = [
  '0c100000-0000-4000-8000-000000000001', // Alex: Institute, room 2
  '0c100000-0000-4000-8000-000000000002', // Alex: Online room
  '0c100000-0000-4000-8000-000000000004', // Ben: Home
];
var ALEX_SOFIA_LOCATIONS = [
  '0c100000-0000-4000-8000-000000000001', // Alex: Institute, room 2
  '0c100000-0000-4000-8000-000000000002', // Alex: Online room
  '0c100000-0000-4000-8000-000000000003', // Sofia: Home
];

function call(method, path, body) {
  var response = http.request('http://localhost:8787/api' + path, {
    method: method,
    headers: { 'Content-Type': 'application/json', 'X-Dev-User': ADMIN, 'X-Organization': ORG },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: response.body ? json(response.body) : null };
}

var removed = 0;
var reset = 0;
OWNERS.forEach(function (owner) {
  var list = call('GET', '/locations?user_id=' + owner);
  ((list.body && list.body.data) || []).forEach(function (location) {
    if (!SEEDED.test(location.id)) {
      if (call('DELETE', '/locations/' + location.id).status < 300) removed++;
    } else if (location.reminder_minutes !== 0) {
      if (call('PATCH', '/locations/' + location.id, { reminder_minutes: 0 }).status < 300) reset++;
    }
  });
});
call('PUT', '/assignments/' + ALEX_SOFIA + '/locations', { location_ids: ALEX_SOFIA_LOCATIONS });
call('PUT', '/assignments/' + ALEX_BEN + '/locations', { location_ids: ALEX_BEN_LOCATIONS });
output.cleanedLocations = removed;
output.resetReminders = reset;
