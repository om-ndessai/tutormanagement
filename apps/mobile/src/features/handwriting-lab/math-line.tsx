// A reading drawn natively (design #64): text runs as the bank's display text, a `\frac` stacked. See
// math-line-model.ts for why this is not one KaTeX web view per line.
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { useAppTheme } from '@/providers/theme-provider';
import { mathRuns, type MathRun } from './math-line-model';

const FRACTION_SCALE = 0.8;

function Runs({ runs, size, color }: { runs: MathRun[]; size: number; color: string }) {
  return (
    <>
      {runs.map((run, index) =>
        run.kind === 'text' ? (
          <Text key={index} style={{ fontSize: size, lineHeight: size * 1.3, color }}>
            {run.text}
          </Text>
        ) : (
          <View key={index} style={{ alignItems: 'center', paddingHorizontal: 2 }}>
            <View style={styles.row}>
              <Runs runs={run.top} size={size * FRACTION_SCALE} color={color} />
            </View>
            <View style={{ alignSelf: 'stretch', height: StyleSheet.hairlineWidth * 2, backgroundColor: color }} />
            <View style={styles.row}>
              <Runs runs={run.bottom} size={size * FRACTION_SCALE} color={color} />
            </View>
          </View>
        ),
      )}
    </>
  );
}

/** One line of maths: LaTeX without `$`. Hidden from assistive tech; its parent says it in words. */
export function MathLine({ latex, size = 18, testID }: { latex: string; size?: number; testID?: string }) {
  const theme = useAppTheme();
  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.row, { flexWrap: 'wrap', columnGap: 4 }]}
    >
      <Runs runs={mathRuns(latex)} size={size} color={theme.colors.onSurface} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', columnGap: 2 },
});
