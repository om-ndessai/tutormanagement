// The Maestro scripts run outside the app (Maestro's own JS), so they cannot import the shared
// package. What they hard-code is checked here: a new wording date fails in Jest, not on a simulator.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  PLACEMENT_ROLES,
  accessDecisionSchema,
  DAILY_NAME,
  DEFAULT_GUEST_SETTINGS,
  JOIN_REQUEST_ROLES,
  PRIVACY_VERSION,
  TERMS_VERSION,
  questGradeSchema,
} from '@tmi/shared';

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

  it('adds a member with no role (Phase 79), and the teen let-in flow asks as a learner', () => {
    expect(script).toContain("String(ROLES) === 'member' ? [] : String(ROLES).split(',')");
    const teen = readFileSync(join(__dirname, '../../.maestro/flows/spaces/let-in-teen.yaml'), 'utf8');
    // A teen asks only as a learner (shared `joinAskRolesFor`), and signs up as a 13-17.
    expect(teen).toContain('ROLE: student');
    const year = Number(/YEAR: '?(\d{4})/.exec(teen)?.[1]);
    expect(new Date().getFullYear() - year).toBeGreaterThanOrEqual(13);
    expect(new Date().getFullYear() - year).toBeLessThanOrEqual(16);
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

  it('signs up with the current terms, and approves with the shared decision (Phase 80)', () => {
    expect(accessScript).toContain(`var TERMS_VERSION = '${TERMS_VERSION}';`);
    expect(accessScript).toContain(`var PRIVACY_VERSION = '${PRIVACY_VERSION}';`);
    expect(accessScript).toContain("signedUp.body.error.code === 'access_pending'");
    // The place the console's sheet sends, a role among the shared ones (Member by default).
    expect(accessScript).toContain('decision.space = {');
    expect(accessScript).toContain("role: typeof ROLE !== 'undefined' && ROLE ? String(ROLE) : 'member'");
    expect(
      accessDecisionSchema.safeParse({
        access: 'approved',
        space: { organization_id: '0a000000-0000-4000-8000-000000000001', role: 'member' },
      }).success,
    ).toBe(true);
    const flows = ['platform/access.yaml', 'home/personal-offer.yaml', 'spaces/sign-up.yaml'].map((flow) =>
      readFileSync(join(__dirname, '../../.maestro/flows', flow), 'utf8'),
    );
    for (const role of flows.join('\n').match(/ROLE: (\w+)/g) ?? []) {
      expect(PLACEMENT_ROLES).toContain(role.replace('ROLE: ', ''));
    }
  });
});

// Phase 73 (JF14, JF23): the play flows' hard-coded words and the grade they put back.
const questEnd = readFileSync(join(__dirname, '../../.maestro/scripts/quest-games-end.js'), 'utf8');
const playFlow = (name: string) => readFileSync(join(__dirname, '../../.maestro/flows/play', name), 'utf8');

describe('.maestro/scripts/quest-games-end.js and the play flows (Phase 73)', () => {
  it('forgets the grade picked on the row for everyone the play flows sign in as, grade.yaml\'s Sanjay too', () => {
    expect(questEnd).toContain("call('PUT', '/quest/grade', { grade: null }, GRADED[g])");
    expect(questGradeSchema.safeParse({ grade: null }).success).toBe(true);
    expect(questEnd).toContain("'sanjay.patel.nc@gmail.com'");
    expect(playFlow('grade.yaml')).toContain('PERSONA: sanjay.patel.nc@gmail.com');
    for (const flow of ['grade.yaml', 'continue.yaml', 'play-home.yaml', 'habit.yaml']) {
      expect(playFlow(flow)).toContain('runScript: ../../scripts/quest-games-end.js');
    }
  });

  it('names the members\' Daily by its one name', () => {
    expect(playFlow('habit.yaml')).toContain(`${DAILY_NAME} · Grade \${output.habitGrade}`);
    expect(playFlow('habit.yaml')).not.toMatch(/Today's 5/);
  });
});
