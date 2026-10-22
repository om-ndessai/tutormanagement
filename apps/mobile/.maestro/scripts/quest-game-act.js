// Quest Games (Phase 46): one act by another player in the middle of a quest/game-*.yaml flow, since
// a flow drives one device. Through the LOCAL Worker only (sign-in off, X-Dev-User), organization
// chmi. env AS (alex, sofia, priya or anita), ACTION:
// - join-solo:   looks up CODE (a game's code, as typed) and joins it on their own. Without a CODE
//                (or with an empty one), the newest game in a lobby that HOST (default anita) hosts.
// - skip-all:    skips every question served to AS until the team has none left for them (GAME, or
//                the newest running game AS is in). It first waits (up to 12 s) for a question to be
//                served, so it does not stop at once inside the doors' countdown (Phase 47).
// - answer-wrong: answers the question in AS's hand with "not-an-answer" (the web spec's WRONG),
//                after waiting for one in the same way.
// - start:       begins GAME (AS must host it).
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

var GIVEN = {
  CODE: typeof CODE === 'undefined' || CODE === '' ? null : CODE,
  HOST: typeof HOST === 'undefined' || HOST === '' ? null : HOST,
  GAME: typeof GAME === 'undefined' || GAME === '' ? null : GAME,
};

if (!PEOPLE[AS]) throw new Error('Unknown player ' + AS);

/**
 * The question in AS's hand once one is served: polls the local Worker (no sleep in Maestro's JS) for
 * at most 12 s while the game is running and the doors are still counting down. Null when none comes.
 */
function served(id) {
  var deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    var view = call(AS, 'GET', '/quest/games/' + id).data;
    if (view.status !== 'running') return null;
    if (view.me.question) return view.me.question;
    // Under way and nothing in hand: the team has nothing left for AS.
    if (view.started_at !== null && Date.parse(view.now) >= Date.parse(view.started_at)) return null;
  }
  return null;
}

function newest(who, status) {
  var games = call(who, 'GET', '/quest/games').data;
  for (var i = 0; i < games.length; i++) if (games[i].status === status) return games[i];
  throw new Error('No ' + status + ' game for ' + who);
}

if (ACTION === 'join-solo') {
  var code = GIVEN.CODE;
  var gameId;
  if (code) {
    gameId = call(AS, 'POST', '/quest/games/lookup', { code: code }).data.game_id;
  } else {
    gameId = newest(GIVEN.HOST || 'anita', 'lobby').id;
  }
  call(AS, 'POST', '/quest/games/' + gameId + '/join', { as: 'solo' });
} else if (ACTION === 'skip-all') {
  var id = GIVEN.GAME || newest(AS, 'running').id;
  var first = served(id);
  for (var n = 0; n < 200 && first; n++) {
    var view = call(AS, 'GET', '/quest/games/' + id).data;
    if (view.status !== 'running' || !view.me.question) break;
    call(AS, 'POST', '/quest/games/' + id + '/answer', { question_id: view.me.question.id, skip: true });
  }
} else if (ACTION === 'answer-wrong') {
  var gid = GIVEN.GAME || newest(AS, 'running').id;
  var held = served(gid);
  if (!held) throw new Error(AS + ' holds no question to answer');
  call(AS, 'POST', '/quest/games/' + gid + '/answer', { question_id: held.id, answer: 'not-an-answer' });
} else if (ACTION === 'start') {
  call(AS, 'POST', '/quest/games/' + GIVEN.GAME + '/start');
} else {
  throw new Error('Unknown action ' + ACTION);
}
