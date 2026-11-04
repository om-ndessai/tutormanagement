// Phase 64 (P17-P20) for play/habit.yaml, through the LOCAL Worker only (sign-in off, X-Dev-User),
// organization chmi, after quest-games-start.js has Quest on. The console's Daily set switch on (its
// default; a console flow may have left it off), as the platform admin. Then, as Sofia, the first of her
// count tiles whose level's Daily she has not played today -- one Daily a day per person and level, and
// the runner does not reset the database between the iOS and the Android run, so each run takes a fresh
// level. Outputs habitTile (its code, e.g. G4Q5), habitLevel (NC26.4), habitTag (G4) and habitGrade (4,
// Phase 67: the Quest board's grade; the tile is a grade's own NC 2026 level).
var API = 'http://localhost:8787/api';
var ORG = 'chmi';
var SOFIA = 'sofia.okafor@gmail.com';
var PLATFORM_ADMIN = 'ndessai@gmail.com';

function call(who, method, path, body, org) {
  var headers = { 'Content-Type': 'application/json', 'X-Dev-User': who };
  if (org) headers['X-Organization'] = org;
  var response = http.request(API + path, {
    method: method,
    headers: headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  var parsed = null;
  try {
    parsed = response.body ? json(response.body) : null;
  } catch (e) {
    parsed = null;
  }
  return { status: response.status, body: parsed };
}

function must(result, what) {
  if (result.status >= 300) throw new Error(what + ' answered ' + result.status + ' ' + JSON.stringify(result.body));
  return result.body.data;
}

var play = must(call(PLATFORM_ADMIN, 'GET', '/platform/play'), 'the Play settings');
if (!play.settings.daily) {
  var tiles = play.tiles.map(function (tile) {
    return { kind: tile.kind, level_id: tile.level_id, mode: tile.mode, value: tile.value, guest: tile.guest, members: tile.members };
  });
  var settings = {};
  for (var key in play.settings) settings[key] = play.settings[key];
  settings.daily = true;
  must(call(PLATFORM_ADMIN, 'PUT', '/platform/play', { settings: settings, tiles: tiles }), 'the Daily set on');
}

var mine = must(call(SOFIA, 'GET', '/quest/tiles', undefined, ORG), "Sofia's tiles");
if (!mine.daily) throw new Error('The tiles say the Daily set is off');
var chosen = null;
for (var i = 0; i < mine.tiles.length && !chosen; i++) {
  var tile = mine.tiles[i];
  // Phase 67: a grade's own level (NC 2026), so the flow can choose its grade on the Quest board.
  if (tile.kind !== 'quest' || tile.mode !== 'count' || !/^NC26\.[1-8]$/.test(tile.level_id)) continue;
  var daily = call(SOFIA, 'GET', '/quest/daily/' + encodeURIComponent(tile.level_id), undefined, ORG);
  if (daily.status < 300 && daily.body.data.result === null && daily.body.data.questions.length > 0) chosen = tile;
}
if (!chosen) throw new Error("Sofia has played every tile level's Daily today: reset the database (npm run db:reset)");
output.habitTile = chosen.code;
output.habitLevel = chosen.level_id;
output.habitTag = chosen.code.replace(/[QTA]\d+$/, '');
output.habitGrade = chosen.level_id.slice(-1);
