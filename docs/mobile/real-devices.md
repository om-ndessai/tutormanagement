# The production app on your own iPhone (Phase 5, free Apple ID)

**Owner's request, 2026-10-11:** run the production app on an iPhone connected to the Mac mini,
without a paid Apple Developer account and without TestFlight.

A free Apple ID ("Personal Team") can sign the app for **your own devices**, installed from this
Mac. The build is **Release**, with its JavaScript bundled inside. It runs on its own, with no
Metro and no Mac once installed. It talks to the **production** portal (`tutoring`) and signs in
with Google, which already works with no server change.

## What a free Apple ID allows, and what it doesn't

| | Free Apple ID (now) | Paid Developer Program (later) |
| --- | --- | --- |
| Install on your own iPhone from this Mac | yes, by cable or Wi-Fi | yes |
| Install by a link, no Mac (Ad Hoc / internal) | no | yes, up to 100 devices |
| TestFlight / App Store | no | yes |
| How long an install lasts | **7 days**, then reinstall | a year (Ad Hoc), 90 days (TestFlight) |
| Devices | up to 3 | 100 per device type |
| App Groups and push (the lock-screen **Live Activity**) | **no** (left out of this build) | yes |

Everything else works as in the simulator: Google sign-in, quick actions, the privacy cover,
dictation (on-device), and the native calendar.

**Status (2026-10-11):** installed on the owner's iPhone 15 Pro (iOS 26.6.1) from the Mac mini.

## A. Your side, once

- [x] **A1. Connect and trust.** Plug the iPhone in, unlock it, and tap **Trust This Computer**.
  Then `xcrun devicectl list devices` on the Mac lists it as a physical device.
- [x] **A2. Add your Apple ID to Xcode.** Xcode → Settings → **Accounts** → + → Apple ID. A
  free account is enough. It appears as "<Your Name> (Personal Team)".
- [x] **A3. Developer Mode on the iPhone.** Settings → Privacy & Security → **Developer Mode** →
  on, then restart and confirm. The switch appears only after the phone has been connected to
  Xcode once, so open Xcode → Window → **Devices and Simulators** with the phone plugged in.
- [x] **A4. A Google iOS OAuth client for the device build.** In the same Google Cloud project
  as the others, create an iOS client with bundle ID **`com.tutorportal.app.personal`**. Put its ID
  in `apps/mobile/.env.local`:
  ```sh
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID_PERSONAL=…apps.googleusercontent.com
  ```
  A separate bundle ID keeps the free account from claiming `com.tutorportal.app`, which the paid
  account will need later.
- [ ] **A5. Your Google account** must be a person in the production portal (it already is if
  you sign in to the web portal).

## B. My side

- [x] **B1. A `personal` build variant** (`APP_VARIANT=personal`):
  - Bundle ID `com.tutorportal.app.personal`, named "Tutor Portal".
  - Production server, Google sign-in only, no developer sign-in or developer screens.
  - Without the Live Activity extension and its App Group or push entitlements, which a free
    team can't sign.
  - Signed with your Personal Team ID, read from the keychain once A2 is done.
- [x] **B2. Build and install** — one command:
  ```sh
  cd apps/mobile && APPLE_TEAM_ID=<Personal Team ID> scripts/install-personal.sh
  ```
  It prebuilds the personal variant, builds Release with `xcodebuild -allowProvisioningUpdates`
  (`expo run:ios` can't create a free team's profile), installs with `xcrun devicectl`, and
  restores the development project. The first build creates the free certificate and profile.
  - Use the **Personal Team** ID (Xcode → Settings → Accounts, "… (Personal Team)"). The Apple
    ID on this Mac also belongs to another, unrelated organization's team, which must never sign
    this app.
- [x] **B3. Restore the development build for the simulator afterwards**, so other work keeps
  running.

## C. First launch on the iPhone

1. iOS refuses an app from an untrusted developer the first time. Go to Settings → General →
   **VPN & Device Management** → your Apple ID → **Trust**.
2. Open **Tutor Portal**, tap **Sign in with Google**, and choose your account. You land in your
   organization, using **real data**.

## D. Cable-free afterwards, and weekly

- **Wi-Fi installs.** In Xcode → Devices and Simulators, select the iPhone and tick **Connect via
  network**. From then on the build installs over Wi-Fi while the phone is on the same network.
- **Every 7 days** the install expires and the app won't open. Re-run `scripts/install-personal.sh`
  (over Wi-Fi once "Connect via network" is ticked). Your data
  is on the server, so nothing is lost.
- **More phones:** up to 3 on a free account, each needing A1 and A3 once.
