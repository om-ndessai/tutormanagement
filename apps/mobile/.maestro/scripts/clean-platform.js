// Puts back what the platform/* flows change, before and after each (their onFlowStart /
// onFlowComplete hooks), so a flow that fails part-way leaves nothing in the way of the next run:
// - the test organization ("Mobile Console Academy"): the API has no delete, so its address name is
//   moved out of the way (the flow can create it again), it is renamed and archived;
// - riverside's uploaded logos (platform/logo) are removed;
// - Alex's shared phone (platform/admins-people) is put back as the seed has it.
// The platform admin that flow adds stays (no API removes one) until `npm run db:reset`, which the
// runner does after. Errors are tolerated. Never anything but localhost. One device at a time.
var NAV = 'ndessai@gmail.com';
var TEST_SLUG = 'mobile-console-academy';
var TEST_NAME = 'Mobile Console Academy';

function call(method, path, body) {
  var response = http.request('http://localhost:8787/api' + path, {
    method: method,
    headers: { 'Content-Type': 'application/json', 'X-Dev-User': NAV },
    // Maestro's http refuses a POST without a body.
    body: body === undefined ? (method === 'POST' ? '{}' : undefined) : JSON.stringify(body),
  });
  return { status: response.status, body: response.body ? json(response.body) : null };
}

var list = call('GET', '/platform/organizations');
var orgs = (list.body && list.body.data) || [];
var retired = 0;
orgs.forEach(function (org) {
  if (org.slug === TEST_SLUG || org.name.indexOf(TEST_NAME) === 0) {
    var tag = org.id.slice(0, 8) + '-' + Math.floor(Math.random() * 1e6);
    call('PATCH', '/platform/organizations/' + org.id, {
      slug: 'retired-' + tag,
      name: 'Retired test organization ' + tag,
      short_name: 'Retired',
    });
    if (!org.archived_at) call('POST', '/platform/organizations/' + org.id + '/archive');
    retired++;
  }
  // One retired by an earlier run whose archive did not go through.
  if (org.slug.indexOf('retired-') === 0 && !org.archived_at) {
    call('POST', '/platform/organizations/' + org.id + '/archive');
  }
  if (org.slug === 'riverside') {
    if (org.logo_mark_url) call('DELETE', '/platform/organizations/' + org.id + '/logo/mark');
    if (org.logo_full_url) call('DELETE', '/platform/organizations/' + org.id + '/logo/full');
  }
});

var alex = call('GET', '/platform/people?email=' + encodeURIComponent('alex.chen.math@gmail.com'));
if (alex.body && alex.body.data && alex.body.data.phone !== '(984) 555-0113') {
  call('PATCH', '/platform/people/' + alex.body.data.id, { phone: '(984) 555-0113' });
}
output.retiredOrganizations = retired;
