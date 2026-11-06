// Puts sharing (Phase 56) back after a sharing/*.yaml flow, through the LOCAL Worker only: PLAYER's
// shares withdrawn, every unfinished game in chmi ended, then Question Quest off again (as the seed has it).
var ORG = 'chmi';
var ADMIN = 'priya.raghavan@gmail.com';
function call(as, method, path, body) {
  var response = http.request('http://localhost:8787/api' + path, {
    method: method,
    headers: { 'Content-Type': 'application/json', 'X-Dev-User': as, 'X-Organization': ORG },
    body: body === undefined ? (method === 'POST' ? '{}' : undefined) : JSON.stringify(body),
  });
  return { status: response.status, body: response.body };
}
var problems = [];
call(ADMIN, 'PATCH', '/organization/settings', { gamify_question_quest: true });
if (typeof PLAYER !== 'undefined' && PLAYER !== '') {
  var list = call(PLAYER, 'GET', '/shares');
  if (list.status < 300) {
    var shares = json(list.body).data;
    for (var s = 0; s < shares.length; s++) {
      if (shares[s].withdrawn_at) continue;
      var gone = call(PLAYER, 'DELETE', '/shares/' + shares[s].id);
      if (gone.status >= 300) problems.push('could not withdraw ' + shares[s].id + ': ' + gone.status);
    }
  } else problems.push('could not list the shares: ' + list.status);
}
var games = call(ADMIN, 'GET', '/quest/games');
if (games.status < 300) {
  var rows = json(games.body).data;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].status !== 'finished') call(ADMIN, 'POST', '/quest/games/' + rows[i].id + '/end');
  }
}
var off = call(ADMIN, 'PATCH', '/organization/settings', { gamify_question_quest: false, canvas_assessments_unreviewed: false });
if (off.status >= 300) problems.push('could not switch Question Quest back off: ' + off.status);
// Checked questions back on for chmi (the platform's switch, on by default; share-game.js turned it off).
var spaces = call('ndessai@gmail.com', 'GET', '/platform/organizations');
if (spaces.status < 300) {
  var rows2 = json(spaces.body).data;
  for (var o = 0; o < rows2.length; o++) {
    if (rows2[o].slug !== ORG || rows2[o].checked_questions) continue;
    var back = call('ndessai@gmail.com', 'PUT', '/platform/organizations/' + rows2[o].id + '/features', {
      feature_tutoring: rows2[o].feature_tutoring,
      feature_assessment: rows2[o].feature_assessment,
      feature_quest: rows2[o].feature_quest,
      checked_questions: true,
    });
    if (back.status >= 300) problems.push('could not switch checked questions back on: ' + back.status);
  }
} else problems.push('could not list the spaces: ' + spaces.status);
if (problems.length > 0) throw new Error('Sharing clean-up: ' + problems.join('; '));
