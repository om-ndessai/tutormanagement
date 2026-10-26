// Sharing Quest (Phase 56) for a sharing/*.yaml flow, through the LOCAL Worker only (sign-in off,
// X-Dev-User), organization chmi. Question Quest on (as Priya, an admin), "include questions not yet
// reviewed" OFF (a game then draws approved questions only, which a challenge needs), every unfinished
// game ended, and every share of PLAYER withdrawn. With env PLAYER (an email), it plays PLAYER's
// single-player game of two questions on NC26.4 (G4) to the end -- the first right, the second wrong --
// as sharing.spec.ts does on the web. Outputs gameId, gameCode. The keys are the twelve APPROVED
// questions of apps/api/db/questions/NC26.4.json (Maestro's JS cannot read files); the local seed's
// sample carries them all.
var ORG = 'chmi';
var ADMIN = 'priya.raghavan@gmail.com';
var KEYS = {
  '9b000000-0000-4000-8000-000000000001': '7000',
  '9b000000-0000-4000-8000-000000000002': '42,605',
  '9b000000-0000-4000-8000-000000000003': '36409',
  '9b000000-0000-4000-8000-000000000004': '$56{,}091 < 56{,}109$',
  '9b000000-0000-4000-8000-000000000005': '10',
  '9b000000-0000-4000-8000-000000000006': '70,215; 70,512; 75,021',
  '9b000000-0000-4000-8000-000000000007': '6767',
  '9b000000-0000-4000-8000-000000000008': '6,000',
  '9b000000-0000-4000-8000-000000000009': '56265',
  '9b000000-0000-4000-8000-000000000010': '35625',
  '9b000000-0000-4000-8000-000000000011': '47,129',
  '9b000000-0000-4000-8000-000000000012': '35915',
};

function call(as, method, path, body) {
  var response = http.request('http://localhost:8787/api' + path, {
    method: method,
    headers: { 'Content-Type': 'application/json', 'X-Dev-User': as, 'X-Organization': ORG },
    // Maestro's http refuses a POST without a body.
    body: body === undefined ? (method === 'POST' ? '{}' : undefined) : JSON.stringify(body),
  });
  if (response.status >= 300) throw new Error(method + ' ' + path + ' as ' + as + ' answered ' + response.status + ' ' + response.body);
  return response.body ? json(response.body) : null;
}

call(ADMIN, 'PATCH', '/organization/settings', { gamify_question_quest: true, canvas_assessments_unreviewed: false });
var games = call(ADMIN, 'GET', '/quest/games').data;
for (var i = 0; i < games.length; i++) {
  if (games[i].status !== 'finished') call(ADMIN, 'POST', '/quest/games/' + games[i].id + '/end');
}

var player = typeof PLAYER === 'undefined' ? '' : PLAYER;
if (player !== '') {
  var shares = call(player, 'GET', '/shares').data;
  for (var s = 0; s < shares.length; s++) {
    if (!shares[s].withdrawn_at) call(player, 'DELETE', '/shares/' + shares[s].id);
  }

  var game = call(player, 'POST', '/quest/games', {
    level_id: 'NC26.4',
    level_scope: 'level',
    mode: 'count',
    question_count: 2,
    right_points: 1,
    wrong_points: 0,
    knockout: false,
    players: 'single',
    max_team_size: 1,
    late_join: false,
  }).data;
  output.gameId = game.id;
  output.gameCode = game.code;

  // The doors count down first (Maestro's JS has no sleep: ask again until the server's clock is past).
  var deadline = Date.now() + 15000;
  var plan = ['right', 'wrong'];
  var step = 0;
  while (step < plan.length) {
    if (Date.now() > deadline) throw new Error('The game ' + game.id + ' did not serve its questions in time');
    var view = call(player, 'GET', '/quest/games/' + game.id).data;
    if (Date.parse(view.now) < Date.parse(view.started_at) || !view.me.question) continue;
    var question = view.me.question;
    var key = KEYS[question.id];
    if (!key) throw new Error('The served question ' + question.id + ' is not one of the approved twelve');
    call(player, 'POST', '/quest/games/' + game.id + '/answer', {
      question_id: question.id,
      answer: plan[step] === 'right' ? key : 'not-an-answer',
    });
    step += 1;
  }
  var done = call(player, 'GET', '/quest/games/' + game.id).data;
  if (done.status !== 'finished') throw new Error('The game ' + game.id + ' did not finish: ' + done.status);
}
