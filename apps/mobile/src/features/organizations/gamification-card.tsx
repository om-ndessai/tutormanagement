// Ported from apps/web/src/features/organizations/organization-settings-page.tsx (GamificationCard)
// @ 82397b8 (working tree). Phase 42: gamification -- its flags, one switch each. The first is
// Question Quest. The web's switch is Paper's Switch, as on the Assessment card; it saves at once and
// refreshes the session, so the menu follows.
import { useState } from 'react';
import { View } from 'react-native';
import { Switch, Text } from 'react-native-paper';

import { Panel } from '@/components/section';
import { useToast } from '@/components/toast';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { useUpdateOrganizationSettings } from './api';

export function GamificationCard({ questQuest }: { questQuest: boolean }) {
  const theme = useAppTheme();
  const toast = useToast();
  const update = useUpdateOrganizationSettings();
  const { refreshSession } = useAuth();
  // The switch moves at once; it settles on the server's answer, or back if it was refused.
  const [wanted, setWanted] = useState<boolean | null>(null);
  const shown = wanted ?? questQuest;

  async function toggle(next: boolean) {
    haptics.selection();
    setWanted(next);
    try {
      await update.mutateAsync({ gamify_question_quest: next });
      await refreshSession();
      toast.success(next ? 'Question Quest is on.' : 'Question Quest is off.');
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? caught.message : 'Could not change Question Quest.');
    } finally {
      setWanted(null);
    }
  }

  return (
    <Panel title="Gamification" testID="org-gamification">
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
        <View style={{ flex: 1, gap: space.xs }}>
          <Text variant="labelLarge">Question Quest</Text>
          <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
            When on, a student who signs in answers the question bank’s questions that no person has approved
            yet, one at a time from the level their tutor sets, with no going back. Their tutor reviews each
            answer and approves the question for every organization on the platform, or flags it. A student
            earns a point for each answer and another when a correct answer is approved; a tutor earns a point
            for each review.
          </Text>
        </View>
        <Switch
          testID="org-quest-switch"
          value={shown}
          disabled={update.isPending}
          onValueChange={(next) => void toggle(next)}
          accessibilityLabel="Question Quest"
          accessibilityRole="switch"
          accessibilityState={{ checked: shown, disabled: update.isPending }}
        />
      </View>
    </Panel>
  );
}
