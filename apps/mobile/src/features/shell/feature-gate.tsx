// Phase 50: the screens of a feature set open only where that set is on here (R23). Ported in
// spirit from RequireFeature in apps/web/src/components/layout/require-feature.tsx @ 2471d84
// (working tree): a link into one from elsewhere -- a deep link, an old notification, a stale tab --
// gets a calm "Not part of this space", never the 403 its reads would answer, and the screen's
// queries never run because its children are never mounted.
import { featureAllowed, featureOn, FEATURE_SET_LABELS, type FeatureSet } from '@tmi/shared';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Button } from 'react-native-paper';

import { Screen } from '@/components/screen';
import { EmptyState } from '@/components/state-views';
import { useAuth } from '@/providers/auth-provider';
import { useBrand } from '@/providers/brand-provider';
import { space } from '@/theme/tokens';

/**
 * How the gated route is presented, which decides the way out:
 * - `screen`: a pushed screen or a tab -- Go to Home;
 * - `modal`: a full-screen modal with no tab bar (Quest's play, review and game) -- Go to Home,
 *   dismissing it first;
 * - `sheet`: a form sheet -- Close.
 */
export type GatePresentation = 'screen' | 'modal' | 'sheet';

export function FeatureGate({
  set,
  presentation = 'screen',
  children,
}: {
  set: FeatureSet;
  presentation?: GatePresentation;
  children: ReactNode;
}) {
  const { organization } = useAuth();
  if (featureOn(organization, set)) return <>{children}</>;
  return <FeatureUnavailable set={set} presentation={presentation} />;
}

export function FeatureUnavailable({
  set,
  presentation = 'screen',
}: {
  set: FeatureSet;
  presentation?: GatePresentation;
}) {
  const brand = useBrand();
  const { user, organization } = useAuth();
  const isAdmin = user?.roles.includes('admin') ?? false;
  const allowed = featureAllowed(organization, set);
  const label = FEATURE_SET_LABELS[set];
  const body = allowed ? `${label} is switched off in ${brand.short}.` : `${label} isn't part of ${brand.short}.`;

  const goHome = () => {
    if (presentation === 'modal' && router.canDismiss()) router.dismissAll();
    router.navigate('/dashboard');
  };

  return (
    <Screen testID="screen-feature-unavailable" edges={presentation === 'sheet' ? [] : ['top']}>
      <EmptyState
        testID="feature-unavailable"
        icon="puzzle-outline"
        title="Not part of this space"
        body={body}
        action={
          <View style={{ gap: space.sm, alignItems: 'center', marginTop: space.sm }}>
            {presentation === 'sheet' ? (
              <Button mode="contained" testID="feature-unavailable-close" onPress={() => router.back()}>
                Close
              </Button>
            ) : (
              <Button mode="contained" testID="feature-unavailable-home" onPress={goHome}>
                Go to Home
              </Button>
            )}
            {allowed && isAdmin ? (
              <Button
                mode="outlined"
                testID="feature-unavailable-organization"
                onPress={() => {
                  if (presentation === 'sheet') router.back();
                  else if (presentation === 'modal' && router.canDismiss()) router.dismissAll();
                  router.navigate('/organization');
                }}
              >
                Open Space
              </Button>
            ) : null}
          </View>
        }
      />
    </Screen>
  );
}

/**
 * Every route file of a feature set, relative to `src/app/(org)`, and how it is presented. A test
 * fails on a file here that does not render `FeatureGate`, and on a route file in a set's folder
 * that is missing from here, so a new route has to choose.
 */
export const GATED_ROUTES: Record<string, { set: FeatureSet; presentation: GatePresentation }> = {
  // Tutoring, screens.
  '(tabs)/sessions/index.tsx': { set: 'tutoring', presentation: 'screen' },
  '(tabs)/sessions/[id].tsx': { set: 'tutoring', presentation: 'screen' },
  '(tabs)/schedule/index.tsx': { set: 'tutoring', presentation: 'screen' },
  '(tabs)/progress/index.tsx': { set: 'tutoring', presentation: 'screen' },
  '(tabs)/progress/[studentId].tsx': { set: 'tutoring', presentation: 'screen' },
  '(tabs)/progress/report/[studentId].tsx': { set: 'tutoring', presentation: 'screen' },
  'analytics.tsx': { set: 'tutoring', presentation: 'screen' },
  'billing.tsx': { set: 'tutoring', presentation: 'screen' },
  'pairings.tsx': { set: 'tutoring', presentation: 'screen' },
  'locations.tsx': { set: 'tutoring', presentation: 'screen' },
  'comments.tsx': { set: 'tutoring', presentation: 'screen' },
  'record-lesson.tsx': { set: 'tutoring', presentation: 'screen' },
  'schedule-lesson.tsx': { set: 'tutoring', presentation: 'screen' },
  'add-tutor.tsx': { set: 'tutoring', presentation: 'screen' },
  'onboarding/tutor.tsx': { set: 'tutoring', presentation: 'screen' },
  'onboarding/add-tutor.tsx': { set: 'tutoring', presentation: 'screen' },
  // Tutoring, sheets.
  'record-session.tsx': { set: 'tutoring', presentation: 'sheet' },
  'record-as-planned.tsx': { set: 'tutoring', presentation: 'sheet' },
  'start-lesson.tsx': { set: 'tutoring', presentation: 'sheet' },
  'stop-lesson.tsx': { set: 'tutoring', presentation: 'sheet' },
  'cancel-lesson.tsx': { set: 'tutoring', presentation: 'sheet' },
  'schedule-form.tsx': { set: 'tutoring', presentation: 'sheet' },
  'assignment-form.tsx': { set: 'tutoring', presentation: 'sheet' },
  'location-form.tsx': { set: 'tutoring', presentation: 'sheet' },
  'payment-form.tsx': { set: 'tutoring', presentation: 'sheet' },
  'form-1099.tsx': { set: 'tutoring', presentation: 'sheet' },
  'assessment-form.tsx': { set: 'tutoring', presentation: 'sheet' },
  'plan-form.tsx': { set: 'tutoring', presentation: 'sheet' },
  'assess-session.tsx': { set: 'tutoring', presentation: 'sheet' },
  'reflection.tsx': { set: 'tutoring', presentation: 'sheet' },
  'comments-thread.tsx': { set: 'tutoring', presentation: 'sheet' },
  'view-as.tsx': { set: 'tutoring', presentation: 'sheet' },
  // Assessment.
  'assessments/index.tsx': { set: 'assessment', presentation: 'screen' },
  'assessments/[id].tsx': { set: 'assessment', presentation: 'screen' },
  'assessments/review/[id].tsx': { set: 'assessment', presentation: 'screen' },
  'assessments/pdf/[id].tsx': { set: 'assessment', presentation: 'screen' },
  // Quest.
  'quest/index.tsx': { set: 'quest', presentation: 'screen' },
  'quest/play.tsx': { set: 'quest', presentation: 'modal' },
  'quest/review.tsx': { set: 'quest', presentation: 'modal' },
  'quest/games/[gameId].tsx': { set: 'quest', presentation: 'modal' },
  'quest/new-game.tsx': { set: 'quest', presentation: 'screen' },
  'quest/join-game.tsx': { set: 'quest', presentation: 'sheet' },
};
