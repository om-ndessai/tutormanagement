// The seed carries no audit rows, so the activity flows make three through the LOCAL Worker:
// Priya comments on Sanjay's record, Priya marks Maria's SSN received (subject: Maria), and Alex
// comments on his 2026-09-15 lesson with Sofia. Never anything but localhost.
function call(method, path, as, body) {
  var response = http.request('http://localhost:8787/api' + path, {
    method: method,
    headers: { 'Content-Type': 'application/json', 'X-Dev-User': as, 'X-Organization': 'chmi' },
    body: JSON.stringify(body),
  });
  if (response.status >= 300) throw new Error(method + ' ' + path + ' answered ' + response.status);
}
call('POST', '/comments', 'priya.raghavan@gmail.com', {
  target_type: 'user',
  target_id: '00000000-0000-4000-8000-000000000006',
  body: 'Activity flow: a note on Sanjay.',
});
call('POST', '/users/00000000-0000-4000-8000-000000000004/ssn-receipt', 'priya.raghavan@gmail.com', {
  received: true,
});
call('POST', '/comments', 'alex.chen.math@gmail.com', {
  target_type: 'session',
  target_id: '50000000-0000-4000-8000-000000000002',
  body: 'Activity flow: a note on the lesson.',
});
