// Quest Games (Phase 46) for a quest/game-*.yaml flow, through the LOCAL Worker only (sign-in off,
// X-Dev-User), organization chmi. As Priya (an admin): Question Quest on, and "include questions not
// yet reviewed" on (the seed has few approved questions, as the web spec does); then every unfinished
// game left by an earlier run is ended, so a list or a code never finds a stale one. With env SETUP,
// the game the flow starts from (G6, NC26.6, two questions, right +1 / wrong 0):
// - host:      Priya hosts it, teams of up to 2. Outputs gameId, gameCode, gameCodeLower.
// - team:      as host, and Alex starts the team "Owls". Also outputs teamCode.
// - play:      Priya hosts it, everyone on their own; Sofia joins on her own; Priya begins.
// - team-play: Priya hosts it, teams of up to 2; Alex starts "Owls", Sofia joins it by its code;
//              Priya begins; Alex is served first. Also outputs sofiaNumber (the other of 1 and 2).
// These four send Phase 46's request on purpose (an older app's still works). Phase 47's, in the new
// form (design 61):
// - late:      Priya hosts it, everyone on their own, joining left open; Alex joins; Priya begins.
// - single:    Priya's single-player game (running at once, Priya its one player).
// - knockout:  everyone on their own, at most 2, wrong -3, knockout; Alex and Sofia join; Priya begins.
// After every start the script waits out the doors' countdown (GAME_COUNTDOWN_MS, by the server's
// clock), so a question is served when the flow goes on. quest-games-end.js puts both switches back
// off, and deletes the four people's favorites, after every flow.
var ORG = 'chmi';
var PEOPLE = {
  priya: 'priya.raghavan@gmail.com',
  alex: 'alex.chen.math@gmail.com',
  sofia: 'sofia.okafor@gmail.com',
  anita: 'anita.patel.nc@gmail.com',
};

function call(who, method, path, body) {
  var response = http.request('http://localhost:8787/api' + path, {
    method: method,
    headers: { 'Content-Type': 'application/json', 'X-Dev-User': PEOPLE[who], 'X-Organization': ORG },
    // Maestro's http refuses a POST without a body.
    body: body === undefined ? (method === 'POST' ? '{}' : undefined) : JSON.stringify(body),
  });
  if (response.status >= 300) throw new Error(method + ' ' + path + ' as ' + who + ' answered ' + response.status + ' ' + response.body);
  return json(response.body);
}

call('priya', 'PATCH', '/organization/settings', { gamify_question_quest: true, canvas_assessments_unreviewed: true });

// An admin's list is every game in the organization.
var games = call('priya', 'GET', '/quest/games').data;
for (var i = 0; i < games.length; i++) {
  if (games[i].status !== 'finished') call('priya', 'POST', '/quest/games/' + games[i].id + '/end');
}

/**
 * Waits until the game's first question is served: the server's `now` past `started_at` (Maestro's JS
 * has no sleep, so it asks the local Worker again until then, for at most ten seconds).
 */
function waitForStart(who, id) {
  var deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    var view = call(who, 'GET', '/quest/games/' + id).data;
    if (view.status !== 'running' || view.started_at === null) return view;
    if (Date.parse(view.now) >= Date.parse(view.started_at)) return view;
  }
  throw new Error('The game ' + id + ' did not begin within ten seconds');
}

var PHASE_47 = { late: true, single: true, knockout: true };
var setup = typeof SETUP === 'undefined' ? '' : SETUP;
if (setup !== '') {
  var request = PHASE_47[setup]
    ? {
        level_id: 'NC26.6',
        level_scope: 'level',
        mode: 'count',
        question_count: 2,
        right_points: 1,
        wrong_points: setup === 'knockout' ? -3 : 0,
        knockout: setup === 'knockout',
        players: setup === 'single' ? 'single' : 'multi',
        max_teams: setup === 'knockout' ? 2 : 20,
        max_team_size: 1,
        late_join: setup === 'late',
      }
    : {
        level_id: 'NC26.6',
        mode: 'count',
        question_count: 2,
        negative_marking: false,
        max_team_size: setup === 'play' ? 1 : 2,
      };
  if (setup === 'single') delete request.max_teams;
  var game = call('priya', 'POST', '/quest/games', request).data;
  output.gameId = game.id;
  output.gameCode = game.code;
  output.gameCodeLower = game.code.toLowerCase();

  if (setup === 'team' || setup === 'team-play') {
    var joined = call('alex', 'POST', '/quest/games/' + game.id + '/join', { as: 'new_team', team_name: 'Owls' }).data;
    var owls = null;
    for (var t = 0; t < joined.teams.length; t++) if (joined.teams[t].name === 'Owls') owls = joined.teams[t];
    if (!owls || !owls.code) throw new Error('Alex started Owls but its code was not returned');
    output.teamCode = owls.code;
    if (setup === 'team-play') {
      call('sofia', 'POST', '/quest/games/' + game.id + '/join', { as: 'team', team_code: owls.code });
    }
  }
  if (setup === 'play' || setup === 'knockout') {
    call('sofia', 'POST', '/quest/games/' + game.id + '/join', { as: 'solo' });
  }
  if (setup === 'late' || setup === 'knockout') {
    call('alex', 'POST', '/quest/games/' + game.id + '/join', { as: 'solo' });
  }
  if (setup === 'play' || setup === 'team-play' || setup === 'late' || setup === 'knockout') {
    call('priya', 'POST', '/quest/games/' + game.id + '/start');
  }
  // A single player's game is under way at once; every started one counts down first.
  if (setup !== 'host' && setup !== 'team') waitForStart('priya', game.id);
  if (setup === 'team-play') {
    // Alex is served first; Sofia, on opening the game, gets the other question of the two.
    var alexHand = call('alex', 'GET', '/quest/games/' + game.id).data.me.question;
    if (!alexHand) throw new Error('Alex was served no question');
    output.sofiaNumber = String(3 - alexHand.number);
  }
}
