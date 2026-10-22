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
// quest-games-end.js puts both switches back off after every flow.
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

var setup = typeof SETUP === 'undefined' ? '' : SETUP;
if (setup !== '') {
  var game = call('priya', 'POST', '/quest/games', {
    level_id: 'NC26.6',
    mode: 'count',
    question_count: 2,
    negative_marking: false,
    max_team_size: setup === 'play' ? 1 : 2,
  }).data;
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
  if (setup === 'play') call('sofia', 'POST', '/quest/games/' + game.id + '/join', { as: 'solo' });
  if (setup === 'play' || setup === 'team-play') call('priya', 'POST', '/quest/games/' + game.id + '/start');
  if (setup === 'team-play') {
    // Alex is served first; Sofia, on opening the game, gets the other question of the two.
    var alexHand = call('alex', 'GET', '/quest/games/' + game.id).data.me.question;
    if (!alexHand) throw new Error('Alex was served no question');
    output.sofiaNumber = String(3 - alexHand.number);
  }
}
