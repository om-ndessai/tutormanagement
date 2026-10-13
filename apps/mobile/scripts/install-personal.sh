#!/usr/bin/env bash
# Build the personal variant (the production app, signed by a free Apple ID) and install it on a
# connected or network-paired iPhone. docs/mobile/real-devices.md. Re-run weekly: free-team installs
# expire after 7 days.
#
#   [KEEP_PERSONAL=1] APPLE_TEAM_ID=<Personal Team ID> scripts/install-personal.sh [<device UDID>]
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
echo "› device $DEVICE, team $APPLE_TEAM_ID"

# KEEP_PERSONAL=1 leaves the project as the personal variant, for installing on several phones in a
# row; the last run (or `npx expo prebuild --platform ios --clean`) puts the development one back.
restore() { echo "› restoring the development iOS project"; CI=1 npx expo prebuild --platform ios --clean >/dev/null 2>&1 || true; }
[[ "${KEEP_PERSONAL:-0}" == "1" ]] || trap restore EXIT

echo "› prebuild (personal)"
APP_VARIANT=personal APPLE_TEAM_ID="$APPLE_TEAM_ID" CI=1 npx expo prebuild --platform ios --clean >/dev/null
echo "› build (Release, signed by the free team)"
# expo run:ios cannot create a free team's profile; xcodebuild can, with provisioning updates.
APP_VARIANT=personal xcodebuild -workspace ios/Aimtrue.xcworkspace -scheme Aimtrue \
  -configuration Release -destination "id=$DEVICE" -derivedDataPath build-personal \
  -allowProvisioningUpdates -allowProvisioningDeviceRegistration \
  DEVELOPMENT_TEAM="$APPLE_TEAM_ID" CODE_SIGN_STYLE=Automatic build -quiet
echo "› install"
xcrun devicectl device install app --device "$DEVICE" build-personal/Build/Products/Release-iphoneos/Aimtrue.app >/dev/null
echo "✓ installed. First time on a phone: Settings > General > VPN & Device Management > Trust."
