// Phase 60 (S4): the setup and checks of flows/spaces/landing.yaml, on the LOCAL Worker only (sign-in
// off, X-Dev-User). spaces.js signs the people up and makes the spaces; this does what is left.
// env: ACTION and its arguments:
//   invite OWNER MEMBER SLUG     OWNER (the space's admin) adds MEMBER as a parent (or ROLE, when given),
//                                and MEMBER accepts by API -- accepting alone never moves the last
//                                choice; outputs memberId
//   enter MEMBER SLUG            POST /auth/enter naming SLUG, exactly as the web does on opening a
//                                space: the "chosen on the web" half of the across-clients check
//   last MEMBER EXPECT           fails unless the server's last choice (is_default) is EXPECT ('' = none)
//   remove OWNER SLUG ID         the space's admin removes the person (DELETE /users/:id)
//   suspend OWNER SLUG ID        the space's admin suspends them there (PATCH status 'suspended')
var API = 'http://localhost:8787/api';

function call(as, method, path, body, org) {
  var headers = { 'Content-Type': 'application/json', 'X-Dev-User': as };
  if (org) headers['X-Organization'] = org;
  var response = http.request(API + path, {
    method: method,
    headers: headers,
    // Maestro's http refuses a POST without a body.
    body: body === undefined ? (method === 'POST' || method === 'PUT' || method === 'PATCH' ? '{}' : undefined) : JSON.stringify(body),
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

if (ACTION === 'invite') {
  var added = must(
    call(OWNER, 'POST', '/users', { full_name: 'Lena Lander', email: MEMBER, roles: [typeof ROLE === 'undefined' ? 'parent' : ROLE] }, SLUG),
    'inviting ' + MEMBER + ' to ' + SLUG,
  ).body.data;
  must(call(MEMBER, 'POST', '/auth/invitations/' + SLUG + '/accept'), 'accepting ' + SLUG);
  output.memberId = added.id;
} else if (ACTION === 'enter') {
  must(call(MEMBER, 'POST', '/auth/enter', undefined, SLUG), 'entering ' + SLUG);
} else if (ACTION === 'last') {
  var session = must(call(MEMBER, 'GET', '/auth/session'), 'the session').body.data;
  var chosen = (session.memberships || [])
    .filter(function (m) {
      return m.is_default;
    })
    .map(function (m) {
      return m.slug;
    })
    .join(',');
  var expected = typeof EXPECT === 'undefined' ? '' : String(EXPECT);
  if (chosen !== expected) throw new Error('last space: expected "' + expected + '", the server says "' + chosen + '"');
} else if (ACTION === 'remove') {
  must(call(OWNER, 'DELETE', '/users/' + ID, undefined, SLUG), 'removing ' + ID + ' from ' + SLUG);
} else if (ACTION === 'suspend') {
  must(call(OWNER, 'PATCH', '/users/' + ID, { status: 'suspended' }, SLUG), 'suspending ' + ID + ' in ' + SLUG);
} else {
  throw new Error('landing.js: unknown ACTION ' + ACTION);
}
