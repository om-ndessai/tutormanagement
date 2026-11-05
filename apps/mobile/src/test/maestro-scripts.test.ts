// The Maestro scripts run outside the app (Maestro's own JS), so they cannot import the shared
// package. What they hard-code is checked here: a new wording date fails in Jest, not on a simulator.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { DEFAULT_GUEST_SETTINGS, JOIN_REQUEST_ROLES, PRIVACY_VERSION, TERMS_VERSION } from '@tmi/shared';

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

  it('asks with a role among the shared ones, and checks the terms are due before spaces/legal (Phase 72)', () => {
    expect(script).toContain("ask.role = String(ROLE)");
    expect(script).toContain("ask.note = String(NOTE)");
    expect(script).toContain("ACTION === 'legal-due'");
    // reset-newcomer declines a waiting invitation, so someone a space only invited can be deleted.
    expect(script).toContain("'/auth/invitations/' + i.slug + '/decline'");
    const flows = ['home/quick-code.yaml', 'spaces/let-in.yaml'].map((flow) =>
      readFileSync(join(__dirname, '../../.maestro/flows', flow), 'utf8'),
    );
    for (const role of flows.join('\n').match(/ROLE: (\w+)/g) ?? []) {
      expect(JOIN_REQUEST_ROLES).toContain(role.replace('ROLE: ', ''));
    }
  });
});

const guestScript = readFileSync(join(__dirname, '../../.maestro/scripts/guest-play.js'), 'utf8');

describe('.maestro/scripts/guest-play.js', () => {
  it('puts back the shared default guest settings', () => {
    const body = /var DEFAULTS = (\{[\s\S]*?\});/.exec(guestScript)?.[1];
    expect(body).toBeDefined();
    // The script's object literal, read as data.
    const defaults = new Function(`return ${body};`)() as unknown;
    expect(defaults).toEqual(DEFAULT_GUEST_SETTINGS);
  });

  it('talks to the local Worker only', () => {
    const origins = guestScript.match(/https?:\/\/[^'"/]+/g) ?? [];
    expect(new Set(origins)).toEqual(new Set(['http://localhost:8787']));
  });
});

const accessScript = readFileSync(join(__dirname, '../../.maestro/scripts/access.js'), 'utf8');

describe('.maestro/scripts/access.js (Phase 65)', () => {
  it('talks to the local Worker only', () => {
    const origins = accessScript.match(/https?:\/\/[^'"/]+/g) ?? [];
    expect(new Set(origins)).toEqual(new Set(['http://localhost:8787']));
  });

  it('puts the mode back to Open, the shared default', () => {
    expect(accessScript).toContain("{ mode: 'open' }");
  });
});
