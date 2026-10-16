// Ported from apps/web/src/features/organizations/curricula-card.tsx (Phase 35, written together). The web's
// role="switch" button is Paper's Switch, and its radio input Paper's RadioButton.
import { curriculumOfferingSchema, type CurriculumOffering } from '@tmi/shared';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Divider, RadioButton, Switch, Text } from 'react-native-paper';

import { Panel } from '@/components/section';
import { useToast } from '@/components/toast';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import { MIN_TARGET, radius, space } from '@/theme/tokens';
import { useCurriculumOfferings, useUpdateCurriculumOffering } from './api';

interface Choice {
  offered: string[];
  defaultId: string;
}

export function choiceOf(rows: CurriculumOffering[]): Choice {
  return {
    offered: rows.filter((row) => row.offered).map((row) => row.id),
    defaultId: rows.find((row) => row.is_default)?.id ?? '',
  };
}

/**
 * Phase 35: which curricula the organization teaches from, and its default -- one row per
 * curriculum with an Offered switch and a default radio, saved together. Leaving one out retires
 * it: it disappears from the pickers, and every plan, assessment and lesson written against it
 * still reads.
 */
export function CurriculaCard() {
  const offerings = useCurriculumOfferings(true);
  const rows = useMemo(() => offerings.data?.data ?? [], [offerings.data]);

  return (
    <Panel title="Curricula" testID="org-curricula">
      {offerings.isPending ? (
        <Text variant="bodySmall">Loading the curricula…</Text>
      ) : (
        // Keyed on the load, so the choice starts from the server's answer each time.
        <CurriculaChoice key={offerings.dataUpdatedAt} rows={rows} />
      )}
    </Panel>
  );
}

function CurriculaChoice({ rows }: { rows: CurriculumOffering[] }) {
  const theme = useAppTheme();
  const toast = useToast();
  const update = useUpdateCurriculumOffering();
  const muted = theme.tokens.mutedForeground;
  const saved = choiceOf(rows);
  const [choice, setChoice] = useState<Choice>(saved);
  const [error, setError] = useState<string | null>(null);

  const changed =
    saved.defaultId !== choice.defaultId ||
    saved.offered.length !== choice.offered.length ||
    saved.offered.some((id) => !choice.offered.includes(id));

  function setOffered(id: string, on: boolean) {
    haptics.selection();
    setChoice((previous) => ({
      ...previous,
      offered: on ? [...previous.offered, id] : previous.offered.filter((other) => other !== id),
    }));
  }

  async function save() {
    setError(null);
    const input = {
      offered: rows.map((row) => row.id).filter((id) => choice.offered.includes(id)),
      default_curriculum_id: choice.defaultId,
    };
    const verdict = curriculumOfferingSchema.safeParse(input);
    if (!verdict.success) {
      setError(verdict.error.issues[0]?.message ?? 'Check the choice.');
      haptics.error();
      return;
    }
    try {
      await update.mutateAsync(verdict.data);
      toast.success('Curricula saved.');
    } catch (caught) {
      if (caught instanceof ApiRequestError) {
        const fields = caught.fieldErrors;
        setError(fields.offered ?? fields.default_curriculum_id ?? caught.message);
        toast.error(caught.message);
      } else {
        toast.error('Could not save the curricula.');
      }
    }
  }

  return (
    <View style={{ gap: space.lg }}>
      <Text variant="bodySmall" style={{ color: muted }}>
        What plans, assessments and lessons are scored against. Turning one off retires it: it leaves the
        pickers, and everything already written against it still reads. New plans and assessments start in
        the default.
      </Text>

      <View
        accessibilityLabel="Curricula"
        style={{ borderWidth: 1, borderColor: theme.colors.outlineVariant, borderRadius: radius.md }}
      >
        {rows.map((row, index) => {
          const offered = choice.offered.includes(row.id);
          const isDefault = choice.defaultId === row.id;
          return (
            <View key={row.id} testID={`org-curriculum-${row.id}`}>
              {index > 0 ? <Divider /> : null}
              <View style={{ padding: space.md, gap: space.sm }}>
                <View style={{ gap: 2 }}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
                    <Text variant="bodyMedium" style={{ fontWeight: '700', flexShrink: 1 }}>
                      {row.name}
                    </Text>
                    {row.is_default ? <Tag text="Default" /> : null}
                    {row.retired ? <Tag text="Retired" /> : null}
                  </View>
                  <Text variant="bodySmall" style={{ color: muted }}>
                    {[row.source, `${row.level_count} levels`, `${row.topic_count} topics`].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Pressable
                    testID={`org-curriculum-default-${row.id}`}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isDefault, disabled: !offered || update.isPending }}
                    accessibilityLabel={`Make ${row.name} the default`}
                    disabled={!offered || update.isPending}
                    onPress={() => {
                      haptics.selection();
                      setChoice((previous) => ({ ...previous, defaultId: row.id }));
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      minHeight: MIN_TARGET,
                      opacity: offered ? 1 : 0.5,
                    }}
                  >
                    <RadioButton.Android
                      value={row.id}
                      status={isDefault ? 'checked' : 'unchecked'}
                      disabled={!offered || update.isPending}
                      onPress={() => setChoice((previous) => ({ ...previous, defaultId: row.id }))}
                    />
                    <Text variant="bodySmall">Default</Text>
                  </Pressable>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <Text variant="bodySmall">Offered</Text>
                    <Switch
                      testID={`org-curriculum-offer-${row.id}`}
                      value={offered}
                      // The default is always offered: choose another default first.
                      disabled={isDefault || update.isPending}
                      onValueChange={(next) => setOffered(row.id, next)}
                      accessibilityLabel={`Offer ${row.name}`}
                      accessibilityRole="switch"
                      accessibilityState={{ checked: offered, disabled: isDefault || update.isPending }}
                    />
                  </View>
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {error ? (
        <Text testID="org-curricula-error" variant="bodySmall" style={{ color: theme.colors.error }}>
          {error}
        </Text>
      ) : null}

      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm }}>
        {changed ? (
          <Button
            testID="org-curricula-undo"
            mode="text"
            disabled={update.isPending}
            onPress={() => {
              setChoice(saved);
              setError(null);
            }}
          >
            Undo
          </Button>
        ) : null}
        <Button
          testID="org-curricula-save"
          mode="contained"
          onPress={() => void save()}
          loading={update.isPending}
          disabled={!changed || update.isPending}
        >
          Save curricula
        </Button>
      </View>
    </View>
  );
}

function Tag({ text }: { text: string }) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        paddingHorizontal: space.sm,
        paddingVertical: 2,
        borderRadius: radius.sm,
        backgroundColor: withAlpha(theme.tokens.mutedForeground, 0.12),
      }}
    >
      <Text variant="labelSmall" style={{ color: theme.tokens.mutedForeground }}>
        {text}
      </Text>
    </View>
  );
}
