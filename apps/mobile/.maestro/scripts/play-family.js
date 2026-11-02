// Phase 62 (P8): the setup of flows/play/family.yaml, through the LOCAL Worker only (sign-in off,
// X-Dev-User), organization chmi. Run after quest-games-start.js (Quest on, unfinished games ended).
// Priya saves the multiplayer favorite "Family G6" (G6, two questions, everyone on their own, joining
// left open) with Sofia on its roster -- Sofia's id read from the roster route, as the app's dialog does.
// quest-games-end.js deletes the favorite again (it deletes the four flow people's).
var ORG = 'chmi';
var PRIYA = 'priya.raghavan@gmail.com';

function call(method, path, body) {
  var response = http.request('http://localhost:8787/api' + path, {
    method: method,
    headers: { 'Content-Type': 'application/json', 'X-Dev-User': PRIYA, 'X-Organization': ORG },
    body: body === undefined ? (method === 'POST' ? '{}' : undefined) : JSON.stringify(body),
  });
  if (response.status >= 300) throw new Error(method + ' ' + path + ' answered ' + response.status + ' ' + response.body);
  return json(response.body);
}

var members = call('GET', '/quest/games/members').data;
var sofia = null;
for (var i = 0; i < members.length; i++) {
  if (members[i].first_name === 'Sofia') sofia = members[i];
}
if (!sofia) throw new Error('Sofia is not on the roster list for chmi');

call('PUT', '/quest/games/favorites', {
  name: 'Family G6',
  config: {
    level_id: 'NC26.6',
    level_scope: 'level',
    mode: 'count',
    question_count: 2,
    right_points: 1,
    wrong_points: 0,
    knockout: false,
    players: 'multi',
    max_teams: 20,
    max_team_size: 1,
    late_join: true,
  },
  roster: [sofia.id],
});
output.sofiaId = sofia.id;
