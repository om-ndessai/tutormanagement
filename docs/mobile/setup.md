# Mobile setup

## Toolchain (verified on 2026-10-07)

| Tool | Version, or where it lives |
| --- | --- |
| Xcode | 27.0 (27A266a). `xcode-select -p` must print `/Applications/Xcode.app/Contents/Developer` |
| iOS simulator | iOS 27.0 runtime, iPhone 17 |
| Android SDK | `~/Library/Android/sdk`: platform android-37.0, build-tools 36.0.0, command-line tools |
| Android emulator | AVD `Medium_Phone_API_37.0` (Google Play image) |
| Java | OpenJDK 25.0.3 bundled with Android Studio (`JAVA_HOME`). Zulu 17 is the fallback if Gradle ever refuses it |
| CocoaPods, watchman | Homebrew |
| Maestro | `~/.maestro/bin/maestro` (2.11.0) |
| Node | 24 (`.nvmrc`) |

`~/.zprofile` exports these:

```sh
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin:$HOME/.maestro/bin:$PATH"
```

If Homebrew's Command Line Tools ever take over the active developer directory, switch it back:
`sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`.

## Running the app

```sh
npm run mobile:install          # once, and whenever apps/mobile/package.json changes
npm run db:reset                # local D1: schema, seed, platform admin
npm run dev:api                 # the Worker on :8787, with sign-in off (apps/api/.dev.vars)
npm run mobile:ios              # build and launch on the iOS simulator
npm run mobile:android          # build and launch on the Android emulator
```

- The app finds the local Worker at `http://localhost:8787`. On Android this works through
  `adb reverse tcp:8787 tcp:8787`, which the scripts run for you.
- Use the developer sign-in screen to pick a seeded person.

## Testing

```sh
npm run e2e:mobile -- ios       # or android, or both
```

- This resets the local database, starts the Worker if it isn't running, builds and installs
  the app if it is missing, and runs the Maestro flows in `apps/mobile/.maestro/`
  (`--release` builds the e2e variant; `--tags=smoke` or a flow folder narrows the run).
- `npm run smoke` is the short check after any change to the API, the shared contract or the
  schema: the web app's `@smoke` tests, then the `smoke` flows on both platforms.
- It refuses any server that is not local, and any server with sign-in switched on.
- It spends no Cloudflare quota.

## Building the production variant locally (Release check)

This checks the store build on the simulator against the **local** Worker. It never touches
production.

```sh
# 1. Local sign-in on: AUTH_ENABLED=true in apps/api/.dev.vars (uncommitted), then restart:
npm run dev:api
# 2. Production variant, Release, pointed at the local Worker (the same env on both commands:
#    the build re-reads app.config.ts). EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID comes from .env.local.
cd apps/mobile
APP_VARIANT=production EXPO_PUBLIC_PRODUCTION_API_URL=http://localhost:8787 npx expo prebuild --platform ios --clean
APP_VARIANT=production EXPO_PUBLIC_PRODUCTION_API_URL=http://localhost:8787 npx expo run:ios --configuration Release --device "iPhone 17" --no-bundler
```

- The app installs as `com.tutorportal.app` ("Tutor Portal"), beside the development app. Its
  sign-in screen offers Google only.
- The localhost URL is the only reason this build allows plain http (`NSAllowsLocalNetworking`).
  A real production build is HTTPS only.
- **Afterwards, restore:**
  - set `AUTH_ENABLED=false` and restart the Worker;
  - run `npx expo prebuild --platform ios --clean` (no `APP_VARIANT`);
  - run `npx expo run:ios --device "iPhone 17" --no-bundler`, so the development app and the
    flows keep working.
- **Icon or splash changed?** Edit `assets/source/*.svg`, then run `scripts/render-icons.sh`
  (`brew install librsvg`). Look at every PNG before committing.
- **Store builds** go through EAS (`apps/mobile/eas.json`; see testflight.md, "What T2 needs from
  the owner").
