// Saves a review of the assessment seed-canvas-assessment.js made (output.assessmentId) as Alex,
// Sofia's tutor, and saves it as reviewed (Phase 40): one red stroke and a note on question 1, and
// an overall comment. Through the LOCAL Worker only (sign-in off, X-Dev-User).
var ORG = 'chmi';
var ALEX = 'alex.chen.math@gmail.com';

function call(method, path, body) {
  var response = http.request('http://localhost:8787/api' + path, {
    method: method,
    headers: { 'Content-Type': 'application/json', 'X-Dev-User': ALEX, 'X-Organization': ORG },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status >= 300) throw new Error(method + ' ' + path + ' answered ' + response.status + ' ' + response.body);
  return json(response.body);
}

var id = output.assessmentId;
var review = call('GET', '/canvas-assessments/' + id + '/review');
var first = review.data.questions[0].id;
var notes = {};
notes[first] = 'Check the place value.';
call('PUT', '/canvas-assessments/' + id + '/review', {
  comment: 'Good working throughout.',
  notes: notes,
  ink: [{ question_id: first, strokes: ['2 100 100 200 160 300 120'] }],
});
call('POST', '/canvas-assessments/' + id + '/review/finish', {});
