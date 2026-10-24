// Starts and submits one Grade 4 assessment for Sofia as Priya (chmi), through the LOCAL Worker
// only (sign-in off, X-Dev-User), for the review flow: page 1 carries one stroke, every
// multiple-choice question has choice A. Sets output.assessmentId.
// Phase 50: optional env ORG, ADMIN and STUDENT_ID (the features/* flows submit one in `assess`);
// without STUDENT_ID in another organization, the first student of GET /users?role=student.
var ORG = typeof ORG_SLUG !== 'undefined' && ORG_SLUG ? ORG_SLUG : 'chmi';
var ADMIN = typeof ADMIN_EMAIL !== 'undefined' && ADMIN_EMAIL ? ADMIN_EMAIL : 'priya.raghavan@gmail.com';
var SOFIA_ID = '00000000-0000-4000-8000-000000000008';

function call(method, path, body) {
  var response = http.request('http://localhost:8787/api' + path, {
    method: method,
    headers: { 'Content-Type': 'application/json', 'X-Dev-User': ADMIN, 'X-Organization': ORG },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status >= 300) throw new Error(method + ' ' + path + ' answered ' + response.status + ' ' + response.body);
  return json(response.body);
}

var studentId = typeof STUDENT_ID !== 'undefined' && STUDENT_ID ? STUDENT_ID : null;
if (!studentId && ORG === 'chmi') studentId = SOFIA_ID;
if (!studentId) studentId = call('GET', '/users?role=student&limit=1').data[0].id;
var started = call('POST', '/canvas-assessments', { student_user_id: studentId, level_id: 'NC26.4' });
var id = started.data.id;
var detail = call('GET', '/canvas-assessments/' + id);
var pages = detail.data.questions.map(function (question, index) {
  return {
    question_id: question.id,
    strokes: index === 0 ? ['4 100 100 200 150 300 120 400 200'] : [],
    choice: question.kind === 'choice' ? 0 : null,
  };
});
call('POST', '/canvas-assessments/' + id + '/submit', { pages: pages });
output.assessmentId = id;
