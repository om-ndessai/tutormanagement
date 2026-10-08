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
  the e2e variant of the app, and runs the Maestro flows in `apps/mobile/.maestro/`.
- It refuses any server that is not local, and any server with sign-in switched on.
- It spends no Cloudflare quota.
