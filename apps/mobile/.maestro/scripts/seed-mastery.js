// Gives Sofia (chmi) a topic mastered lately, for Home's celebration (UI upgrades U6): a lesson with
// Alex recorded yesterday on the organization's clock (today on the 1st, so it falls in this month),
// rating the first topic of her plan that is not yet mastered at 5. The seed's lessons are weeks
// old, so without this nothing is recent enough to celebrate. Through the LOCAL Worker only
// (sign-in off, X-Dev-User). clean-sessions.js deletes the lesson afterwards.
// Sets output.sessionId, output.topicId, output.topicName.
var ORG = 'chmi';
var ALEX = 'alex.chen.math@gmail.com';
var ALEX_ID = '00000000-0000-4000-8000-000000000003';
var SOFIA_ID = '00000000-0000-4000-8000-000000000008';

function call(method, path, body) {
  var response = http.request('http://localhost:8787/api' + path, {
    method: method,
    headers: { 'Content-Type': 'application/json', 'X-Dev-User': ALEX, 'X-Organization': ORG },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status >= 300) throw new Error(method + ' ' + path + ' answered ' + response.status + ' ' + response.body);
  return json(response.body);
}

// The organization's clock: America/New_York (see seed-next-up.js).
function nthSunday(year, month, n) {
  var first = new Date(Date.UTC(year, month, 1)).getUTCDay();
  return 1 + ((7 - first) % 7) + (n - 1) * 7;
}
var now = new Date();
var year = now.getUTCFullYear();
var dstStart = Date.UTC(year, 2, nthSunday(year, 2, 2), 7);
var dstEnd = Date.UTC(year, 10, nthSunday(year, 10, 1), 6);
var offsetHours = now.getTime() >= dstStart && now.getTime() < dstEnd ? -4 : -5;
var local = new Date(now.getTime() + offsetHours * 3600 * 1000);
var day = local.getUTCDate() === 1 ? local : new Date(local.getTime() - 24 * 3600 * 1000);
var occurredOn = day.toISOString().slice(0, 10);
var early = local.getUTCDate() === 1;

var progress = call('GET', '/progress/' + SOFIA_ID).data;
var topic = progress.topics.filter(function (t) {
  return !t.mastered;
})[0];
if (!topic) throw new Error('Sofia has no plan topic left to master.');

var lesson = call('POST', '/sessions', {
  tutor_user_id: ALEX_ID,
  student_user_id: SOFIA_ID,
  occurred_on: occurredOn,
  started_at: early ? '00:15' : '15:00',
  ended_at: early ? '00:45' : '16:00',
  mode: 'in_person',
  progress: { goal_rating: 4, topic_ratings: [{ topic_id: topic.topic_id, rating: 5 }] },
});
output.sessionId = lesson.data.id;
output.topicId = topic.topic_id;

var names = {};
call('GET', '/curriculum').data.forEach(function (level) {
  level.topics.forEach(function (t) {
    names[t.id] = t.name;
  });
});
output.topicName = names[topic.topic_id] || topic.topic_id;
