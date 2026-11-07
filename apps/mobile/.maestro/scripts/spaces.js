// Phase 52 (design 63): sets up and puts back what the spaces/* flows change, on the LOCAL Worker
// only (sign-in off, X-Dev-User). env: ACTION and its arguments:
//   reset-newcomer EMAIL         every space the address made is deleted, any other left, its open
//                                requests withdrawn, its invitations declined (Phase 72: someone a space only
//                                invited), then the account deleted (nothing there: fine)
//   signup EMAIL NAME [YEAR] [PERSONAL]
//                                POST /auth/signup with dev_email (an adult unless YEAR says otherwise).
//                                Phase 63 (P13): sign-up also makes "<First name>'s space" and lands
//                                them in it; PERSONAL: drop deletes it again at once (drop-personal), for
//                                a flow whose subject needs a newcomer who belongs nowhere -- the old cast
//   drop-personal EMAIL          Phase 63 (P13): deletes every personal space the person is an admin of
//                                (DELETE /organization, by its name), so they belong nowhere again and
//                                reach the Welcome, as a person who deleted their own space would
//   make-space EMAIL NAME        POST /spaces; outputs slug, code and codeShown (either way it reads)
//   ask EMAIL CODE [ROLE] [NOTE] POST /spaces/join-requests (already asked: fine); Phase 72: the role asked for
//                                (parent, student, tutor, admin) and a note, when given
//   seen EMAIL                   POST /spaces/join-requests/seen (older apps; it no longer hides an answer)
//   dismiss EMAIL [SLUG]         UI audit JF5: dismisses the spaces' answers to the person's requests (let in
//                                or declined) -- SLUG's alone, or all -- POST /spaces/join-requests/:slug/dismiss
//   withdraw EMAIL SLUG          DELETE /spaces/join-requests/:slug (none: fine)
//   tour-done EMAIL ORG          the person has been through the welcome wizard there (skipped)
//   trust ORG_SLUG ON            as the platform admin, the space's Quest trust ('true' / 'false')
//   archive NAME ON              as the platform admin, archives ('true') or restores ('false') every
//                                space named NAME (restoring first lets reset-newcomer delete it)
//   clear-last EMAIL             Phase 60: forgets the person's last space (is_default), so their next
//                                arrival lands by the rest of the rule -- other flows entering a space move it
//   add-person EMAIL NAME ROLES ACTOR ORG [STATUS]
//                                Phase 60: ACTOR adds the person to ORG (POST /users; ROLES comma-separated;
//                                Phase 79: ROLES 'member' is a member, no role at all); outputs userId
//   let-in EMAIL ACTOR ORG       Phase 60: ACTOR (an admin of ORG) lets in EMAIL's open request as a
//                                parent, through the ordinary user form (POST /users, join_request_user_id)
//   decline EMAIL ACTOR ORG      Phase 60: ACTOR declines EMAIL's open request to join ORG
//   leave EMAIL SLUG             Phase 61: the person leaves that space (POST /spaces/:slug/leave)
//   google-sign-in EMAIL SUBJECT Phase 60: a real first (or later) sign-in, the suite's fake Google token
//                                through POST /auth/google (AUTH_FAKE_PROVIDERS, local only). Phase 72: someone a
//                                space added owes the terms after their first (legal_due on the session); they are
//                                accepted here at once, as the web suite's helper does, unless KEEP_TERMS is '1'
//                                (spaces/legal, which walks through the sheet)
//   legal-due EMAIL              Phase 72: fails unless the person's session says the terms are due (the setup
//                                of spaces/legal), so a flow never waits on a sheet the server will not ask for
// (The JSON bodies are built here: Maestro misreads a YAML value mixing JSON braces with ${...}.)
// Errors are tolerated where it cleans. The server loosens its rate limits twenty times away from
// production, so a 429 should not happen; signing up still waits one out, as a fallback.
var API = 'http://localhost:8787/api';
// The versions a newcomer accepts: equal to TERMS_VERSION / PRIVACY_VERSION in packages/shared
// (src/test/maestro-scripts.test.ts checks it, so a new wording date fails in Jest, not here).
var TERMS_VERSION = '2026-11-04';
var PRIVACY_VERSION = '2026-11-04';
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

/** Phase 63 (P13): the person's own personal spaces (where they are an admin) are deleted. */
function dropPersonal(who) {
  var session = must(call(who, 'GET', '/auth/session'), 'the session of ' + who).body.data;
  (session.memberships || []).forEach(function (m) {
    if (m.status !== 'active') return;
    var inside = call(who, 'GET', '/auth/session', undefined, m.slug);
    var org = inside.body && inside.body.data && inside.body.data.organization;
    var roles = (inside.body && inside.body.data && inside.body.data.user && inside.body.data.user.roles) || [];
    if (org && org.personal && roles.indexOf('admin') >= 0) {
      must(call(who, 'DELETE', '/organization', { confirm_name: org.name }, m.slug), 'deleting ' + org.name);
    }
  });
}

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
    // An invitation still waiting keeps the account from being deleted.
    (data.invitations || []).forEach(function (i) {
      call(email, 'POST', '/auth/invitations/' + i.slug + '/decline');
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
  if (typeof PERSONAL !== 'undefined' && String(PERSONAL) === 'drop') dropPersonal(email);
} else if (ACTION === 'drop-personal') {
  dropPersonal(email);
} else if (ACTION === 'make-space') {
  var space = must(call(email, 'POST', '/spaces', { name: NAME }), 'making ' + NAME).body.data;
  output.slug = space.slug;
  output.code = must(call(email, 'GET', '/organization/code', undefined, space.slug), 'its code').body.data.code;
  // How the Space screen reads it out (an iOS element's text is its label): "Code F M X Y, 2 3 4 5".
  output.codeShown =
    '(' + output.code + '|Code ' + output.code.split('-').map(function (p) { return p.split('').join(' '); }).join(', ') + ')';
} else if (ACTION === 'ask') {
  var ask = { code: CODE };
  if (typeof ROLE !== 'undefined' && ROLE) ask.role = String(ROLE);
  if (typeof NOTE !== 'undefined' && NOTE) ask.note = String(NOTE);
  var asked = call(email, 'POST', '/spaces/join-requests', ask);
  if (asked.status >= 300 && asked.status !== 409) must(asked, 'asking to join');
} else if (ACTION === 'seen') {
  call(email, 'POST', '/spaces/join-requests/seen');
} else if (ACTION === 'dismiss') {
  var mine = call(email, 'GET', '/auth/session');
  var answered = (mine.status < 300 && mine.body && mine.body.data && mine.body.data.join_requests) || [];
  answered.forEach(function (r) {
    if (r.outcome === null || r.outcome === undefined) return;
    if (typeof SLUG !== 'undefined' && SLUG && r.slug !== String(SLUG)) return;
    call(email, 'POST', '/spaces/join-requests/' + r.slug + '/dismiss');
  });
} else if (ACTION === 'withdraw') {
  call(email, 'DELETE', '/spaces/join-requests/' + SLUG);
} else if (ACTION === 'tour-done') {
  must(call(email, 'POST', '/onboarding/tour', { outcome: 'skipped' }, ORG), 'the wizard');
} else if (ACTION === 'clear-last') {
  must(call(email, 'PUT', '/auth/default-organization', { slug: null }), 'clearing the last space');
} else if (ACTION === 'add-person') {
  // Phase 79 (M1): 'member' is in the space with no role.
  var person = { full_name: NAME, email: email, roles: String(ROLES) === 'member' ? [] : String(ROLES).split(',') };
  if (typeof STATUS !== 'undefined' && STATUS) person.status = STATUS;
  output.userId = must(call(ACTOR, 'POST', '/users', person, ORG), 'adding ' + email + ' to ' + ORG).body.data.id;
} else if (ACTION === 'let-in' || ACTION === 'decline') {
  var open = must(call(ACTOR, 'GET', '/organization/join-requests', undefined, ORG), 'the requests').body.data;
  var request = open.filter(function (r) {
    return String(r.email).toLowerCase() === email;
  })[0];
  if (!request) throw new Error('no open request from ' + email + ' to ' + ORG);
  if (ACTION === 'let-in') {
    must(
      call(
        ACTOR,
        'POST',
        '/users',
        { full_name: request.full_name, email: email, roles: ['parent'], status: 'active', join_request_user_id: request.user_id },
        ORG,
      ),
      'letting ' + email + ' in to ' + ORG,
    );
  } else {
    must(call(ACTOR, 'POST', '/organization/join-requests/' + request.user_id + '/decline', undefined, ORG), 'declining ' + email);
  }
} else if (ACTION === 'leave') {
  must(call(email, 'POST', '/spaces/' + SLUG + '/leave'), email + ' leaving ' + SLUG);
} else if (ACTION === 'google-sign-in') {
  must(
    call(email, 'POST', '/auth/google', { credential: 'fake:google:' + SUBJECT + ':' + email + ':1' }),
    'signing in ' + email,
  );
  if (typeof KEEP_TERMS === 'undefined' || KEEP_TERMS !== '1') {
    must(call(email, 'POST', '/auth/legal', { terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION }), email + ' accepting the terms');
  }
} else if (ACTION === 'legal-due') {
  var owed = must(call(email, 'GET', '/auth/session'), 'the session of ' + email).body.data;
  if (owed.legal_due !== true) throw new Error(email + ' owes no terms: legal_due is ' + JSON.stringify(owed.legal_due));
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
} else if (ACTION === 'archive') {
  var archiving = String(ON) === 'true';
  must(call(PLATFORM_ADMIN, 'GET', '/platform/organizations'), 'the console')
    .body.data.filter(function (o) {
      return o.name === NAME && Boolean(o.archived_at) !== archiving;
    })
    .forEach(function (o) {
      must(
        call(PLATFORM_ADMIN, 'POST', '/platform/organizations/' + o.id + (archiving ? '/archive' : '/restore')),
        (archiving ? 'archiving ' : 'restoring ') + NAME,
      );
    });
} else {
  throw new Error('spaces.js: unknown ACTION ' + ACTION);
}
