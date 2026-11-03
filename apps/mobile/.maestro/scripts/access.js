// Phase 65 (docs/access-approval-plan.md): sign-up access for the platform/access flow, on the LOCAL
// Worker only (sign-in off, X-Dev-User as the platform admin). The same routes as the console. env: ACTION
//   find EMAIL      outputs access.userId: the account with that email among those waiting or decided
//   reset [EMAIL]   the mode back to Open, and that account (if any) approved, so spaces.js
//                   reset-newcomer may act as it and delete it. Errors are tolerated: it cleans.
var API = 'http://localhost:8787/api';
var PLATFORM_ADMIN = 'ndessai@gmail.com';

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

if (ACTION === 'find') {
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
