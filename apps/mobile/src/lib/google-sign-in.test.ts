// Whether a build offers Google sign-in (G1): iOS needs its variant's client ID; the config must
// never read a missing one as present (a null in app.config reaches the manifest as {}).
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: jest.fn() },
  statusCodes: {},
  isErrorWithCode: () => false,
  GoogleSigninButton: () => null,
}));

function load(extra: Record<string, unknown>) {
  jest.resetModules();
  jest.doMock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra } } }));
  let mod!: typeof import('./google-sign-in');
  jest.isolateModules(() => {
    mod = require('./google-sign-in');
  });
  return mod;
}

describe('googleSignInAvailable (iOS)', () => {
  it('is offered when the build carries its iOS client ID', () => {
    expect(load({ googleIosClientId: 'ios-id.apps.googleusercontent.com' }).googleSignInAvailable()).toBe(
      true,
    );
  });

  it('is hidden when the ID is absent, empty or not text', () => {
    expect(load({}).googleSignInAvailable()).toBe(false);
    expect(load({ googleIosClientId: '' }).googleSignInAvailable()).toBe(false);
    expect(load({ googleIosClientId: {} }).googleSignInAvailable()).toBe(false);
  });

  it('falls back to the build’s web client ID', () => {
    expect(load({ googleWebClientId: 'web.apps.googleusercontent.com' }).FALLBACK_WEB_CLIENT_ID).toBe(
      'web.apps.googleusercontent.com',
    );
  });
});
