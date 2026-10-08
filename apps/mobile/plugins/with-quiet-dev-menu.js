// Development builds: the dev client's menu stays closed when a bundle loads and skips its
// first-run onboarding, so the app opens straight onto its own screens -- for people and for
// the Maestro flows alike. (Shake, the floating button or ⌃D still open it.) Expo reads the
// same two keys from Info.plist on iOS and the manifest's meta-data on Android.
const { AndroidConfig, withAndroidManifest, withInfoPlist } = require('expo/config-plugins');

const KEYS = { EXDevMenuShowsAtLaunch: false, EXDevMenuIsOnboardingFinished: true };

module.exports = function withQuietDevMenu(config) {
  config = withInfoPlist(config, (cfg) => {
    Object.assign(cfg.modResults, KEYS);
    return cfg;
  });
  config = withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    for (const [name, value] of Object.entries(KEYS)) {
      AndroidConfig.Manifest.addMetaDataItemToMainApplication(app, name, String(value));
    }
    return cfg;
  });
  return config;
};
