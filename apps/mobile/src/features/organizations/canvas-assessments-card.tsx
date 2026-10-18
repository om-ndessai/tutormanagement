// Ported from apps/web/src/features/organizations/organization-settings-page.tsx
// (CanvasAssessmentsCard) @ 37bdad1, with Phase 40's "Questions in an assessment". The web's
// role="switch" button is Paper's Switch, as in the email notifications card; its 1-25 select is a
// stepper here (an adjustable control for assistive tech), saved a moment after the last tap. Each
// save refreshes the session, so the menu and the start card follow at once for the admin.
import { CANVAS_LIMITS } from '@tmi/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Switch, Text } from 'react-native-paper';

import { BadgePill } from '@/components/badge-pill';
import { Panel } from '@/components/section';
import { useToast } from '@/components/toast';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { IconButton } from '@/components/icon-button';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { useUpdateOrganizationSettings } from './api';
import { stepQuestionCount } from './settings-form';

type Flag = 'canvas_assessments' | 'canvas_assessments_unreviewed';

/** How long after the last tap of the stepper the count is saved. */
export const QUESTION_COUNT_SAVE_MS = 600;


/**
 * Phase 38: the Assessment menu (beta), and its trial of questions not yet reviewed; Phase 40: how
 * many questions an assessment draws.
 */
export function CanvasAssessmentsCard({
  enabled,
  unreviewed,
  questions,
}: {
  enabled: boolean;
  unreviewed: boolean;
  questions: number;
}) {
  const theme = useAppTheme();
  const toast = useToast();
  const update = useUpdateOrganizationSettings();
  const { refreshSession } = useAuth();
  const muted = theme.tokens.mutedForeground;
  // Each switch moves at once; it settles on the server's answer, or back if it was refused.
  const [wanted, setWanted] = useState<Partial<Record<Flag, boolean>>>({});
  const shownEnabled = wanted.canvas_assessments ?? enabled;
  const shownUnreviewed = wanted.canvas_assessments_unreviewed ?? unreviewed;

  async function toggle(flag: Flag, next: boolean) {
    haptics.selection();
    setWanted((was) => ({ ...was, [flag]: next }));
    try {
      await update.mutateAsync({ [flag]: next });
      await refreshSession();
      if (flag === 'canvas_assessments') {
        toast.success(next ? 'The Assessment menu is on.' : 'The Assessment menu is off.');
      } else {
        toast.success(
          next ? 'Assessments may now use questions not yet reviewed.' : 'Assessments use approved questions only.',
        );
      }
    } catch (caught) {
      toast.error(
        caught instanceof ApiRequestError
          ? caught.message
          : flag === 'canvas_assessments'
            ? 'Could not change the Assessment menu.'
            : 'Could not change the questions used.',
      );
    } finally {
      setWanted(({ [flag]: _done, ...rest }) => rest);
    }
  }

  // The count shown while the admin taps; saved once they stop, then it follows the server again.
  const [count, setCount] = useState<number | null>(null);
  const shownCount = count ?? questions;
  const pending = useRef<number | null>(null);

  const saveCount = useCallback(
    async (next: number) => {
      try {
        await update.mutateAsync({ canvas_assessment_questions: next });
        await refreshSession();
        toast.success(`Assessments now have ${next} question${next === 1 ? '' : 's'}.`);
      } catch (caught) {
        toast.error(caught instanceof ApiRequestError ? caught.message : 'Could not change the number of questions.');
      } finally {
        if (pending.current === next) setCount(null);
      }
    },
    [update, refreshSession, toast],
  );

  useEffect(() => {
    if (count === null || count === questions) return;
    pending.current = count;
    const timer = setTimeout(() => void saveCount(count), QUESTION_COUNT_SAVE_MS);
    return () => clearTimeout(timer);
  }, [count, questions, saveCount]);

  function step(by: number) {
    haptics.selection();
    setCount(stepQuestionCount(shownCount, by));
  }

  return (
    <Panel title="Assessment" testID="org-assessments">
      <View style={{ gap: space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
          <View style={{ flex: 1, gap: space.xs }}>
            <View style={{ flexDirection: 'row' }}>
              <BadgePill />
            </View>
            <Text variant="bodySmall" style={{ color: muted }}>
              When on, everyone here sees an Assessment menu. A student answers questions by hand on a canvas, one
              question per page, with nothing marked while they work; on submitting, their tutors and the
              admins get a PDF of the questions and the handwriting, and can review it online for the family. It
              collects students’ handwriting, so check that your consent forms cover it before students under 13 use it.
            </Text>
          </View>
          <Switch
            testID="org-assessments-switch"
            value={shownEnabled}
            disabled={update.isPending}
            onValueChange={(next) => void toggle('canvas_assessments', next)}
            accessibilityLabel="Assessment menu"
            accessibilityRole="switch"
            accessibilityState={{ checked: shownEnabled, disabled: update.isPending }}
          />
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: space.md,
            borderTopWidth: 1,
            borderTopColor: theme.colors.outlineVariant,
            paddingTop: space.lg,
          }}
        >
          <View style={{ flex: 1, gap: space.xs }}>
            <Text variant="labelLarge">Include questions not yet reviewed</Text>
            <Text variant="bodySmall" style={{ color: muted }}>
              A trial: assessments also draw on questions that passed every automatic check in the question bank but
              that no person has approved yet. The tutor’s PDF marks each one “not yet reviewed”.
            </Text>
          </View>
          <Switch
            testID="org-assessments-unreviewed-switch"
            value={shownUnreviewed}
            disabled={update.isPending}
            onValueChange={(next) => void toggle('canvas_assessments_unreviewed', next)}
            accessibilityLabel="Include questions not yet reviewed"
            accessibilityRole="switch"
            accessibilityState={{ checked: shownUnreviewed, disabled: update.isPending }}
          />
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.md,
            borderTopWidth: 1,
            borderTopColor: theme.colors.outlineVariant,
            paddingTop: space.lg,
          }}
        >
          <View style={{ flex: 1, gap: space.xs }}>
            <Text variant="labelLarge">Questions in an assessment</Text>
            <Text variant="bodySmall" style={{ color: muted }}>
              How many questions each new assessment draws (1 to 25). Assessments already started keep theirs.
            </Text>
          </View>
          {/* The number is the adjustable control (swipe up/down with a screen reader); the buttons stay
              their own elements -- an accessible group would fold them into one, on Android above all. */}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <IconButton
              testID="org-assessment-questions-decrease"
              icon="minus"
              accessibilityLabel="Fewer questions"
              disabled={shownCount <= 1}
              onPress={() => step(-1)}
            />
            <Text
              testID="org-assessment-questions"
              accessible
              accessibilityRole="adjustable"
              accessibilityHint="Questions in an assessment"
              accessibilityValue={{ min: 1, max: CANVAS_LIMITS.maxQuestions, now: shownCount }}
              accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
              onAccessibilityAction={(event) => step(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
              variant="titleMedium"
              style={{ minWidth: 28, textAlign: 'center' }}
            >
              {String(shownCount)}
            </Text>
            <IconButton
              testID="org-assessment-questions-increase"
              icon="plus"
              accessibilityLabel="More questions"
              disabled={shownCount >= CANVAS_LIMITS.maxQuestions}
              onPress={() => step(1)}
            />
          </View>
        </View>
      </View>
    </Panel>
  );
}
