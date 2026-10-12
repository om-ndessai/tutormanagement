// Records a lesson yesterday for STUDENT_ID with TUTOR_EMAIL as the tutor, through the LOCAL
// Worker (sign-in off, X-Dev-User), so a dashboard has a recent lesson waiting for a reflection:
// the seed's lessons are older than the 21-day prompt window. Sets output.sessionId.
// Changes data: the runner resets the database after the suite.
var DAY = 24 * 60 * 60 * 1000;
// Yesterday on the organization's clock (America/New_York is at most five hours behind UTC).
var yesterday = new Date(Date.now() - DAY - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
var response = http.post('http://localhost:8787/api/sessions', {
  headers: {
    'Content-Type': 'application/json',
    'X-Dev-User': TUTOR_EMAIL,
    'X-Organization': ORG,
  },
  body: JSON.stringify({
    tutor_user_id: TUTOR_ID,
    student_user_id: STUDENT_ID,
    occurred_on: yesterday,
    started_at: '15:00',
    ended_at: '16:00',
    mode: 'in_person',
  }),
});
if (response.status !== 201 && response.status !== 200) {
  throw new Error('Could not record the lesson: ' + response.status + ' ' + response.body);
}
output.sessionId = json(response.body).data.id;
