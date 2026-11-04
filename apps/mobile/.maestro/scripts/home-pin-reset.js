// Phase 68 (H4) for home/focus-pin.yaml, through the LOCAL Worker only (sign-in off, X-Dev-User): Maria's
// "Make this my home" back to Automatic in chmi (PUT /home/pin { focus: null }), before and after the flow,
// so a rerun -- or the other platform's run -- starts unpinned.
var response = http.request('http://localhost:8787/api/home/pin', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json', 'X-Dev-User': 'maria.okafor@gmail.com', 'X-Organization': 'chmi' },
  body: JSON.stringify({ focus: null }),
});
if (response.status >= 300) throw new Error('Could not unpin Maria\'s home: ' + response.status + ' ' + response.body);
