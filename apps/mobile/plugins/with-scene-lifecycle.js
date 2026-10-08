// Adopt the UIScene life cycle, which iOS 27 requires: an app without it is stopped at launch
// (`UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`). Expo SDK 57 ships the scene
// delegate (`ExpoAppSceneDelegate`, objc name EXExpoAppSceneDelegate) but its prebuild template
// still starts React Native from the app delegate. This plugin:
//   1. declares the scene manifest in Info.plist, naming Expo's scene delegate;
//   2. makes AppDelegate an ExpoReactNativeFactoryProvider and stops it creating the window --
//      the scene delegate creates it and starts React Native into it.
// Remove once the Expo template adopts scenes itself.
const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

const WINDOW_BLOCK =
  /#if os\(iOS\) \|\| os\(tvOS\)\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\s*factory\.startReactNative\([\s\S]*?\)\s*#endif\s*/;

function withSceneLifecycle(config) {
  config = withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: 'EXExpoAppSceneDelegate',
          },
        ],
      },
    };
    return cfg;
  });

  config = withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== 'swift') {
      throw new Error('with-scene-lifecycle expects a Swift AppDelegate.');
    }
    let src = cfg.modResults.contents;
    if (!src.includes('ExpoReactNativeFactoryProvider')) {
      src = src.replace(
        'class AppDelegate: ExpoAppDelegate {',
        'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {',
      );
      if (!WINDOW_BLOCK.test(src)) {
        throw new Error('with-scene-lifecycle: the AppDelegate template changed; update the plugin.');
      }
      src = src.replace(
        WINDOW_BLOCK,
        '// The window is created by the scene delegate (plugins/with-scene-lifecycle.js).\n\n    ',
      );
    }
    cfg.modResults.contents = src;
    return cfg;
  });

  return config;
}

module.exports = withSceneLifecycle;
