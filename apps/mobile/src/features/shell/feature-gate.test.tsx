// Phase 50: a screen of a feature set that is off here shows the calm "Not part of this space",
// never mounts the screen (so its queries never fire), and a 403 feature_unavailable from a stale
// session reads the same in ErrorState. Every route of a set renders the gate.
import { fireEvent, screen } from '@testing-library/react-native';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { Text } from 'react-native';

import { ErrorState } from '@/components/state-views';
import { ApiRequestError } from '@/lib/api-client';
import { renderWithProviders } from '@/test/render';
import { FeatureGate, GATED_ROUTES } from './feature-gate';

const mockNavigate = jest.fn();
const mockBack = jest.fn();
const mockDismissAll = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    navigate: (href: unknown) => mockNavigate(href),
    back: () => mockBack(),
    dismissAll: () => mockDismissAll(),
    canDismiss: () => true,
  },
}));
const mockAuth = jest.fn();
jest.mock('@/providers/auth-provider', () => ({ useAuth: () => mockAuth() }));
jest.mock('@/providers/brand-provider', () => ({
  useBrand: () => ({ ...jest.requireActual('@tmi/shared').PLATFORM_BRAND, short: 'Ferreira' }),
}));

const ASSESS_ONLY = {
  feature_tutoring: false,
  feature_assessment: true,
  feature_quest: false,
  canvas_assessments: true,
  gamify_question_quest: false,
};

function as(roles: string[], organization: object) {
  mockAuth.mockReturnValue({ user: { id: 'me', roles }, organization });
}

const mounted = jest.fn();
function Child() {
  mounted();
  return <Text testID="gated-child">The screen</Text>;
}

beforeEach(() => {
  mounted.mockClear();
  mockNavigate.mockClear();
  mockBack.mockClear();
  mockDismissAll.mockClear();
});

describe('FeatureGate', () => {
  it('renders its children while the set is on', async () => {
    as(['admin'], ASSESS_ONLY);
    await renderWithProviders(
      <FeatureGate set="assessment">
        <Child />
      </FeatureGate>,
    );
    expect(screen.getByTestId('gated-child')).toBeTruthy();
    expect(screen.queryByTestId('feature-unavailable')).toBeNull();
  });

  it('shows the calm state for a set not allowed here, never mounting the screen', async () => {
    as(['admin'], ASSESS_ONLY);
    await renderWithProviders(
      <FeatureGate set="tutoring">
        <Child />
      </FeatureGate>,
    );
    expect(mounted).not.toHaveBeenCalled();
    expect(screen.getByTestId('screen-feature-unavailable')).toBeTruthy();
    expect(screen.getByText('Not part of this space')).toBeTruthy();
    expect(screen.getByText("Tutoring isn't part of Ferreira.")).toBeTruthy();
    // Not allowed: nothing for the office to switch on.
    expect(screen.queryByTestId('feature-unavailable-organization')).toBeNull();
    fireEvent.press(screen.getByTestId('feature-unavailable-home'));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('says a set allowed but switched off is switched off, with Open Organization for an admin', async () => {
    as(['admin'], { ...ASSESS_ONLY, canvas_assessments: false });
    await renderWithProviders(
      <FeatureGate set="assessment">
        <Child />
      </FeatureGate>,
    );
    expect(screen.getByText('Assessment is switched off in Ferreira.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('feature-unavailable-organization'));
    expect(mockNavigate).toHaveBeenCalledWith('/organization');
  });

  it('gives a parent no Organization button', async () => {
    as(['parent'], { ...ASSESS_ONLY, canvas_assessments: false });
    await renderWithProviders(
      <FeatureGate set="assessment">
        <Child />
      </FeatureGate>,
    );
    expect(screen.queryByTestId('feature-unavailable-organization')).toBeNull();
  });

  it('gives a sheet Close', async () => {
    as(['admin'], ASSESS_ONLY);
    await renderWithProviders(
      <FeatureGate set="tutoring" presentation="sheet">
        <Child />
      </FeatureGate>,
    );
    expect(screen.queryByTestId('feature-unavailable-home')).toBeNull();
    fireEvent.press(screen.getByTestId('feature-unavailable-close'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('gives a full-screen modal Go to Home that dismisses it first', async () => {
    as(['admin'], ASSESS_ONLY);
    await renderWithProviders(
      <FeatureGate set="quest" presentation="modal">
        <Child />
      </FeatureGate>,
    );
    fireEvent.press(screen.getByTestId('feature-unavailable-home'));
    expect(mockDismissAll).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });
});

describe('ErrorState and feature_unavailable', () => {
  it('shows the calm words, with no Try again', async () => {
    const error = new ApiRequestError(403, 'feature_unavailable', 'Tutoring is not part of this space.');
    const retry = jest.fn();
    await renderWithProviders(<ErrorState error={error} onRetry={retry} />);
    expect(screen.getByTestId('state-feature-unavailable')).toBeTruthy();
    expect(screen.getByText('Not part of this space')).toBeTruthy();
    expect(screen.queryByText('Try again')).toBeNull();
    expect(screen.queryByTestId('state-error')).toBeNull();
  });
});

describe('GATED_ROUTES', () => {
  const ROOT = join(__dirname, '../../app/(org)');
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? walk(path) : [relative(ROOT, path)];
    });
  const files = walk(ROOT);

  it('names only route files that exist, and each renders FeatureGate with its set', () => {
    for (const [path, { set, presentation }] of Object.entries(GATED_ROUTES)) {
      expect(files).toContain(path);
      const source = readFileSync(join(ROOT, path), 'utf8');
      expect([path, source.includes(`<FeatureGate set="${set}"`)]).toEqual([path, true]);
      if (presentation !== 'screen') {
        expect([path, source.includes(`presentation="${presentation}"`)]).toEqual([path, true]);
      }
    }
  });

  it('covers every route in a set’s own folders', () => {
    const owned = files.filter(
      (path) =>
        /^(\(tabs\)\/(sessions|schedule|progress)|assessments|quest)\//.test(path) && !path.endsWith('_layout.tsx'),
    );
    for (const path of owned) expect([path, path in GATED_ROUTES]).toEqual([path, true]);
  });
});
