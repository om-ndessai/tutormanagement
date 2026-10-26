// Question Quest (Phase 42) for a quest/* flow, through the LOCAL Worker only (sign-in off,
// X-Dev-User): chmi's switch on, and Sofia (a student) started at BA3, as Priya (an admin) -- or at
// env LEVEL. With env ANSWERS, Sofia then answers that many questions herself (the first choice, or
// 7), so her tutor Alex has answers waiting. Outputs what the screens should then say, read from the
// server rather than assumed, so the flows pass on a database that has run them before:
// - questPointsNow / questPointsNext: Sofia's points now, and after one more answer ("4 points");
// - questWaiting / questWaitingAfterApprove / questWaitingAfterFlag: Alex's queue ("3 waiting");
// - questTutorPointsAfterApprove / questTutorPointsAfterFlag: Alex's points after approving the
//   oldest answer, then flagging the next: a point for each review, and nothing else (owner,
//   2026-10-20: a tutor earns one point per review, never a correctness point).
// The flag is the seed's "off" again after every flow (quest-end.js).
var ORG = 'chmi';
var ADMIN = 'priya.raghavan@gmail.com';
var SOFIA = 'sofia.okafor@gmail.com';
var ALEX = 'alex.chen.math@gmail.com';
var SOFIA_ID = '00000000-0000-4000-8000-000000000008';

function call(who, method, path, body) {
  var response = http.request('http://localhost:8787/api' + path, {
    method: method,
    headers: { 'Content-Type': 'application/json', 'X-Dev-User': who, 'X-Organization': ORG },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status >= 300) throw new Error(method + ' ' + path + ' answered ' + response.status + ' ' + response.body);
  return json(response.body);
}

function points(n) {
  return n + (n === 1 ? ' point' : ' points');
}

call(ADMIN, 'PATCH', '/organization/settings', { gamify_question_quest: true });
call(ADMIN, 'PUT', '/quest/students/' + SOFIA_ID + '/level', {
  level_id: typeof LEVEL === 'undefined' ? 'BA3' : LEVEL,
});

var answers = typeof ANSWERS === 'undefined' ? 0 : Number(ANSWERS);
for (var i = 0; i < answers; i++) {
  var now = call(SOFIA, 'GET', '/quest/me').data;
  if (!now.question) throw new Error('Sofia has no question to answer at ' + now.level_id);
  call(SOFIA, 'POST', '/quest/answers', {
    question_id: now.question.id,
    answer: now.question.kind === 'choice' ? now.question.choices[0] : '7',
  });
}

// With env UNTIL_NUMBER, Sofia answers the choice questions served first (the first choice) until
// the next one asks for a number, so a flow can test the number field. The seed's sample bank leads
// some levels with choices (G5 since Phase 49); a few answers, on the same level, never more.
if (typeof UNTIL_NUMBER !== 'undefined' && UNTIL_NUMBER) {
  var level = call(SOFIA, 'GET', '/quest/me').data.level_id;
  for (var tries = 0; ; tries++) {
    var served = call(SOFIA, 'GET', '/quest/me').data;
    if (!served.question || served.level_id !== level) throw new Error('No number question at ' + level);
    if (served.question.kind !== 'choice') break;
    if (tries >= 25) throw new Error('No number question in the first 25 at ' + level);
    call(SOFIA, 'POST', '/quest/answers', { question_id: served.question.id, answer: served.question.choices[0] });
  }
}

var me = call(SOFIA, 'GET', '/quest/me').data;
output.questPointsNow = points(me.points);
output.questPointsNext = points(me.points + 1);

var queue = call(ALEX, 'GET', '/quest/review').data;
output.questWaiting = queue.waiting + ' waiting';
output.questWaitingAfterApprove = queue.waiting - 1 + ' waiting';
output.questWaitingAfterFlag = queue.waiting - 2 + ' waiting';
output.questTutorPointsAfterApprove = points(queue.points + 1);
output.questTutorPointsAfterFlag = points(queue.points + 2);
