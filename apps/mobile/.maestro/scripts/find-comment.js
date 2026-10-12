// Finds the comment a flow just posted, by its text, in one thread on the LOCAL Worker, and puts its
// id in output.commentId. env: AS (an email), ORG, TARGET_TYPE, TARGET_ID, BODY_TEXT. Never anything
// but localhost.
var response = http.get(
  'http://localhost:8787/api/comments?target_type=' + TARGET_TYPE + '&target_id=' + TARGET_ID,
  { headers: { 'X-Dev-User': AS, 'X-Organization': ORG } },
);
if (response.status >= 300) throw new Error('GET thread answered ' + response.status);
var comments = json(response.body).data.comments;
var found = comments.filter(function (comment) {
  return comment.body === BODY_TEXT;
})[0];
if (!found) throw new Error('No comment reading "' + BODY_TEXT + '"');
output.commentId = found.id;
