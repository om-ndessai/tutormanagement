// The question bank's counts as the API gives them, for the question-bank/* flows (#54): they assert
// these, never a seed count that other flows (or an earlier run) change. Reads the coverage as Nav,
// the platform admin. Outputs `waiting` (checked, the review queue's length), `approved`, `flagged`,
// `atTarget` (standards askable in text with two approved at each difficulty) and `askable`. With
// TOPIC (a topic id) it also reads that standard's questions and outputs each status's count there:
// `topicDraft`, `topicChecked`, `topicFlagged`, `topicApproved`, `topicRetired`.
// Never anything but localhost.
function get(path) {
  var response = http.request('http://localhost:8787/api' + path, {
    method: 'GET',
    headers: { 'X-Dev-User': 'ndessai@gmail.com' },
  });
  if (response.status !== 200) {
    throw new Error('GET ' + path + ' answered ' + response.status + ' ' + response.body);
  }
  return json(response.body).data;
}

var levels = get('/platform/questions/coverage');
var waiting = 0;
var approved = 0;
var flagged = 0;
var atTarget = 0;
var askable = 0;
levels.forEach(function (level) {
  level.topics.forEach(function (topic) {
    waiting += topic.checked;
    flagged += topic.flagged;
    approved += topic.approved[0] + topic.approved[1] + topic.approved[2];
    if (!topic.needs_figure) {
      askable += 1;
      if (topic.approved[0] >= 2 && topic.approved[1] >= 2 && topic.approved[2] >= 2) atTarget += 1;
    }
  });
});
output.waiting = waiting;
output.approved = approved;
output.flagged = flagged;
output.atTarget = atTarget;
output.askable = askable;

if (typeof TOPIC !== 'undefined' && TOPIC) {
  var counts = { draft: 0, checked: 0, flagged: 0, approved: 0, retired: 0 };
  get('/platform/questions?topic_id=' + encodeURIComponent(TOPIC) + '&limit=200').forEach(function (q) {
    counts[q.status] += 1;
  });
  output.topicDraft = counts.draft;
  output.topicChecked = counts.checked;
  output.topicFlagged = counts.flagged;
  output.topicApproved = counts.approved;
  output.topicRetired = counts.retired;
}
