// Phase 65 (docs/access-approval-plan.md): sign-up access for the platform/access flow, on the LOCAL
// Worker only (sign-in off, X-Dev-User as the platform admin). The same routes as the console. env: ACTION
//   find EMAIL      outputs access.userId: the account with that email among those waiting or decided
//   reset [EMAIL]   the mode back to Open, and that account (if any) approved, so spaces.js
//                   reset-newcomer may act as it and delete it. Errors are tolerated: it cleans.
// Phase 80 (docs/members-plan.md, A10-A13):
//   mode MODE                     the console's Sign-up access: open, preapproved or postapproved
//   pending EMAIL NAME [YEAR]     Post-approved on, then EMAIL signs up (POST /auth/signup, dev_email; an adult unless
//                                 YEAR says otherwise) and waits: the 403 access_pending is the answer expected.
//                                 Outputs access.userId
//   approve EMAIL [ORG] [ROLE]    the platform admin approves EMAIL -- placed in ORG (a slug) as ROLE (member, the
//                                 default, or admin) when ORG is given, else with no place (their own space is made
//                                 if they belong nowhere). Outputs access.userId
//   count EMAIL                   outputs access.spaces: how many spaces the person belongs to (the console's people
//                                 lookup, which reads a pending account too)
// (The JSON bodies are built here: Maestro misreads a YAML value mixing JSON braces with ${...}.)
var API = 'http://localhost:8787/api';
var PLATFORM_ADMIN = 'ndessai@gmail.com';
// The versions a newcomer accepts: equal to TERMS_VERSION / PRIVACY_VERSION in packages/shared
// (src/test/maestro-scripts.test.ts checks it, as for spaces.js).
var TERMS_VERSION = '2026-11-04';
var PRIVACY_VERSION = '2026-11-04';

function call(method, path, body, as) {
  var response = http.request(API + path, {
    method: method,
    headers: { 'Content-Type': 'application/json', 'X-Dev-User': as || PLATFORM_ADMIN },
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

function accountFor(email) {
  var now = call('GET', '/platform/access').body;
  if (!now || !now.data) return null;
  var all = now.data.waiting.concat(now.data.decided);
  var wanted = String(email).toLowerCase();
  for (var i = 0; i < all.length; i++) {
    if (all[i].email && all[i].email.toLowerCase() === wanted) return all[i];
  }
  return null;
}

function must(result, what) {
  if (result.status >= 300) throw new Error(what + ' answered ' + result.status + ' ' + JSON.stringify(result.body));
  return result;
}

/** A space's id by its slug, from the console's list. */
function spaceIdFor(slug) {
  var list = must(call('GET', '/platform/organizations'), 'the console').body.data;
  for (var i = 0; i < list.length; i++) {
    if (list[i].slug === slug) return list[i].id;
  }
  throw new Error('No space ' + slug);
}

if (ACTION === 'mode') {
  must(call('PUT', '/platform/access', { mode: String(MODE) }), 'the mode');
} else if (ACTION === 'pending') {
  must(call('PUT', '/platform/access', { mode: 'postapproved' }), 'Post-approved');
  var who = String(EMAIL).toLowerCase();
  var signedUp = call(
    'POST',
    '/auth/signup',
    {
      dev_email: who,
      dev_name: NAME,
      birth_year: typeof YEAR === 'undefined' ? 1990 : Number(YEAR),
      birth_month: 6,
      terms_version: TERMS_VERSION,
      privacy_version: PRIVACY_VERSION,
    },
    who,
  );
  var waiting = signedUp.body && signedUp.body.error && signedUp.body.error.code === 'access_pending';
  if (!waiting) throw new Error('Signing up ' + who + ' under Post-approved answered ' + signedUp.status + ' ' + JSON.stringify(signedUp.body));
  var made = accountFor(who);
  if (!made) throw new Error('No sign-up waits for ' + who);
  output.access = { userId: made.user_id, state: made.access };
} else if (ACTION === 'approve') {
  var approving = accountFor(EMAIL);
  if (!approving) throw new Error('No sign-up waits or was decided for ' + EMAIL);
  var decision = { access: 'approved' };
  if (typeof ORG !== 'undefined' && ORG) {
    decision.space = {
      organization_id: spaceIdFor(String(ORG)),
      role: typeof ROLE !== 'undefined' && ROLE ? String(ROLE) : 'member',
    };
  }
  must(call('PUT', '/platform/access/accounts/' + approving.user_id, decision), 'approving ' + EMAIL);
  output.access = { userId: approving.user_id, state: 'approved' };
} else if (ACTION === 'count') {
  var person = must(call('GET', '/platform/people?email=' + encodeURIComponent(String(EMAIL))), 'the person').body.data;
  output.access = { userId: person.id, spaces: person.organization_count };
} else if (ACTION === 'find') {
  var found = accountFor(EMAIL);
  if (!found) throw new Error('No sign-up waits or was decided for ' + EMAIL);
  output.access = { userId: found.user_id, state: found.access };
} else if (ACTION === 'reset') {
  call('PUT', '/platform/access', { mode: 'open' });
  if (typeof EMAIL !== 'undefined' && EMAIL) {
    var account = accountFor(EMAIL);
    if (account && account.access !== 'approved') {
      call('PUT', '/platform/access/accounts/' + account.user_id, { access: 'approved' });
    }
  }
} else {
  throw new Error('access.js: unknown ACTION ' + ACTION);
}
