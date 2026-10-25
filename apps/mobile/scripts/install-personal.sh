#!/usr/bin/env bash
# Build the personal variant (the production app, signed by a free Apple ID) and install it on a
# connected or network-paired iPhone. docs/mobile/real-devices.md. Re-run weekly: free-team installs
# expire after 7 days.
#
#   [VARIANT=personal|test] [KEEP_PERSONAL=1] APPLE_TEAM_ID=<Personal Team ID> scripts/install-personal.sh [<device UDID>]
#
# VARIANT=test builds "AimTrue-Test" (Phase 53), the production app pointed at the test Worker; it
# needs EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID_TEST in .env.local. The default is the personal build.
#
# Needs: your Apple ID in Xcode (Settings > Accounts), Developer Mode on the iPhone, and
# EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID_PERSONAL in .env.local. Leaves the iOS project set back to the
# development variant afterwards, so simulator work carries on.
set -euo pipefail
cd "$(dirname "$0")/.."
[[ -f "$HOME/.zprofile" ]] && source "$HOME/.zprofile" >/dev/null 2>&1 || true
: "${APPLE_TEAM_ID:?Set APPLE_TEAM_ID to your Personal Team ID (Xcode > Settings > Accounts)}"

DEVICE="${1:-$(xcrun devicectl list devices 2>/dev/null | awk '$0 !~ /simulated/ && $0 ~ /available|connected/ {for (i=1;i<=NF;i++) if ($i ~ /^[0-9A-F]{8}-[0-9A-F]{16}$/) {print $i; exit}}')}"
[[ -z "$DEVICE" ]] && { echo "No iPhone found: connect it, or pass its UDID."; exit 1; }
VARIANT="${VARIANT:-personal}"
case "$VARIANT" in personal|test) ;; *) echo "VARIANT must be personal or test"; exit 2 ;; esac
echo "› device $DEVICE, team $APPLE_TEAM_ID, variant $VARIANT"

# KEEP_PERSONAL=1 leaves the project as the personal variant, for installing on several phones in a
# row; the last run (or `npx expo prebuild --platform ios --clean`) puts the development one back.
restore() { echo "› restoring the development iOS project"; CI=1 npx expo prebuild --platform ios --clean >/dev/null 2>&1 || true; }
[[ "${KEEP_PERSONAL:-0}" == "1" ]] || trap restore EXIT

echo "› prebuild ($VARIANT)"
APP_VARIANT="$VARIANT" APPLE_TEAM_ID="$APPLE_TEAM_ID" CI=1 npx expo prebuild --platform ios --clean >/dev/null
# The project is named after the app ("Aimtrue", "AimTrueTest"): read it rather than assume.
WORKSPACE=$(ls -d ios/*.xcworkspace | head -1)
SCHEME=$(basename "$WORKSPACE" .xcworkspace)
echo "› build (Release, signed by the free team)"
# expo run:ios cannot create a free team's profile; xcodebuild can, with provisioning updates.
APP_VARIANT="$VARIANT" xcodebuild -workspace "$WORKSPACE" -scheme "$SCHEME" \
  -configuration Release -destination "id=$DEVICE" -derivedDataPath "build-$VARIANT" \
  -allowProvisioningUpdates -allowProvisioningDeviceRegistration \
  DEVELOPMENT_TEAM="$APPLE_TEAM_ID" CODE_SIGN_STYLE=Automatic build -quiet
echo "› install"
APP="build-$VARIANT/Build/Products/Release-iphoneos/$SCHEME.app"
# The variant is baked into the bundle at build time; a wrong one talks to the wrong server.
grep -aoq '"variant":"production"' "$APP/EXConstants.bundle/app.config" || { echo "✗ $APP is not a production-runtime build"; exit 1; }
xcrun devicectl device install app --device "$DEVICE" "$APP" --timeout 300 >/dev/null
echo "✓ installed. First time on a phone: Settings > General > VPN & Device Management > Trust."
