// Phase 72 (owner, 2026-11-04; UI audit JF12): someone a space added reads and accepts the terms and the privacy
// notice once, at their first sign-in. "Accept and continue" waits for the tick, sends the versions this build shows
// (POST /auth/legal), then reads the session again; a refusal is said in the server's words; Sign out is the other
// way out. The links open the server's own pages.
import { PRIVACY_VERSION, TERMS_VERSION } from '@tmi/shared';
import { act, fireEvent, screen } from '@testing-library/react-native';

import { ApiRequestError } from '@/lib/api-client';
import { renderWithProviders } from '@/test/render';
import { LEGAL_ACCEPTANCE, LegalSheet } from './legal-sheet';

const mockPost = jest.fn();
jest.mock('@/lib/api-client', () => ({
  ...jest.requireActual('@/lib/api-client'),
  apiClient: { post: (path: string, body?: unknown) => mockPost(path, body) },
}));
const mockRefresh = jest.fn(async () => undefined);
const mockSignOut = jest.fn(async () => undefined);
jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ refreshSession: mockRefresh, signOut: mockSignOut }),
}));
const mockLegal = jest.fn();
jest.mock('./legal-links', () => {
  const { Pressable, Text } = jest.requireActual('react-native');
  return {
    LegalLink: ({ kind, label, testID }: { kind: string; label: string; testID: string }) => (
      <Pressable testID={testID} onPress={() => mockLegal(kind)}>
        <Text>{label}</Text>
      </Pressable>
    ),
  };
});

beforeEach(() => jest.clearAllMocks());

it('accepts the versions this build shows, once ticked, then reads the session again', async () => {
  expect(LEGAL_ACCEPTANCE).toEqual({ terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION });
  mockPost.mockResolvedValue({ data: { accepted: true } });
  await renderWithProviders(<LegalSheet />);
  expect(screen.getByText('Before you start')).toBeTruthy();
  expect(screen.getByText(/You were added by a space/)).toBeTruthy();
  expect(screen.getByTestId('legal-accept')).toBeDisabled();
  await fireEvent.press(screen.getByTestId('legal-agree'));
  expect(screen.getByTestId('legal-agree')).toHaveProp('accessibilityState', { checked: true });
  await act(async () => {
    await fireEvent.press(screen.getByTestId('legal-accept'));
  });
  expect(mockPost).toHaveBeenCalledWith('/auth/legal', { terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION });
  expect(mockRefresh).toHaveBeenCalled();
});

it('opens the terms and the privacy notice, and Sign out signs out', async () => {
  await renderWithProviders(<LegalSheet />);
  await fireEvent.press(screen.getByTestId('legal-terms'));
  await fireEvent.press(screen.getByTestId('legal-privacy'));
  expect(mockLegal.mock.calls).toEqual([['terms'], ['privacy']]);
  await fireEvent.press(screen.getByTestId('legal-sign-out'));
  expect(mockSignOut).toHaveBeenCalled();
  expect(mockPost).not.toHaveBeenCalled();
});

it('says a refusal in the server’s words, and stays', async () => {
  mockPost.mockRejectedValue(new ApiRequestError(422, 'validation_failed', 'Please correct the highlighted fields.'));
  await renderWithProviders(<LegalSheet />);
  await fireEvent.press(screen.getByTestId('legal-agree'));
  await act(async () => {
    await fireEvent.press(screen.getByTestId('legal-accept'));
  });
  expect(screen.getByTestId('legal-error')).toHaveTextContent('Please correct the highlighted fields.');
  expect(mockRefresh).not.toHaveBeenCalled();
});
