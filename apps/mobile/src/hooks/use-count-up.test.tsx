import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { useCountUp } from './use-count-up';

// Reduce motion on: the figure must be final at once.
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  useReducedMotion: () => true,
}));

function Probe({ target }: { target: number }) {
  return <Text testID="value">{useCountUp(target)}</Text>;
}

describe('useCountUp', () => {
  it('shows the final value at once under reduced motion', async () => {
    await render(<Probe target={42} />);
    expect(screen.getByTestId('value')).toHaveTextContent('42');
  });

  it('follows a changed target at once under reduced motion', async () => {
    const { rerender } = await render(<Probe target={3} />);
    await rerender(<Probe target={7} />);
    expect(screen.getByTestId('value')).toHaveTextContent('7');
  });
});
