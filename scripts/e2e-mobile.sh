#!/usr/bin/env bash
# The mobile app's end-to-end suite: Maestro flows on the iOS simulator and/or the Android
# emulator, against the LOCAL Worker and the local seeded D1 -- never production, never the demo,
# and no Cloudflare quota.
#
#   npm run e2e:mobile -- [ios|android|both] [--release] [--tags=smoke,feature] [flow-or-folder...]
#
# Default mode drives the development build through Metro (fast; rebuilds the app only when it
# is not installed). --release builds and installs the e2e variant (APP_VARIANT=e2e, Release,
# JS embedded) and runs against that, as the phase gate does.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$PWD
MOBILE="$ROOT/apps/mobile"
LOGS="$MOBILE/.maestro/out"
mkdir -p "$LOGS"

# The toolchain from the owner's profile (adb, emulator, maestro, pod, JAVA_HOME).
[[ -f "$HOME/.zprofile" ]] && source "$HOME/.zprofile" >/dev/null 2>&1 || true
export PATH="$HOME/.maestro/bin:$PATH"

PLATFORMS=both
RELEASE=0
TAGS=""
FLOWS=()
for arg in "$@"; do
  case "$arg" in
    ios|android|both) PLATFORMS=$arg ;;
    --release) RELEASE=1 ;;
    --tags=*) TAGS="${arg#--tags=}" ;;
    *) FLOWS+=("$arg") ;;
  esac
done
[[ ${#FLOWS[@]} -eq 0 ]] && FLOWS=("$MOBILE/.maestro")

API=http://localhost:8787
IOS_DEVICE_NAME="${IOS_DEVICE_NAME:-iPhone 17}"
AVD="${AVD:-Medium_Phone_API_37.0}"

# --- 1. Local only, sign-in off -------------------------------------------------------------
if ! curl -sf "$API/api/health" >/dev/null; then
  echo "› starting the local Worker (npm run dev:api)"
  (npm run dev:api >"$LOGS/worker.log" 2>&1 &)
  for _ in $(seq 1 60); do curl -sf "$API/api/health" >/dev/null && break; sleep 2; done
fi
curl -sf "$API/api/health" >/dev/null || { echo "✗ the local Worker did not start (see $LOGS/worker.log)"; exit 1; }
if curl -s "$API/api/auth/config" | grep -q '"auth_enabled":true'; then
  echo "✗ the local Worker has sign-in switched on; the suite signs in through X-Dev-User. Refusing."; exit 1
fi

reset_db() { echo "› resetting the local database"; npm run db:reset >"$LOGS/db-reset.log" 2>&1; }

# --- 2. Devices ---------------------------------------------------------------------------
ios_udid() {
  xcrun simctl list devices available -j | node -e '
    const d = JSON.parse(require("fs").readFileSync(0, "utf8")).devices;
    const all = Object.entries(d).filter(([r]) => r.includes("iOS")).flatMap(([, l]) => l);
    const pick = all.find((x) => x.name === process.argv[1] && x.state === "Booted") || all.find((x) => x.name === process.argv[1]);
    if (pick) console.log(pick.udid);' "$IOS_DEVICE_NAME"
}
boot_ios() {
  local udid; udid=$(ios_udid)
  [[ -z "$udid" ]] && { echo "✗ no iOS simulator named $IOS_DEVICE_NAME"; exit 1; }
  xcrun simctl boot "$udid" 2>/dev/null || true
  xcrun simctl bootstatus "$udid" -b >/dev/null
  echo "$udid"
}
boot_android() {
  if ! adb devices | grep -q "emulator-.*device$"; then
    echo "› booting the Android emulator ($AVD)" >&2
    (nohup emulator -avd "$AVD" -cores 4 -memory 4096 -no-snapshot-save -no-boot-anim >"$LOGS/emulator.log" 2>&1 &)
    adb wait-for-device
    until [[ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]; do sleep 3; done
  fi
  adb reverse tcp:8787 tcp:8787 >/dev/null
  adb reverse tcp:8081 tcp:8081 >/dev/null
  adb devices | awk '/emulator-.*device$/ {print $1; exit}'
}

# --- 3. The app ---------------------------------------------------------------------------
ensure_metro() {
  if ! curl -s localhost:8081/status | grep -q running; then
    echo "› starting Metro"
    (cd "$MOBILE" && nohup npx expo start --dev-client --port 8081 >"$LOGS/metro.log" 2>&1 &)
    for _ in $(seq 1 60); do curl -s localhost:8081/status | grep -q running && break; sleep 2; done
  fi
}
installed_ios() { xcrun simctl get_app_container "$1" "$2" >/dev/null 2>&1; }
installed_android() { adb shell pm list packages | grep -q "package:$1$"; }

build_ios() { # $1 variant, $2 configuration
  (cd "$MOBILE" && APP_VARIANT=$1 CI=1 npx expo prebuild --platform ios --no-install >"$LOGS/prebuild-ios.log" 2>&1 \
    && APP_VARIANT=$1 CI=1 npx expo run:ios --device "$IOS_DEVICE_NAME" --configuration "$2" --no-bundler >"$LOGS/build-ios.log" 2>&1) || true
}
build_android() { # $1 variant, $2 variant flag
  (cd "$MOBILE" && APP_VARIANT=$1 CI=1 npx expo prebuild --platform android --no-install >"$LOGS/prebuild-android.log" 2>&1 \
    && APP_VARIANT=$1 CI=1 scripts/android-env.sh npx expo run:android $2 --no-bundler >"$LOGS/build-android.log" 2>&1) || true
}

if [[ $RELEASE -eq 1 ]]; then VARIANT=e2e; APP_ID=com.tutorportal.app.e2e; else VARIANT=development; APP_ID=com.tutorportal.app.dev; fi

run_platform() { # $1 ios|android
  local device
  if [[ $1 == ios ]]; then
    device=$(boot_ios)
    if [[ $RELEASE -eq 1 ]]; then echo "› building the iOS e2e variant (Release)"; build_ios e2e Release
    elif ! installed_ios "$device" "$APP_ID"; then echo "› building the iOS development app"; build_ios development Debug; fi
    installed_ios "$device" "$APP_ID" || { echo "✗ iOS app not installed (see $LOGS/build-ios.log)"; return 1; }
  else
    device=$(boot_android)
    if [[ $RELEASE -eq 1 ]]; then echo "› building the Android e2e variant (release)"; build_android e2e "--variant release"
    elif ! installed_android "$APP_ID"; then echo "› building the Android development app"; build_android development ""; fi
    installed_android "$APP_ID" || { echo "✗ Android app not installed (see $LOGS/build-android.log)"; return 1; }
  fi
  [[ $RELEASE -eq 0 ]] && ensure_metro
  reset_db
  echo "› running flows on $1 ($device)"
  local tagargs=()
  [[ -n "$TAGS" ]] && tagargs=(--include-tags="$TAGS")
  maestro --device "$device" test -e APP_ID="$APP_ID" ${tagargs[@]+"${tagargs[@]}"} \
    --format junit --output "$LOGS/$1.xml" --test-output-dir "$LOGS/$1" "${FLOWS[@]}"
}

status=0
case "$PLATFORMS" in
  ios) run_platform ios || status=1 ;;
  android) run_platform android || status=1 ;;
  both) run_platform ios || status=1; run_platform android || status=1 ;;
esac
reset_db
[[ $status -eq 0 ]] && echo "✓ mobile e2e passed ($PLATFORMS)" || echo "✗ mobile e2e failed ($PLATFORMS); reports in $LOGS"
exit $status
