// Ported from QuestLanding in apps/web/src/features/quest/quest-page.tsx @ 82397b8 (working tree).
//
// The sign-in landing (owner's brief): once, a student with a question waiting goes straight into
// Quest, and a tutor with answers waiting straight to review. Never again, so leaving Quest stays
// left. Mobile: mounted by Home; "once" is per person and organization for as long as they stay
// signed in, kept in memory only (quest-model.ts) -- the web keeps it per tab in sessionStorage. It
// waits for Home to be in front, and gives way to the welcome wizard, which opens first.
import { router, useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';

import { useAuth } from '@/providers/auth-provider';
import { useQuestReview, useQuestState } from './api';
import { decideQuestLanding, hasLanded, landingKey, markLanded, questLandingKind } from './quest-model';

export function QuestLanding() {
  const { user, organization, onboarding } = useAuth();
  const focused = useIsFocused();
  const on = Boolean(organization?.gamify_question_quest);
  const kind = questLandingKind(user?.roles);
  const key = user && organization ? landingKey(user.id, organization.slug) : null;
  const [settled, setSettled] = useState(false);
  const pending = on && key !== null && !settled && !hasLanded(key);
  const state = useQuestState(pending && kind === 'student');
  const queue = useQuestReview(pending && kind === 'tutor');
  // Someone who has never been through the welcome wizard is about to get it.
  const wizardPending = onboarding !== null && !onboarding.tour_finished_at;
  const stateData = state.data?.data;
  const queueData = queue.data?.data;

  useEffect(() => {
    if (!key || settled || !focused || hasLanded(key)) return;
    const decision = decideQuestLanding({ on, kind, wizardPending, state: stateData, queue: queueData });
    if (!decision.settled) return;
    markLanded(key);
    // Remembered here too, so this Home stops asking at once.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a one-off decision, not a sync
    setSettled(true);
    if (decision.href) router.push(decision.href);
  }, [key, settled, focused, on, kind, wizardPending, stateData, queueData]);

  return null;
}
