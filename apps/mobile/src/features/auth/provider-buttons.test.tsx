import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render';
import { ProviderButtons } from './provider-buttons';

const MS = { id: 'microsoft' as const, label: 'Microsoft', clientId: 'ms' };
const FB = { id: 'facebook' as const, label: 'Facebook', clientId: '1' };

describe('ProviderButtons (Phase 55)', () => {
  it('draws nothing while there are no others', async () => {
    await renderWithProviders(<ProviderButtons providers={[]} busy={null} onSignIn={() => undefined} />);
    expect(screen.queryByTestId('sign-in-providers')).toBeNull();
  });

  it('draws one "Continue with" per provider, and signs in with the one pressed', async () => {
    const onSignIn = jest.fn();
    await renderWithProviders(<ProviderButtons providers={[MS, FB]} busy={null} onSignIn={onSignIn} />);
    expect(screen.getByText('Continue with Microsoft')).toBeTruthy();
    expect(screen.getByText('Continue with Facebook')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('sign-in-provider-facebook'));
    expect(onSignIn).toHaveBeenCalledWith(FB);
  });

  it('holds every button while another way in is busy', async () => {
    await renderWithProviders(<ProviderButtons providers={[MS]} busy="google" onSignIn={() => undefined} />);
    expect(screen.getByTestId('sign-in-provider-microsoft')).toBeDisabled();
  });
});
