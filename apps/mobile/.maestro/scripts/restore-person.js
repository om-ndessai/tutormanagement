// Puts PERSON_ID back if a flow left them deactivated (before and after people/row-swipe-undo).
// Tolerant: a person who is not deactivated answers an error, which is the usual case. Never
// anything but localhost.
var response = http.request('http://localhost:8787/api/users/' + PERSON_ID + '/restore', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Dev-User': 'priya.raghavan@gmail.com',
    'X-Organization': 'chmi',
  },
  body: '{}',
});
output.restored = response.status < 300;
