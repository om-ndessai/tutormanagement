import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

import { networkConsent } from '@/lib/speech';
import { speechMock } from '@/test/mocks/expo-speech-recognition';
import { renderWithProviders } from '@/test/render';
import { DictationControl } from './dictation-control';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en-US' }] }));

beforeEach(async () => {
  speechMock.reset();
  await AsyncStorage.clear();
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

it('says "on this phone only" where it can, with no switch', async () => {
  await renderWithProviders(<DictationControl testID="profile-dictation" />);
  await waitFor(() => expect(screen.getByText(/On this phone only/)).toBeTruthy());
  expect(screen.queryByTestId('dictation-network-switch')).toBeNull();
});

it('offers the online service, off by default, and keeps the consent on this device', async () => {
  speechMock.onDevice = false;
  await renderWithProviders(<DictationControl testID="profile-dictation" />);
  const toggle = await screen.findByTestId('dictation-network-switch');
  expect(toggle.props.value).toBe(false);
  await fireEvent(toggle, 'valueChange', true);
  const call = (Alert.alert as jest.Mock).mock.calls.find((c) => c[0] === 'Dictate online?');
  expect(call).toBeDefined();
  await act(async () =>
    (call![2] as AlertButton[]).find((b) => b.text === 'Allow on this phone')!.onPress!(),
  );
  await waitFor(() => expect(screen.getByTestId('dictation-network-switch').props.value).toBe(true));
  expect(await networkConsent()).toBe(true);
});
