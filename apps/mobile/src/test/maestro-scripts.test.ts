// The Maestro scripts run outside the app (Maestro's own JS), so they cannot import the shared
// package. What they hard-code is checked here: a new wording date fails in Jest, not on a simulator.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PRIVACY_VERSION, TERMS_VERSION } from '@tmi/shared';

const script = readFileSync(join(__dirname, '../../.maestro/scripts/spaces.js'), 'utf8');

describe('.maestro/scripts/spaces.js', () => {
  it('accepts the current terms and privacy notice', () => {
    expect(script).toContain(`var TERMS_VERSION = '${TERMS_VERSION}';`);
    expect(script).toContain(`var PRIVACY_VERSION = '${PRIVACY_VERSION}';`);
  });

  it('talks to the local Worker only', () => {
    const origins = script.match(/https?:\/\/[^'"/]+/g) ?? [];
    expect(new Set(origins)).toEqual(new Set(['http://localhost:8787']));
  });
});
