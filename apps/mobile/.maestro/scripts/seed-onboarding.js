// Makes the people the onboarding/* flows meet the welcome wizard as: an admin and a parent the
// office has just added, who have never signed in (no user_onboarding row), as the web's
// onboarding spec does. Run after clean-people.js, which also removes them afterwards (they are not
// seed rows). Never anything but localhost.
var ORG = 'chmi';
var ADMIN = 'priya.raghavan@gmail.com';

function add(person) {
  var response = http.request('http://localhost:8787/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Dev-User': ADMIN, 'X-Organization': ORG },
    body: JSON.stringify(person),
  });
  if (response.status >= 300) {
    throw new Error('adding ' + person.email + ' answered ' + response.status + ' ' + response.body);
  }
}

add({
  full_name: 'Wren Calloway',
  email: 'wren.calloway@example.com',
  phone: '(919) 555-0171',
  roles: ['admin'],
  status: 'active',
});
add({
  full_name: 'Odessa Fairbanks',
  email: 'odessa.fairbanks@example.com',
  phone: '(919) 555-0177',
  roles: ['parent'],
  status: 'active',
});
