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

// With env NUMBER_LEVELS ("NC26.5:G5,NC26.6:G6,..."): the first of those levels whose next question
// asks for a number, read from the server -- which level starts with one changes with the bank's
// sample. Outputs questLevel, the level's short name as the screen shows it.
if (typeof NUMBER_LEVELS !== 'undefined') {
  var found = false;
  var candidates = NUMBER_LEVELS.split(',');
  for (var c = 0; c < candidates.length && !found; c++) {
    var pair = candidates[c].split(':');
    call(ADMIN, 'PUT', '/quest/students/' + SOFIA_ID + '/level', { level_id: pair[0] });
    var next = call(SOFIA, 'GET', '/quest/me').data;
    if (next.question && next.question.kind !== 'choice') {
      output.questLevel = pair[1];
      found = true;
    }
  }
  if (!found) throw new Error('None of ' + NUMBER_LEVELS + ' starts with a number question');
}

var answers = typeof ANSWERS === 'undefined' ? 0 : Number(ANSWERS);
for (var i = 0; i < answers; i++) {
  var now = call(SOFIA, 'GET', '/quest/me').data;
  if (!now.question) throw new Error('Sofia has no question to answer at ' + now.level_id);
  call(SOFIA, 'POST', '/quest/answers', {
    question_id: now.question.id,
    answer: now.question.kind === 'choice' ? now.question.choices[0] : '7',
  });
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
