// One request to the LOCAL Worker (sign-in off, X-Dev-User) to put back what a flow changed, so
// flows do not depend on the order they run in. env: METHOD, API_PATH, AS (an email), ORG, BODY (JSON,
// optional). Never anything but localhost.
var response = http.request('http://localhost:8787/api' + API_PATH, {
  method: METHOD,
  headers: { 'Content-Type': 'application/json', 'X-Dev-User': AS, 'X-Organization': ORG },
  body: typeof BODY === 'undefined' ? undefined : BODY,
});
if (response.status >= 300) {
  throw new Error(METHOD + ' ' + API_PATH + ' answered ' + response.status + ' ' + response.body);
}
