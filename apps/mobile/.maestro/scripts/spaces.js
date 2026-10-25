// Phase 52 (design 63): sets up and puts back what the spaces/* flows change, on the LOCAL Worker
// only (sign-in off, X-Dev-User). env: ACTION and its arguments:
//   reset-newcomer EMAIL         every space the address made is deleted, any other left, its open
//                                requests withdrawn, then the account deleted (nothing there: fine)
//   signup EMAIL NAME [YEAR]     POST /auth/signup with dev_email (an adult unless YEAR says otherwise)
//   make-space EMAIL NAME        POST /spaces; outputs slug, code and codeShown (either way it reads)
//   ask EMAIL CODE               POST /spaces/join-requests (already asked: fine)
//   seen EMAIL                   POST /spaces/join-requests/seen
//   withdraw EMAIL SLUG          DELETE /spaces/join-requests/:slug (none: fine)
//   tour-done EMAIL ORG          the person has been through the welcome wizard there (skipped)
//   trust ORG_SLUG ON            as the platform admin, the space's Quest trust ('true' / 'false')
// Errors are tolerated where it cleans. The server loosens its rate limits twenty times away from
// production, so a 429 should not happen; signing up still waits one out, as a fallback.
var API = 'http://localhost:8787/api';
// The versions a newcomer accepts: equal to TERMS_VERSION / PRIVACY_VERSION in packages/shared
// (src/test/maestro-scripts.test.ts checks it, so a new wording date fails in Jest, not here).
var TERMS_VERSION = '2026-10-24';
var PRIVACY_VERSION = '2026-10-24';
var PLATFORM_ADMIN = 'ndessai@gmail.com';

function call(as, method, path, body, org) {
  var headers = { 'Content-Type': 'application/json', 'X-Dev-User': as };
  if (org) headers['X-Organization'] = org;
  var response = http.request(API + path, {
    method: method,
    headers: headers,
    // Maestro's http refuses a POST without a body.
    body: body === undefined ? (method === 'POST' || method === 'PUT' ? '{}' : undefined) : JSON.stringify(body),
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

/** Maestro's JS has no sleep: waits out a rate limit by asking the health route until it passes. */
function waitAMinute() {
  var until = Date.now() + 65000;
  while (Date.now() < until) http.get(API + '/health');
}

var email = typeof EMAIL === 'undefined' ? '' : String(EMAIL).toLowerCase();

if (ACTION === 'reset-newcomer') {
  var session = call(email, 'GET', '/auth/session');
  if (session.status < 300 && session.body && session.body.data) {
    var data = session.body.data;
    (data.memberships || []).forEach(function (m) {
      if (m.status !== 'active') return;
      var inside = call(email, 'GET', '/auth/session', undefined, m.slug);
      var org = inside.body && inside.body.data && inside.body.data.organization;
      var roles = (inside.body && inside.body.data && inside.body.data.user && inside.body.data.user.roles) || [];
      if (org && org.created_via === 'self_serve' && roles.indexOf('admin') >= 0) {
        call(email, 'DELETE', '/organization', { confirm_name: org.name }, m.slug);
      } else {
        call(email, 'POST', '/organization/leave', undefined, m.slug);
      }
    });
    (data.join_requests || []).forEach(function (r) {
      if (r.outcome === null) call(email, 'DELETE', '/spaces/join-requests/' + r.slug);
    });
    call(email, 'DELETE', '/auth/account');
  }
} else if (ACTION === 'signup') {
  var body = {
    dev_email: email,
    dev_name: NAME,
    birth_year: typeof YEAR === 'undefined' ? 1990 : Number(YEAR),
    birth_month: 6,
    terms_version: TERMS_VERSION,
    privacy_version: PRIVACY_VERSION,
  };
  var made = call(email, 'POST', '/auth/signup', body);
  if (made.status === 429) {
    waitAMinute();
    made = call(email, 'POST', '/auth/signup', body);
  }
  must(made, 'signing up ' + email);
} else if (ACTION === 'make-space') {
  var space = must(call(email, 'POST', '/spaces', { name: NAME }), 'making ' + NAME).body.data;
  output.slug = space.slug;
  output.code = must(call(email, 'GET', '/organization/code', undefined, space.slug), 'its code').body.data.code;
  // How the Space screen reads it out (an iOS element's text is its label): "Code F M X Y, 2 3 4 5".
  output.codeShown =
    '(' + output.code + '|Code ' + output.code.split('-').map(function (p) { return p.split('').join(' '); }).join(', ') + ')';
} else if (ACTION === 'ask') {
  var asked = call(email, 'POST', '/spaces/join-requests', { code: CODE });
  if (asked.status >= 300 && asked.status !== 409) must(asked, 'asking to join');
} else if (ACTION === 'seen') {
  call(email, 'POST', '/spaces/join-requests/seen');
} else if (ACTION === 'withdraw') {
  call(email, 'DELETE', '/spaces/join-requests/' + SLUG);
} else if (ACTION === 'tour-done') {
  must(call(email, 'POST', '/onboarding/tour', { outcome: 'skipped' }, ORG), 'the wizard');
} else if (ACTION === 'trust') {
  var list = must(call(PLATFORM_ADMIN, 'GET', '/platform/organizations'), 'the console').body.data;
  var target = list.filter(function (o) {
    return o.slug === ORG_SLUG;
  })[0];
  if (!target) throw new Error('no organization ' + ORG_SLUG);
  must(
    call(PLATFORM_ADMIN, 'PUT', '/platform/organizations/' + target.id + '/features', {
      feature_tutoring: target.feature_tutoring,
      feature_assessment: target.feature_assessment,
      feature_quest: target.feature_quest,
      quest_trusted: String(ON) === 'true',
    }),
    'the trust',
  );
} else {
  throw new Error('spaces.js: unknown ACTION ' + ACTION);
}
