// Phase 78 (JF28, J06A step 40): a tab's screen ends clear of the tab bar's "+" -- its last row never comes to rest
// under the disc, and the scroll bar stops above it too.
import { screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

import { CREATE_DISC, DISC_CENTRE_BELOW_EDGE } from '@/features/shell/tab-bar-hump';
import { TAB_BAR_HUMP } from '@/features/teaching/live-session';
import { renderWithProviders } from '@/test/render';
import { TabBarOverlapContext } from './live-banner-inset';
import { Screen } from './screen';

/** How far the "+" disc rises above the tab bar's flat edge. */
const DISC_RISE = CREATE_DISC / 2 - DISC_CENTRE_BELOW_EDGE;

it('pads a tab screen past the "+" and stops its scroll bar above the hump', async () => {
  await renderWithProviders(
    <TabBarOverlapContext value={TAB_BAR_HUMP}>
      <Screen testID="screen-test">
        <Text>Last row</Text>
      </Screen>
    </TabBarOverlapContext>,
  );
  const scroller = screen.getByTestId('screen-test');
  const padding = StyleSheet.flatten(scroller.props.contentContainerStyle).paddingBottom as number;
  // The disc and the hump both end below the overlap the tabs layout provides; the foot adds a gap of its own.
  expect(TAB_BAR_HUMP).toBeGreaterThanOrEqual(DISC_RISE);
  expect(padding).toBeGreaterThan(TAB_BAR_HUMP);
  expect(scroller.props.scrollIndicatorInsets).toEqual({ bottom: TAB_BAR_HUMP });
});

it('leaves a screen outside the tabs (no hump) its own foot', async () => {
  await renderWithProviders(
    <Screen testID="screen-test">
      <Text>Last row</Text>
    </Screen>,
  );
  expect(screen.getByTestId('screen-test').props.scrollIndicatorInsets).toEqual({ bottom: 0 });
});
