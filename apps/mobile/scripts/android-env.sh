#!/usr/bin/env bash
# Run a command with the Android toolchain: the SDK on PATH and a JDK that the Android Gradle
# Plugin accepts. JDK 24+ (Android Studio's bundled 25) prints a "restricted method" warning from
# the prefab/CMake step, which AGP treats as a failure, so builds use JDK 17 when it is installed
# (`brew install openjdk@17`). Override with ANDROID_JAVA_HOME.
#   scripts/android-env.sh npx expo run:android
set -euo pipefail
JDK17="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
if [[ -n "${ANDROID_JAVA_HOME:-}" ]]; then
  export JAVA_HOME="$ANDROID_JAVA_HOME"
elif [[ -d "$JDK17" ]]; then
  export JAVA_HOME="$JDK17"
fi
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
# The local Worker listens on the Mac's :8787; let the emulator reach it as its own localhost.
adb reverse tcp:8787 tcp:8787 >/dev/null 2>&1 || true
adb reverse tcp:8081 tcp:8081 >/dev/null 2>&1 || true
exec "$@"
