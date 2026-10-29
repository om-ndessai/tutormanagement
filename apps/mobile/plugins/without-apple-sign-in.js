// Keeps Sign in with Apple out of a build while EXPO_PUBLIC_APPLE_SIGN_IN is off. Expo's prebuild
// applies expo-apple-authentication's own plugin whenever the package is installed (it is one of the
// "versioned" SDK plugins), so the entitlement appeared even with the flag off, and a team without the
// capability -- the free Personal Team -- could not sign the app (2026-10-29). This removes it again;
// a config plugin listed in app.config runs its entitlements change after the automatic ones.
const { withEntitlementsPlist } = require('expo/config-plugins');

function withoutAppleSignIn(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults['com.apple.developer.applesignin'];
    return cfg;
  });
}

module.exports = withoutAppleSignIn;
