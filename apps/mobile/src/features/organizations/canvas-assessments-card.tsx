// Ported from apps/web/src/features/organizations/organization-settings-page.tsx
// (CanvasAssessmentsCard) @ 22b9701. The web's role="switch" button is Paper's Switch, as in the
// email notifications card. Saving refreshes the session, so the menu appears or goes at once for
// the admin who switched it.
import { useState } from 'react';
import { View } from 'react-native';
import { Switch, Text } from 'react-native-paper';

import { BadgePill } from '@/components/badge-pill';
import { Panel } from '@/components/section';
import { useToast } from '@/components/toast';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { useUpdateOrganizationSettings } from './api';

type Flag = 'canvas_assessments' | 'canvas_assessments_unreviewed';

/** Phase 38: the Assessment menu (beta), and its trial of questions not yet reviewed. */
export function CanvasAssessmentsCard({ enabled, unreviewed }: { enabled: boolean; unreviewed: boolean }) {
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

  return (
    <Panel title="Assessment" testID="org-assessments">
      <View style={{ gap: space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
          <View style={{ flex: 1, gap: space.xs }}>
            <View style={{ flexDirection: 'row' }}>
              <BadgePill />
            </View>
            <Text variant="bodySmall" style={{ color: muted }}>
              When on, everyone here sees an Assessment menu. A student answers approved questions by hand on a
              canvas, one question per page, with nothing marked while they work; on submitting, their tutors and the
              admins get a PDF of the questions and the handwriting. It collects students’ handwriting, so check that
              your consent forms cover it before students under 13 use it.
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
      </View>
    </Panel>
  );
}
