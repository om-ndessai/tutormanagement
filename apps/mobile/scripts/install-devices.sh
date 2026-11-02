#!/usr/bin/env bash
# Build the production app ("Aimtrue", the personal variant) and the test app ("AimTrue-Test") once
# each, then install both on every physical iPhone/iPad paired with this Mac, in parallel, each with
# a timeout, so one hung device never blocks the others. The release's last step (CLAUDE.md), and the
# weekly re-install (free-team installs expire after 7 days). docs/mobile/real-devices.md.
#
#   npm run mobile:devices [-- personal|test]   (from the root; APPLE_TEAM_ID in the env or .env.local)
#
# With no arguments it does both variants. Reports per device and variant; one retry for a failed
# install, never a loop. Leaves the iOS project set back to the development variant.
set -uo pipefail
cd "$(dirname "$0")/.."
[[ -f "$HOME/.zprofile" ]] && source "$HOME/.zprofile" >/dev/null 2>&1 || true
# The Personal Team ID may live in .env.local (APPLE_TEAM_ID=...), so `npm run mobile:devices` needs nothing.
[[ -z "${APPLE_TEAM_ID:-}" && -f .env.local ]] && APPLE_TEAM_ID=$(sed -n 's/^APPLE_TEAM_ID=//p' .env.local | head -1)
: "${APPLE_TEAM_ID:?Set APPLE_TEAM_ID to your Personal Team ID (Xcode > Settings > Accounts), or put it in .env.local}"
if [[ $# -gt 0 ]]; then VARIANTS=("$@"); else VARIANTS=(test personal); fi

# Every physical device devicectl knows, reachable or not: an unreachable one is tried and reported.
DEVICES=()
while IFS= read -r line; do DEVICES+=("$line"); done < <(
  xcrun devicectl list devices 2>/dev/null | awk '$0 ~ /physical/ {
    for (i = 1; i <= NF; i++) if ($i ~ /^[0-9A-Fa-f-]{25,40}$/ && $(i+1) == "(UDID)") { id = $i }
    name = $0; sub(/ {2,}.*/, "", name); print id "|" name }')
[[ ${#DEVICES[@]} -eq 0 ]] && { echo "No physical device paired with this Mac."; exit 1; }

restore() { echo "› restoring the development iOS project"; CI=1 npx expo prebuild --platform ios --clean >/dev/null 2>&1 || true; }
trap restore EXIT

declare -a BUILT=()
for VARIANT in "${VARIANTS[@]}"; do
  case "$VARIANT" in personal|test) ;; *) echo "variant must be personal or test"; exit 2 ;; esac
  echo "› $VARIANT: prebuild"
  APP_VARIANT="$VARIANT" APPLE_TEAM_ID="$APPLE_TEAM_ID" CI=1 npx expo prebuild --platform ios --clean >/dev/null || { echo "✗ $VARIANT: prebuild failed"; continue; }
  WORKSPACE=$(ls -d ios/*.xcworkspace | head -1)
  SCHEME=$(basename "$WORKSPACE" .xcworkspace)
  echo "› $VARIANT: build (Release, signed by the free team)"
  # Built once for any iOS device: the free team's profile carries every registered device.
  if ! APP_VARIANT="$VARIANT" xcodebuild -workspace "$WORKSPACE" -scheme "$SCHEME" \
      -configuration Release -destination "generic/platform=iOS" -derivedDataPath "build-$VARIANT" \
      -allowProvisioningUpdates -allowProvisioningDeviceRegistration \
      DEVELOPMENT_TEAM="$APPLE_TEAM_ID" CODE_SIGN_STYLE=Automatic build -quiet >"build-$VARIANT.log" 2>&1; then
    echo "✗ $VARIANT: build failed (apps/mobile/build-$VARIANT.log)"; tail -20 "build-$VARIANT.log"; continue
  fi
  APP="build-$VARIANT/Build/Products/Release-iphoneos/$SCHEME.app"
  # The variant is baked in at build time; a wrong one talks to the wrong server.
  grep -aoq '"variant":"production"' "$APP/EXConstants.bundle/app.config" || { echo "✗ $VARIANT: not a production-runtime build"; continue; }
  BUILT+=("$VARIANT|$APP")
done
[[ ${#BUILT[@]} -eq 0 ]] && { echo "✗ nothing built"; exit 1; }

install_one() { # <udid> <name> <variant> <app>
  local out
  for attempt in 1 2; do
    if out=$(xcrun devicectl device install app --device "$1" "$4" --timeout 300 2>&1); then
      echo "✓ $2: $3 installed"; return 0; fi
    [[ $attempt -eq 1 ]] && sleep 5
  done
  echo "✗ $2: $3 failed -- $(echo "$out" | grep -m1 -iE 'error|unavailable|not' | cut -c1-160)"; return 1
}

echo "› installing on ${#DEVICES[@]} device(s)"
LOGDIR=$(mktemp -d)
for d in "${DEVICES[@]}"; do
  udid="${d%%|*}"; name="${d#*|}"
  ( for b in "${BUILT[@]}"; do install_one "$udid" "$name" "${b%%|*}" "${b#*|}"; done ) >"$LOGDIR/$udid" 2>&1 &
done
wait
cat "$LOGDIR"/*
grep -q "^✗" "$LOGDIR"/* && FAILED=1 || FAILED=0
rm -rf "$LOGDIR"
echo "First time on a device: Settings > General > VPN & Device Management > Trust."
exit $FAILED
