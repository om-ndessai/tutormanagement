import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render';
import { FlowSteps } from './flow-steps';

describe('FlowSteps', () => {
  it('ticks the steps done, marks the current one, and leaves a skipped one unticked', async () => {
    await renderWithProviders(
      <FlowSteps
        steps={[
          { key: 'family', label: 'Family' },
          { key: 'student', label: 'Student' },
          { key: 'assessment', label: 'Assessment' },
        ]}
        current="assessment"
        done={new Set(['family'])}
      />,
    );
    expect(screen.getByLabelText('Family, done')).toBeTruthy();
    expect(screen.getByLabelText('Student')).toBeTruthy();
    expect(screen.getByLabelText('Assessment, current step')).toBeTruthy();
  });
});
