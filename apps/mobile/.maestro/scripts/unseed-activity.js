// Puts back what seed-activity.js made, so the flows after it see the seed: both comments are
// withdrawn by their authors and Maria's SSN receipt is cleared (the audit lines stay, as they
// must). Never anything but localhost.
function call(method, path, as, body) {
  var response = http.request('http://localhost:8787/api' + path, {
    method: method,
    headers: { 'Content-Type': 'application/json', 'X-Dev-User': as, 'X-Organization': 'chmi' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status >= 300) throw new Error(method + ' ' + path + ' answered ' + response.status);
  return response.body ? json(response.body) : null;
}
function withdraw(as, targetType, targetId, text) {
  var thread = call('GET', '/comments?target_type=' + targetType + '&target_id=' + targetId, as);
  thread.data.comments
    .filter(function (comment) {
      return comment.body === text && comment.can_delete;
    })
    .forEach(function (comment) {
      call('DELETE', '/comments/' + comment.id, as);
    });
}
withdraw(
  'priya.raghavan@gmail.com',
  'user',
  '00000000-0000-4000-8000-000000000006',
  'Activity flow: a note on Sanjay.',
);
withdraw(
  'alex.chen.math@gmail.com',
  'session',
  '50000000-0000-4000-8000-000000000002',
  'Activity flow: a note on the lesson.',
);
call('POST', '/users/00000000-0000-4000-8000-000000000004/ssn-receipt', 'priya.raghavan@gmail.com', {
  received: false,
});
