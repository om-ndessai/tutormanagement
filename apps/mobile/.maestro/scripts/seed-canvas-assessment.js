// Starts and submits one Grade 4 assessment for Sofia as Priya (chmi), through the LOCAL Worker
// only (sign-in off, X-Dev-User), for the review flow: page 1 carries one stroke, every
// multiple-choice question has choice A. Sets output.assessmentId.
var ORG = 'chmi';
var ADMIN = 'priya.raghavan@gmail.com';
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

var started = call('POST', '/canvas-assessments', { student_user_id: SOFIA_ID, level_id: 'NC26.4' });
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
