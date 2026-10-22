// Puts Quest Games (Phase 46) back as the seed has it, before and after every quest/game-*.yaml flow,
// whatever happened in between: Sofia's Quest level cleared, every unfinished game in chmi ended (as Priya, an admin, whose list
// is every game), then "include questions not yet reviewed" off (the Assessment menu's flows expect
// it off, clean-canvas-assessments.js) and Question Quest off. Phase 47: every favorite of the four
// people the game flows sign in as is deleted too, so a rerun starts with none. Through the LOCAL
// Worker only.
var ORG = 'chmi';
var ADMIN = 'priya.raghavan@gmail.com';
var PLAYERS = [
  'priya.raghavan@gmail.com',
  'anita.patel.nc@gmail.com',
  'sofia.okafor@gmail.com',
  'alex.chen.math@gmail.com',
];

function call(method, path, body, as) {
  var response = http.request('http://localhost:8787/api' + path, {
    method: method,
    headers: { 'Content-Type': 'application/json', 'X-Dev-User': as || ADMIN, 'X-Organization': ORG },
    // Maestro's http refuses a POST without a body.
    body: body === undefined ? (method === 'POST' ? '{}' : undefined) : JSON.stringify(body),
  });
  return { status: response.status, body: response.body };
}

var problems = [];
// Every games route answers 403 while Quest is off: on first, to end what is left.
var on = call('PATCH', '/organization/settings', { gamify_question_quest: true });
if (on.status >= 300) problems.push('could not reach Question Quest: ' + on.status + ' ' + on.body);
// Sofia's Quest level cleared, as quest-end.js does: with one, signing in would take her into Quest.
var level = call('PUT', '/quest/students/00000000-0000-4000-8000-000000000008/level', { level_id: null });
if (level.status >= 300) problems.push("could not clear Sofia's level: " + level.status);
var list = call('GET', '/quest/games');
if (list.status < 300) {
  var games = json(list.body).data;
  for (var i = 0; i < games.length; i++) {
    if (games[i].status === 'finished') continue;
    var ended = call('POST', '/quest/games/' + games[i].id + '/end');
    if (ended.status >= 300) problems.push('could not end ' + games[i].code + ': ' + ended.status);
  }
} else {
  problems.push('could not list the games: ' + list.status);
}
// Favorites are each person's own (R20): listed and deleted as each of them.
for (var p = 0; p < PLAYERS.length; p++) {
  var mine = call('GET', '/quest/games/favorites', undefined, PLAYERS[p]);
  if (mine.status >= 300) {
    problems.push('could not list the favorites of ' + PLAYERS[p] + ': ' + mine.status);
    continue;
  }
  var favorites = json(mine.body).data;
  for (var f = 0; f < favorites.length; f++) {
    var gone = call('DELETE', '/quest/games/favorites/' + favorites[f].id, undefined, PLAYERS[p]);
    if (gone.status >= 300) problems.push('could not delete a favorite: ' + gone.status);
  }
}
var off = call('PATCH', '/organization/settings', { gamify_question_quest: false, canvas_assessments_unreviewed: false });
if (off.status >= 300) throw new Error('Could not switch Question Quest back off: ' + off.status + ' ' + off.body);
if (problems.length > 0) throw new Error('Quest Games clean-up: ' + problems.join('; '));
