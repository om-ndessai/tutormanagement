// Question Quest (Phase 42)'s "nothing left" flow needs a level with no question to serve. Every bank
// level has questions since 2026-10-22 (round four), so -- as the web's quest.spec.ts does -- Math
// Modeling (NC26.MSM, in no family, so nothing follows it) is emptied for the flow by marking its
// standards "needs a figure", which Quest skips; env MARK=false puts them back. As the platform admin,
// through the LOCAL Worker only (sign-in off, X-Dev-User; the console needs no organization).
var PLATFORM = 'ndessai@gmail.com';

function call(method, path, body) {
  var response = http.request('http://localhost:8787/api' + path, {
    method: method,
    headers: { 'Content-Type': 'application/json', 'X-Dev-User': PLATFORM },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status >= 300) throw new Error(method + ' ' + path + ' answered ' + response.status + ' ' + response.body);
  return json(response.body);
}

var needsFigure = typeof MARK === 'undefined' ? true : MARK !== 'false';
var coverage = call('GET', '/platform/questions/coverage').data;
var level = coverage.filter(function (l) {
  return l.level_id === 'NC26.MSM';
})[0];
if (!level) throw new Error('The bank has no Math Modeling level');
for (var i = 0; i < level.topics.length; i++) {
  call('PATCH', '/platform/questions/topics/' + level.topics[i].topic_id, { needs_figure: needsFigure });
}
