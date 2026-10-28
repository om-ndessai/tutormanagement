// Ported from apps/web/src/features/handwriting-lab/samples-card.tsx @ 4b16671 (working tree: Phase 54).
// The lab's corpus: how often the reader was right when each line was saved, and the newest lines.
// Mobile (design #64): the two download links share the file (`shareCorpus`); a delete asks first, as
// a mis-tap on a phone is easy.
import type { HandwritingCorpusSource, HandwritingSample } from '@tmi/shared';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, Divider, Icon, Text } from 'react-native-paper';

import { IconButton } from '@/components/icon-button';
import { OutlinedCard } from '@/components/outlined-card';
import { Skeleton } from '@/components/skeleton';
import { useToast } from '@/components/toast';
import { errorMessage } from '@/features/question-bank/question-card';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import { shareCorpus, useDeleteHandwritingSample, useHandwritingSamples } from './api';
import { categoryCount, sampleMeta, summaryLabel } from './lab-model';
import { mathSpeech } from './math-line-model';
import { MathLine } from './math-line';
import { CODE_FONT } from './reading-panel';

export function SamplesCard() {
  const theme = useAppTheme();
  const toast = useToast();
  const samples = useHandwritingSamples();
  const remove = useDeleteHandwritingSample();
  const [sharing, setSharing] = useState<HandwritingCorpusSource | null>(null);
  const list = samples.data?.data;
  const muted = theme.tokens.mutedForeground;

  async function share(source: HandwritingCorpusSource) {
    haptics.selection();
    setSharing(source);
    try {
      await shareCorpus(source);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSharing(null);
    }
  }

  function confirmDelete(sample: HandwritingSample) {
    haptics.warning();
    Alert.alert('Delete this sample?', 'It leaves the corpus the reader is measured on.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete sample',
        style: 'destructive',
        onPress: () =>
          remove.mutate(sample.id, {
            onSuccess: () => toast.success('Sample deleted.'),
            onError: (error) => toast.error(errorMessage(error)),
          }),
      },
    ]);
  }

  return (
    <OutlinedCard testID="samples-card">
      <View style={{ padding: space.lg, gap: space.md }}>
        <View style={{ gap: space.xs }}>
          <Text variant="titleMedium" accessibilityRole="header">
            Samples
          </Text>
          <Text variant="bodySmall" style={{ color: muted }}>
            Lines kept with what they say. Run them through the reader again with{' '}
            <Text variant="bodySmall" style={{ fontFamily: CODE_FONT }}>
              npm run handwriting:eval
            </Text>{' '}
            after changing it.
          </Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          <Button
            testID="samples-download-samples"
            mode="outlined"
            compact
            icon="share-variant-outline"
            loading={sharing === 'samples'}
            disabled={sharing !== null}
            onPress={() => void share('samples')}
          >
            Samples
          </Button>
          <Button
            testID="samples-download-synthetic"
            mode="outlined"
            compact
            icon="share-variant-outline"
            loading={sharing === 'synthetic'}
            disabled={sharing !== null}
            onPress={() => void share('synthetic')}
          >
            Synthetic set
          </Button>
        </View>

        {samples.isPending ? (
          <Skeleton width="100%" height={96} style={{ borderRadius: radius.md }} />
        ) : !list || list.summary.total === 0 ? (
          <Text testID="samples-empty" variant="bodyMedium" style={{ color: muted }}>
            No samples yet. Write a line, then say whether it was read right.
          </Text>
        ) : (
          <>
            <View testID="samples-summary" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              <View
                style={{
                  backgroundColor: theme.colors.primary,
                  borderRadius: radius.sm,
                  paddingHorizontal: space.sm,
                  paddingVertical: 2,
                }}
              >
                <Text testID="samples-total" variant="labelMedium" style={{ color: theme.colors.onPrimary }}>
                  {summaryLabel(list.summary)}
                </Text>
              </View>
              {list.summary.by_category.map((entry) => (
                <View
                  key={entry.category}
                  style={{
                    borderWidth: 1,
                    borderColor: theme.colors.outlineVariant,
                    borderRadius: radius.sm,
                    paddingHorizontal: space.sm,
                    paddingVertical: 2,
                  }}
                >
                  <Text variant="labelMedium">{categoryCount(entry)}</Text>
                </View>
              ))}
            </View>
            <View>
              {list.samples.map((sample, index) => (
                <View key={sample.id}>
                  {index > 0 ? <Divider /> : null}
                  <SampleRow sample={sample} busy={remove.isPending} onDelete={() => confirmDelete(sample)} />
                </View>
              ))}
            </View>
          </>
        )}
      </View>
    </OutlinedCard>
  );
}

function SampleRow({ sample, busy, onDelete }: { sample: HandwritingSample; busy: boolean; onDelete: () => void }) {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  const meta = sampleMeta(sample);
  const label = [
    sample.matched ? 'Read right' : 'Misread',
    mathSpeech(sample.truth),
    sample.matched ? null : `read as ${sample.reading ?? 'nothing'}`,
    meta,
  ]
    .filter(Boolean)
    .join('. ');
  return (
    <View
      testID={`sample-row-${sample.id}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm }}
    >
      <View accessible accessibilityLabel={label} style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.sm }}>
          <Icon
            source={sample.matched ? 'check' : 'close'}
            size={16}
            color={sample.matched ? theme.colors.primary : theme.colors.error}
          />
          <MathLine latex={sample.truth} size={16} />
          {!sample.matched ? (
            <Text variant="bodySmall" style={{ color: muted }}>
              read as{' '}
              {sample.reading ? (
                <Text variant="bodySmall" style={{ fontFamily: CODE_FONT }}>
                  {sample.reading}
                </Text>
              ) : (
                'nothing'
              )}
            </Text>
          ) : null}
        </View>
        <Text variant="bodySmall" style={{ color: muted }}>
          {meta}
        </Text>
      </View>
      <IconButton
        testID={`sample-delete-${sample.id}`}
        icon="delete-outline"
        size={20}
        accessibilityLabel="Delete sample"
        disabled={busy}
        onPress={onDelete}
      />
    </View>
  );
}

