// Phase 63 (P9-P16): turns guest play on (and Grade 4's free questions) for the guest/* flows, and puts
// it all back after, on the LOCAL Worker only (sign-in off, X-Dev-User as the platform admin). The same
// calls as e2e/tests/guest-play.spec.ts. env: ACTION
//   on [ASSESSMENT=true]   PUT /platform/guest (enabled, and the guest Assessment when asked), then
//                          Grade 4's pool from GET /platform/guest/pools/NC26.4's `suggestion`
//   off                    the settings back to their defaults (guest play off), then every pool
//                          emptied (switching guest play on fills each open level's), so every other
//                          flow meets the sign-in screen and the full bank as before
// The Worker's GUEST_PLAY must allow it (".dev.vars"). Errors are thrown on `on`, tolerated on `off`.
var API = 'http://localhost:8787/api';
var PLATFORM_ADMIN = 'ndessai@gmail.com';
var LEVEL = 'NC26.4';
// GuestSettings' defaults (DEFAULT_GUEST_SETTINGS in packages/shared), as the e2e spec's DEFAULTS.
var DEFAULTS = {
  enabled: false,
  assessment_enabled: false,
  assessment_questions: 5,
  nudge_after: 1,
  nudge_cooldown_hours: 24,
  nudge_right: 'Nice! That one is right.',
  nudge_wrong: 'Good try. Keep going!',
  home_bar: 'Playing as a guest. Sign up free to save scores and unlock every quest.',
};

function call(method, path, body) {
  var response = http.request(API + path, {
    method: method,
    headers: { 'Content-Type': 'application/json', 'X-Dev-User': PLATFORM_ADMIN },
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
  return result;
}

function settings(on) {
  var next = {};
  for (var key in DEFAULTS) next[key] = DEFAULTS[key];
  next.enabled = on;
  next.assessment_enabled = on && typeof ASSESSMENT !== 'undefined' && String(ASSESSMENT) === 'true';
  return next;
}

if (ACTION === 'on') {
  must(call('PUT', '/platform/guest/pools/' + LEVEL, { level_id: LEVEL, question_ids: [] }), 'clearing the pool');
  var guest = must(call('PUT', '/platform/guest', settings(true)), 'guest play on').body.data;
  if (!guest.address_allows) throw new Error('This Worker does not allow guest play: set GUEST_PLAY in .dev.vars');
  var pool = must(call('GET', '/platform/guest/pools/' + LEVEL), 'the suggestion').body.data;
  var ids = pool.suggestion.map(function (q) {
    return q.id;
  });
  if (ids.length < 5) throw new Error('Grade 4 suggests only ' + ids.length + ' questions');
  must(call('PUT', '/platform/guest/pools/' + LEVEL, { level_id: LEVEL, question_ids: ids }), 'the pool');
  output.poolSize = ids.length;
} else if (ACTION === 'off') {
  call('PUT', '/platform/guest', settings(false));
  var consoleNow = call('GET', '/platform/guest').body;
  var pools = consoleNow && consoleNow.data ? consoleNow.data.pools : [{ level_id: LEVEL, size: 1 }];
  for (var i = 0; i < pools.length; i++) {
    if (pools[i].size > 0) {
      call('PUT', '/platform/guest/pools/' + pools[i].level_id, { level_id: pools[i].level_id, question_ids: [] });
    }
  }
} else {
  throw new Error('guest-play.js: unknown ACTION ' + ACTION);
}
