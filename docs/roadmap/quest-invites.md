# Quest invites: starting a quest and bringing people in (unscheduled, 2026-11-06)

The owner asked: what are the ways a person can start a quest and ask another person to join? How could sharing the
code improve? If the other person is standing next to the starter, can a barcode or NFC help?

**Not scheduled.** Like everything in `docs/roadmap/`, this becomes work only once the owner writes it into
`docs/plan.md` as a phase. It describes and recommends; it builds nothing.

Part 1 is read from the code on `member-home-stickiness` at Phase 77 (commit 8c2762a, plus the working tree of
2026-11-06). Part 2's platform facts were checked on the web on 2026-11-06, with sources. Part 3 ranks what to do.
File and line references are in "Where it lives" at the end.

## In short

- **Five ways to start a quest.** A tile, a favorite, the New Quest wizard, Continue (or "play again"), and "Play with
  Ben" (a child). The Daily is not a game: nobody joins it.
- **Four ways to bring someone in.** The 6-character game code (said aloud, copied or shared), the lobby's QR code,
  a roster favorite's invitation ("Waiting for you"), and, for one's own child with no email, a seat on the parent's
  device.
- **The QR code is half done.** It encodes a web link (`https://<server>/?code=ABC234`). On a phone that link opens
  the browser, never the app, because the app has no universal links or App Links, and no screen in the app reads
  `?code=` from a link. Someone with the app who scans it lands in the browser, and usually has to sign in there.
- **Nobody outside the starter's space can join.** That includes a signed-out guest, a brand-new person (sign-up is
  Post-approved, so they wait up to a day), a friend from another space, and a friend's child with no email. Codes
  are found only in their own space (R13, kept by the owner on 2026-11-04).
- **A member of several spaces is refused too, if the wrong one is open.** The code is looked up only in the space
  the tab or the app is in. The link carries no space, and it should not: a self-serve space's slug is made from its
  join code.
- **Once a game starts, the code disappears.** "Joining open while it runs" is a setting, but neither client shows
  the code or the QR after Start, so a latecomer has nothing to scan or read.
- **QR, yes. NFC, no.**
  - A "Scan a code" button in the app needs only the camera (`expo-camera`), so no paid Apple account.
  - Universal links on the iPhone, and reading NFC inside an iPhone app, both need the paid Apple Developer Program.
    Android App Links need no payment.
  - Phone-to-phone NFC is not open to an app like this on the iPhone, on any membership.
  - An NFC sticker would only be a printed QR that fewer phones can read.

**Recommended first:** the in-app "Scan a code", a code that finds the game in any of the reader's own spaces, and
keeping the code and QR on screen while a late-join game runs. Details in Part 3.

---

## Part 1. What exists today

### Ways to start a quest

| Way | Where | Who can join it | What the client sends |
| --- | --- | --- | --- |
| **A tile** (one tap) | The Quest board on the home, `/play/<tile>` links (web `/play/G4Q5`, app `aimtrue://play/G4Q5`) | Nobody: a single player's game, made and begun in one request | `tileGameRequest`: `players: 'single'` |
| **A favorite** (one tap) | The board's favorites row; the wizard's first step | Single-player favorite: nobody. Multiplayer favorite: anyone in the space with the code, plus its roster | `startRequest`: a multiplayer favorite adds `host_plays: true` (the host is already playing when the lobby opens) and, if it has a roster, `invite_user_ids` (up to 20) |
| **New Quest wizard** | "New Quest" on the board, the Quest page / Quest tab | Multiplayer: anyone in the space with the code | Four steps: level (or Random from a level upward), Score Setup, single or multiplayer (2-20 teams, team size 1-6, joining "Closed once it starts" or "Open while it runs"), then review, with Save as favorite and a roster |
| **Continue / play again** | The board's Continue, Next up's `open_game`, the app's home-screen quick action | Continue reopens the reader's own open game (lobby or running), so others join it as before. "Play Grade 7 Quick 5 again" is always a single player's game | `GET /quest/games/open`; `playAgain` builds a `tileGameRequest` |
| **Play with Ben** (a parent's child card) | The member home, web and app | A child who signs in: an online game of two, the child invited (late join on). A child with no email (Phase 77): a seated game on the parent's device, begun at once; its code finds nothing and nobody else can join | `playTogetherRequest`: `invite_user_ids: [child]`, or `seat_user_ids: [child]` |

**Not games.** The Daily ("Today's Daily") is the platform's same five questions per level per day, played alone and
posted once: nobody joins it. Question Quest (Phase 42) is one student answering the bank. A share card (`/s/<id>`,
Phase 56) is a public picture of a result or one challenge question: it is not an invitation into a game.

### Ways to ask someone to join

| How | What the other person does | Notes |
| --- | --- | --- |
| **Say the code** | Types 6 characters into any "Have a code?" box | 31 characters, none easily misread (no 0/O, 1/I/L). Unique across the whole platform and never reused. The app reads it to screen readers letter by letter (`spelledCode`); the web has no spelled label |
| **Copy** (web only) | Pastes it | Copies the bare code. The app has no Copy button; its code is selectable text |
| **Share** | Opens the message the share sheet sent them (Messages, WhatsApp, AirDrop, Quick Share...) | Text: "Join my Grade 6 Quick 5 quest on Aimtrue: game code ABC234" and the link. The web passes `title`, `text` and `url` to `navigator.share`, else copies text and link; the app passes one `message` string with the link inside it, and no separate `url` |
| **The lobby's QR code** | Points a phone's camera at it | Encodes `<server>/?code=ABC234`. The web uses its own address (so `tmi-portal...` or `tutoring...`); the app uses its server's (`https://tutoring.om-ndessai.workers.dev` for the production app). With no address known, the app's QR holds the bare code. Shown **in the lobby only**: 96 px on the web, 144 pt in the app |
| **A team's code** | Types it: one code alone finds the game AND the team, then one tap | Each named team gets its own 6-character code, shown to that team, the host and the admins (R20). No QR and no Share for a team code |
| **A roster** (multiplayer favorite with players) | Sees "Waiting for you" on the board, or Next up's `game_invite`, and taps Join | Members the maker may name (R27): everyone in a self-serve space; elsewhere, an admin anyone, a member their own family. Seen for 24 hours, while the lobby is open or a late-join game runs. Refreshed every 60 seconds while the home is in front. No push and no email |
| **Play with Ben** | The child's own device shows the invitation (one who signs in), or the child plays on the parent's device (one who does not) | Seats are only for the host's own children here with no email, up to 4 |

**Where a code is typed, and what reads a link.** Every code door is the one "Have a code?" sheet (Phase 72): the
guest page, the home's quick action, the Quest board's box and, on the web, the Question Quest page. Six characters
look a game up and open its join choices; eight look a space up and name it before "Ask to join". The app's Quest tab
also has a Games panel whose box goes straight to the join sheet.

- **The web reads `/?code=`.** The member home and the guest page open the sheet on that code. Signed out, the code
  is **kept on the device** (`guestMemory.keptCode`) and offered once on the first home after sign-up or sign-in
  ("You kept a code on this device: Use it"). Without guest play at that address, `/?code=` goes to the sign-in page
  and comes back to the link afterwards.
- **The app reads no web link.** `app.config.ts` declares the `aimtrue://` scheme only: no `associatedDomains` and
  no Android `intentFilters`. Nothing serves `/.well-known/apple-app-site-association` or `assetlinks.json`. The
  app's first screen ignores `?code=`. The app has no camera or barcode package (`expo-camera`,
  `expo-barcode-scanner`, `react-native-vision-camera`) and no NFC package. The config even switches the camera
  permission off (`expo-image-picker`'s `cameraPermission: false`, which on Android also blocks `CAMERA`).
- **One scheme link would already work, unused.** expo-router maps a link's path to a screen, as it does for
  `aimtrue://play/G4Q5`. So `aimtrue://have-a-code?code=ABC234` should open the app's code sheet, but only while
  signed in and inside a space (the screen sits behind both guards). Nothing produces such a link today. Not tested
  on a device.

### The rules that shape it

- **A code is found only in its own space** (R13, R20). A code from another space gets exactly the answer a wrong
  code gets: "No quest in this space has that code. Quests are joined inside their own space: ask your friend to
  invite you there, or start your own quest." (Phase 72; the owner kept R13 on 2026-11-04, JF9.)
- **"Its own space" means the space open now**, in that tab or the app. The stickiness plan (P6) meant the code box
  to search all of the person's own spaces. It was built for the current space only: "searching all the person's
  spaces waits for games between spaces".
- **A seated game's code finds nothing** (Phase 77): lookup and join answer as if there were no game.
- **Guests cannot join games.** Signed out, a code is only kept on the device; nothing is sent.
- **A newcomer waits.** Sign-up is Post-approved on both platforms: the account waits for a platform admin, "usually
  within a day". It then gets a personal space, not the starter's.
- **A single player's game takes nobody**, and its lookup says so.
- **Late join** is off unless the host chose "Open while it runs". It is on by default only in "Play with Ben", the
  online invite.
- **The countdown:** "Start the quest" sets the first question 5 seconds ahead; Start is disabled until someone has
  joined.
- **Lifetimes:** a lobby nobody starts closes after a day; a count game after three hours. Limits: 60 players, 2-20
  teams, 1-6 players a team.
- **After Start the code is gone from every screen.** Both clients render the code, Share and the QR only in the
  lobby, so a late-join game's code can be read out only from memory.

### What the person next to the starter does today

Counted from the code, not timed on a device. "Tap" includes opening something; typing counts characters.

| Who is next to the starter | Today's quickest path | Taps | Typing |
| --- | --- | --- | --- |
| **A member of the same space, with the app** | Open the app, "Have a code?" (home quick action or the board's box), type the code, Look it up, "Join the quest" | about 4 | 6 characters |
| ... scanning the QR instead | The phone's camera opens the **browser**, not the app. Signed in there: the sheet opens on the code, "Join the quest". Not signed in there (the usual case for app users): Google sign-in first | 2 (signed in) to 5 | none |
| **A member with only a browser** | Scan the QR, tap the camera's banner, "Join the quest" | 2 (signed in) to 5 (signing in) | none |
| ... in a game of teams | As above, then "New team" (name filled in) or "Join a team" with the team's code | +1 | +6 for a team code |
| ... who belongs to several spaces | If the last space they opened is another one: refused with the honest 404. Switch space, open the sheet, type the code again | about +4 | 6 characters |
| **Someone signed out** | Cannot join. The code is kept on the device; sign-up waits for approval (up to a day), then the new account still has to join the starter's space (below). A guest may play the same level alone, where its tile is open to guests. On `tmi-portal` there is no guest play and no sign-up at all | n/a | n/a |
| **Someone in another space** | Cannot join until they are a member: the space's admin adds them (invitation, accepted at sign-in), or they type the space's 8-character code and "Ask to join", and an admin lets them in. Then switch to that space and type the game code | 10 or more, plus an admin | 8 + 6 characters |
| **A child without an email** | Cannot sign in. Only their own guardian can seat them, in a seated game that nobody else can join. A friend's child cannot be seated (refused: not your child here) | n/a | n/a |

**Where the two clients differ.**

| | Web | App |
| --- | --- | --- |
| Copy the code | A Copy button (the code alone) | No button; the code is selectable text |
| Share | `navigator.share({ title, text, url })`; else copies "text link" | `Share.share({ message })`: one string with the link inside |
| Spelled for screen readers | No (the QR's alt text names the code) | Yes, letter by letter |
| The QR's address | The page's own origin | The app's server; the bare code if none is known |
| A shared `/?code=` link | Opens the sheet on the code | Not handled: no universal or App Links |
| Signed out | The same sheet, in "kept" mode | `GuestCodeSheet`, a dialog that keeps the code |
| A 6-character code | Opens the join dialog | Goes straight to the join sheet |

---

## Part 2. Standing next to the starter: what QR and NFC can do

Checked on the web on 2026-11-06; sources are numbered [n] and listed at the end of this part. "⚠" marks a point no
official source settles.

**The free Apple team decides most of this.** The iPhone builds are signed with a free Personal Team
(`docs/mobile/real-devices.md`). Apple's own table of capabilities by membership [1] gives a free "Apple Developer"
account none of these: **Associated Domains** (universal links), **NFC Tag Reading**, **App Clips**, **Push
notifications**, **Group Activities** (SharePlay), Hotspot. Expo's guide of 2026-11-02 says the same [2]. A custom
URL scheme (`aimtrue://`) is not a capability, so it works on a free team [3]. So does the camera, which is a
permission and not a capability.

### What each option does today

| Option | iPhone, free team (today) | iPhone, paid program | Android | Browser only |
| --- | --- | --- | --- | --- |
| **The phone's camera on today's QR** | Opens Safari: the web join page | Opens the app, with universal links [4] | Opens the browser; the app once App Links are set up, which needs no payment [6][7] | Opens the web join page |
| **A Scan button in the app** | Works: the camera permission only [9] | Works | Works | n/a |
| **A Scan button on the web** | Safari has no `BarcodeDetector` by default; a JS decoder needed [11] | same | Chrome has `BarcodeDetector` [11] | depends on the browser |
| **An NFC sticker with the web link** | iPhone XS and later read it with no app: Safari [13] | Opens the app, with universal links [13] | Read while unlocked: the browser, or the app with App Links [17] | n/a |
| **NFC read inside the app** | **No**: the NFC Tag Reading entitlement [1][12] | Yes | Yes, in a dev build [16] | Web NFC: Chrome on Android only [15] |
| **Phone to phone by NFC** | **No** | **No** for an app like this [14] | Android can emulate a tag; whether an iPhone reads it is ⚠ unverified [15] | No (Web NFC has no peer-to-peer) [15] |
| **AirDrop / Quick Share** | Yes, through the share sheet the app already opens [18] | Yes | Quick Share; with AirDrop on some phones since 2025-11 [19] | Web Share: Safari, Chrome Android [18] |
| **Bluetooth, Nearby, Multipeer** | No common API across iPhone, Android and the browser [20] | | | |

### QR codes

- **The phone's own camera.** On an iPhone, a QR code holding an https link shows a banner. The link opens the app
  if the app has a universal link for it, else Safari [4]. On Android 12 and later, a web link opens an app only if
  the app is verified for that domain (App Links); otherwise the default browser [6]. Google does not document
  whether its Camera and Lens hand the link to the system or open their own browser tab ⚠ [8].
- **What a universal link needs (iPhone).**
  - The Worker serves `apple-app-site-association` (no extension) at `https://<host>/.well-known/`, over https with a
    valid certificate and no redirect, one file per host [5].
  - The app carries the Associated Domains entitlement, `applinks:<host>` for each host [5], which in Expo is
    `ios.associatedDomains` [10]. **A free team cannot sign it** [1].
  - Since iOS 14 devices read the file from Apple's CDN, which fetches it within a day; devices check about weekly
    [5]. A host that turned Apple's crawler away once had the failure cached for days ⚠ (a forum report) [5].
  - Apple's page no longer states the content type ⚠. `application/json` is the convention. Serving the file from
    the Worker's own code, with that type set, is the controllable choice.
  - A `workers.dev` host is on the Public Suffix List, so each Worker's address is a site of its own. No source rules
    a `workers.dev` host in or out for universal links ⚠.
- **What an App Link needs (Android).** `/.well-known/assetlinks.json`, served as JSON with no redirect, naming the
  package and the SHA-256 fingerprint of every key that signs a build (debug and release may both be listed) [7].
  The app declares `android.intentFilters` with `autoVerify: true` [10]. **No payment needed.** On Android 15 and
  later, a change to the file can take up to 7 days to reach phones [7].
- **A custom scheme in the QR** (`aimtrue://join?code=ABC234`) is the wrong payload. No official source says what the
  iPhone's camera does with a scheme no app answers; a report shows "No usable data found" ⚠ [3]. Either way, a
  person without the app gets nothing, and a browser-only member gets nothing. Apple recommends universal links
  over schemes, and says that when two apps claim one scheme, which opens is undefined [3]. **Keep the https link in
  the QR.** A button on the web page can still say "Open in the app" with the scheme: no entitlement is needed.
- **Scanning inside the app.** Expo's camera (`expo-camera`) reads QR codes in `CameraView`
  (`barcodeScannerSettings={{ barcodeTypes: ['qr'] }}`, `onBarcodeScanned`) on iPhone and Android [9]. Its config
  plugin writes the camera permission string; its other defaults (`recordAudioAndroid` true, a microphone string)
  would have to be set to match the dictation copy, as `expo-image-picker` already does. The older
  `expo-barcode-scanner` was removed in SDK 52 [9].
  - `CameraView.launchScanner` uses the system's scanner instead: Google's code scanner on Android, which needs no
    camera permission (Play services, Android 6 or later), and Apple's `DataScannerViewController` on iPhone (iOS 16
    or later, an A12 chip or later, camera permission still needed) [9].
  - Not on a simulator [9]. The app runs SDK 57; SDK 58 is current (2026-10-15) [9]. Read the SDK 57 page before
    building (`apps/mobile/CLAUDE.md`).
  - The QR already holds everything the app needs (the code), so reading it costs no request.
- **Scanning on the web.** `BarcodeDetector` works in Chrome on Android (83+) and on macOS and ChromeOS. Safari has it
  only behind a developer flag, so not on iPhones by default. Firefox has none [11]. Where it is missing, a decoder
  library does the job: `barcode-detector` (a polyfill on zxing-wasm, about 15 KB gzipped plus its wasm, which should
  be self-hosted) or `qr-scanner` (about 16 KB gzipped) [11]. The camera needs https, which every address has.

### NFC

- **Reading a tag inside an iPhone app** needs the NFC Tag Reading entitlement [12], which **a free team cannot
  sign** [1]. `react-native-nfc-manager` (4.2.0) has an Expo config plugin and needs a dev build. Android is fine;
  the iPhone needs the paid program [16].
- **Background tag reading** needs no app at all. An iPhone XS or later reads a tag's first link and shows a
  notification. A universal link opens its app; anything else opens Safari. Apple: "Background tag reading doesn't
  support custom URL schemes" [13]. It is off while the camera or Wallet is in use, and before the first unlock [13].
- **An iPhone cannot be a tag for an app like this.** Apple opens card emulation in two ways only [14]:
  - **In the EEA:** HCE from iOS 17.4, for payments, transit, keys, badges, memberships, tickets and
    "device-to-device transactions", by an organisation established in the EEA, enrolled in the paid program, with
    the regulatory right to offer it.
  - **Elsewhere (US, UK, Canada, Japan, Australia and more, iOS 18.1 and later):** the NFC & SE Platform, built on the
    secure element. It needs a commercial agreement with fees, a lab review, and payment, key, transit, ticket,
    loyalty or ID use cases. No general exchange of data between phones.
- **Android** can emulate a card (HCE, since Android 4.4) [15]. Android Beam, the old phone-to-phone NFC, was
  deprecated in Android 10 and removed later [15]. An Android phone can in principle emulate an NDEF tag that holds a
  link. Whether an iPhone reads such a tag, in an app or in the background, is ⚠ unverified: reports are mixed [15].
- **Web NFC** (`NDEFReader`) is Chrome on Android only (89+). It can read and write tags, needs a tap and a visible
  page, and has no peer-to-peer or card emulation [15].
- **A printed sticker.** An NTAG213 sticker holds 144 bytes, enough for `https://<server>/?code=ABC234`. They cost
  about €0.24-0.49 each [17]. Android reads tags while the phone is unlocked; since Android 16 a web link on a tag
  opens like any link, so App Links apply; since Android 17 a notification asks first [17]. A sticker holds a fixed
  link: a game code changes every game, so a sticker can only carry a door (the "Have a code?" sheet) or a space's
  join code.
- **So phone-to-phone NFC is not practical across iPhone and Android for this app**, on any Apple membership. A
  sticker works, but only as a printed QR that fewer phones can read.

### Other near-field options

- **AirDrop and Quick Share.** Both are in the system share sheet the lobby's Share already opens [18].
  - React Native's `Share.share` takes a separate `url` on iOS [18]. Today the app sends one `message` string, so
    AirDrop most likely delivers text rather than a link ⚠ (not tried on a phone). The web's `navigator.share` already
    sends `url`.
  - Google's Quick Share has exchanged files with AirDrop since 2025-11-20 (Pixel 10). On 2026-06-02 it reached more
    phones: Galaxy S24-S26, recent Pixels and others. The iPhone must accept from "Everyone for 10 minutes" [19].
    Whether a plain link (not a file) crosses is ⚠ unverified.
- **Bluetooth and Wi-Fi radios** [20].
  - **Google's Nearby Connections:** Android, plus an iOS Swift package. Its hotspot path needs a capability the free
    team lacks. No React Native module, and working across Android and the iPhone is not documented.
  - **Apple's Multipeer Connectivity:** Apple devices only.
  - **`react-native-ble-plx`:** cannot talk phone to phone.
  - None reaches a browser. Not worth it for a six-character code.
- **"Bring devices together" (NameDrop).** A system feature for contact cards, and for AirDrop between people in each
  other's contacts. Apps join it only through SharePlay, whose capability (Group Activities) a free team lacks [1][21].
- **The code, large, spelled out.** It works for everyone in the room, on every phone, with or without the app. It
  needs nothing but a bigger code, the letters spelled underneath, and a way to keep showing it after Start (Part 3).
- **Pass the device.** Phase 77's seats already do this for a parent's own children with no email: one screen, turns,
  each child credited. It does not stretch to a friend or a friend's child (Part 3).

### Sources (all checked 2026-11-06)

1. Apple, "Supported capabilities (iOS)": developer.apple.com/help/account/reference/supported-capabilities-ios
2. Expo blog, "Apple Developer Program explained: free vs paid" (2026-11-02):
   expo.dev/blog/apple-developer-program-explained-free-vs-paid
3. Apple, "Defining a custom URL scheme for your app":
   developer.apple.com/documentation/xcode/defining-a-custom-url-scheme-for-your-app.
   The camera on an unknown scheme: a community report, chat-archive.fhir.org (2021-05-21) ⚠
4. Apple Tech Talk, "QR Code Recognition on iOS 11": developer.apple.com/videos/play/fall2017/206/
5. Apple, "Supporting associated domains": developer.apple.com/documentation/xcode/supporting-associated-domains; the
   entitlement: developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.associated-domains;
   cached CDN failures: developer.apple.com/forums/thread/805663 ⚠
6. Android 12 behaviour changes (web intents): developer.android.com/about/versions/12/behavior-changes-all
7. Android App Links: developer.android.com/training/app-links, …/configure-assetlinks, …/verify-applinks
8. Pixel Camera help on QR codes: support.google.com/pixelcamera/answer/16561572
9. Expo Camera (SDK 58 page): docs.expo.dev/versions/latest/sdk/camera/; SDK 58: expo.dev/changelog/sdk-58; the
   scanner's removal: expo.dev/changelog/2024-11-12-sdk-52; Google code scanner:
   developers.google.com/ml-kit/vision/barcode-scanning/code-scanner; Apple's data scanner:
   developer.apple.com/documentation/visionkit/scanning-data-with-the-camera
10. Expo linking: docs.expo.dev/linking/ios-universal-links/ and docs.expo.dev/linking/android-app-links/
11. MDN, `BarcodeDetector`: developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector (browser data:
    github.com/mdn/browser-compat-data, `api/BarcodeDetector.json`); github.com/Sec-ant/barcode-detector;
    github.com/nimiq/qr-scanner; sizes from npm and bundlephobia
12. Apple, "Building an NFC tag-reader app": developer.apple.com/documentation/corenfc/building-an-nfc-tag-reader-app
13. Apple, "Adding support for background tag reading":
    developer.apple.com/documentation/corenfc/adding-support-for-background-tag-reading
14. Apple, "HCE-based contactless transactions in apps" (EEA): developer.apple.com/support/hce-transactions-in-apps/;
    "NFC & SE Platform": developer.apple.com/support/nfc-se-platform/; Apple Newsroom, 2024-08-14:
    apple.com/newsroom/2024/08/developers-can-soon-offer-in-app-nfc-transactions-using-the-secure-element/
15. Android HCE: developer.android.com/develop/connectivity/nfc/hce; `NfcAdapter` (Beam):
    developer.android.com/reference/android/nfc/NfcAdapter; Web NFC: developer.chrome.com/docs/capabilities/nfc and
    MDN `NDEFReader`. An iPhone reading an emulated tag: mixed community reports ⚠
16. `react-native-nfc-manager`: github.com/revtel/react-native-nfc-manager (and its `docs/guide/expo.md`)
17. Android NFC basics: developer.android.com/develop/connectivity/nfc/nfc; NTAG213 prices:
    shopnfc.com/en/nfc-stickers/364-nfc-stickers-ntag213-round-o22mm.html
18. React Native `Share`: reactnative.dev/docs/share; AirDrop:
    support.apple.com/guide/iphone/use-airdrop-iphcd8b9f0af/ios;
    Web Share support: MDN browser data (`Navigator.share`)
19. Google, Quick Share with AirDrop: blog.google/products-and-platforms/platforms/android/quick-share-airdrop/
    (2025-11-20); security.googleblog.com/2025/11/android-quick-share-support-for-airdrop-security.html; the June
    2026 Android drop: blog.google/products-and-platforms/platforms/android/Android-Drop-June-2026/; the phone list:
    macrumors.com/2026/06/02/google-airdrop-support-more-android-phones
20. Nearby Connections for iOS: developers.google.com/nearby/connections/swift/get-started; Multipeer Connectivity:
    developer.apple.com/documentation/multipeerconnectivity; github.com/dotintent/react-native-ble-plx
21. NameDrop: support.apple.com/guide/iphone/namedrop-iphone-share-contact-info-iph1b6c664b7/ios; SharePlay over
    AirDrop: developer.apple.com/videos/play/wwdc2023/10239/

---

## Part 3. Recommendations

Ranked by value against effort and risk. Sizes as in `feature-plans.md`: S is under a phase, M about one phase, L
two or three.
"Older apps" is what an app build already on a phone sees once the Worker changes.

| # | What | Value | Size | Paid Apple account? | Older apps |
| --- | --- | --- | --- | --- | --- |
| 1 | "Scan a code" in the app's Have a code? sheet | High | S-M | No | Unchanged (no button) |
| 2 | A code finds the game in any of the reader's own spaces | High | S-M | No | Unchanged (refused, as today) |
| 3 | The code and the QR stay on screen while a late-join game runs | Medium-high | S | No | Unchanged (no code once it runs) |
| 4 | "Show to the room": the code large, spelled, with a large QR; AirDrop carries the link | Medium | S | No | Unchanged |
| 5 | The QR opens the app when it is installed (App Links now; universal links later) | High for app users | M | **Yes, for the iPhone half** | Opens the browser, as today |
| 6 | A friend from another space: a faster "Ask to join" for an admin host | Medium, if it is common | M | No | Unchanged |
| - | Drop: a separate join token, phone-to-phone NFC, NFC stickers, Bluetooth, a wider "pass the device" | | | | |

**Recommended first: 1, 2 and 3**, which fit one phase together, with 4 alongside if it fits. 5 waits for the paid Apple
account (on the same list as push and TestFlight); its Android half can go first if the owner allows one platform
ahead of the other.

### 1. "Scan a code" in the app (high, S-M)

- **What.** A Scan button beside the code box in "Have a code?" (signed in) and in the guest's `GuestCodeSheet`. It
  opens the camera, reads a QR code and fills the code in. No round trip to read it: the QR holds the code. The
  lookup after it is today's.
- **What it accepts.** Today's link (`https://<a known server>/?code=ABC234`, also a space's 8-character code), or a
  bare 6- or 8-character code. Anything else: "That is not an Aimtrue code." One parser in `packages/shared`
  (say `codeFromScan`), so the web and the app read a QR the same way and Jest covers it.
- **How.**
  - `expo-camera` (`npx expo install`, at the SDK 57 version). Prefer `CameraView.launchScanner`, the system's own
    scanner: on Android it needs no camera permission at all. Fall back to `CameraView` with QR-only settings where it
    is not available (an iPhone older than an A12, or an Android phone without Play services) (Part 2).
  - A camera permission string in the same neutral voice as the others ("Used only to scan a quest or space code.
    Nothing is recorded."). Set the plugin's `recordAudioAndroid` to false and its microphone string to the
    dictation copy, as `expo-image-picker` does.
  - **Change `expo-image-picker`'s `cameraPermission: false`**, which today removes the camera permission on Android,
    or the fallback scanner breaks there.
  - A native rebuild of every variant.
  - No frame is stored or sent. Worth a line in `scripts/check-mobile-rules.mjs` that only one file touches the
    camera, as with dictation.
- **Free Apple team:** fine. The camera is a permission, not a capability.
- **Exposure:** nothing new. The QR carries the code only (R20).
- **The web half.** On a phone, the phone's own camera already reads the QR and opens the web page, so a web Scan
  button would help only a laptop or Chrome on Android. Ask the owner to record "app only" for this button in
  `docs/mobile/parity.md`, or build a web button that appears only where `BarcodeDetector` exists.
- **Tests.** The simulators have no camera worth scanning with: the parser in Jest, the button and the permission
  refusal in a Maestro flow with a fake reading, and one check by hand on a phone.
- **Touches:** `apps/mobile/package.json`, `app.config.ts`, `src/features/organizations/code-sheet.tsx`, a small scan
  screen under `src/app/(org)/` (and one outside the guards for the guest), `code-sheet-model.ts`;
  `packages/shared` (the parser).

### 2. A code finds the game in any of the reader's own spaces (high, S-M)

- **What.** When the space open now says "No quest in this space has that code", ask once more across the reader's
  OWN spaces. If the game is in one of them: "This quest is in Ferreira Family Practice. Open it there?", then the
  join choices there. Otherwise the same honest refusal as today. This is what the stickiness plan (P6) asked for
  and left for later.
- **Why it keeps R13.** It answers only with a space the reader already belongs to. For a code from anywhere else,
  the answer is word for word today's 404, and it never says the code exists elsewhere. Codes are already unique
  across the platform, so one indexed read finds the game, and a join against the reader's memberships decides.
- **Why not put the space in the link.** `?org=<slug>` would make the QR work for a multi-space member without a new
  route, but a self-serve space's slug is `s-` plus its join code (`spaceSlugFor`). A QR on a screen, or a link
  forwarded on, would hand out the code that lets anyone ask to join that space. The link should stay useless outside
  its space.
- **How.** A route before a space, beside the others in `routes/spaces.ts` (outside `requireOrg`): `POST
  /api/spaces/find-game { code }` answers `{ slug, name }` or the 404. An `org-scope:` comment on its query (it reads
  across the reader's own memberships only), rate-limited like the space-code lookup, a line in R20 and a case in
  `exposure-organizations.spec.ts`. Both clients switch space, then open the join sheet on the code.
- **Older apps:** they keep the current-space lookup and its refusal. Nothing they call changes.
- **Touches:** `apps/api/src/routes/spaces.ts`, `repositories/quest-games.ts`, `packages/shared` (the reply type),
  the web's `features/organizations/code-sheet.tsx`, the app's `code-sheet.tsx` and `quest/join-game-sheet.tsx`,
  `docs/data-exposure.md`, `e2e/tests/exposure-organizations.spec.ts`, a Maestro flow.

### 3. Keep the code on screen while a late-join game runs (medium-high, S)

- **What.** While a game runs with joining open (`late_join`, not over, not seated, not single player), a small "Game
  code ABC234" with a QR button in the play screen's header, on both clients. Gone when joining closes.
- **Why.** "Open while it runs" exists for the person who arrives late, and today that person has nothing to read or
  scan.
- **Exposure:** the code is already shown to everyone in the lobby (R20). No API change: the game's view already
  carries `code` and `late_join`.
- **Touches:** the web's `features/quest/game-page.tsx` (Play), the app's `quest/game-play.tsx` or `game-screen.tsx`,
  `quest/game-model.ts`.

### 4. "Show to the room", and AirDrop that carries the link (medium, S)

- **Should the lobby lead with the QR? No: lead with the code, and make the QR one tap from full screen.** Saying six
  characters works for everyone in the room: browser-only members, an app user whose camera opens the browser, an old
  phone. The QR wins only once it opens the app (5) or the app can scan (1).
- **What.**
  - Tapping the code or the QR opens a full-screen view: the code as large as fits, in two groups ("ABC 234"), spelled
    underneath ("A, B, C, 2, 3, 4"), and a QR of at least 240 points. Today's web QR is 96 pixels, small at arm's
    length.
  - On a wide screen (a laptop, an iPad), the lobby shows the larger QR beside the code by default.
  - Many letters rhyme when read out (B, C, D, E, G, P, T, V, Z). A spoken hint ("B as in bear") is optional; the
    spelled line covers most of it.
- **AirDrop.** The app's Share passes one `message` string. On iOS, also passing `url` should make AirDrop deliver a
  link, which opens the page (or the app, after 5), rather than a note. The web already passes `url`. Not checked on
  a device.
- **Touches:** the web's `features/quest/lobby-invite.tsx` and `game-page.tsx`; the app's `quest/game-lobby.tsx` and
  `play/qr-code.tsx`.

### 5. The QR opens the app when it is installed (high for app users, M; the iPhone half needs the paid account)

- **Keep the web link in the QR.** It works on every camera with or without the app. A custom scheme in the QR
  (`aimtrue://...`) would do nothing for someone without the app (Part 2).
- **What.**
  - **The Worker** serves `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` itself, as
    JSON, with no redirect: add `/.well-known/*` to `run_worker_first` on all three Workers, each restating its own,
    as CLAUDE.md requires. Cloudflare's documentation does not say how static assets treat a dot-folder or an
    extensionless file, so the Worker route is the safe choice. The paths are `/` with a `code` query (and
    `/play/*`), nothing else.
  - **The app** declares `ios.associatedDomains` (`applinks:` for each address a lobby's QR may carry: the
    `tutoring` and `tmi-portal` hosts for the production app, the test host for "AimTrue-Test") and Android
    `intentFilters` with `autoVerify`. An expo-router `+native-intent` turns `/?code=X` into `/have-a-code?code=X`,
    or keeps the code on the phone when signed out, as the web does.
  - **Android** works with today's tooling: `assetlinks.json` lists the SHA-256 of every key that signs a build. On
    Android 15 and later a change to the file can take a week to reach phones, so it should be right the first time.
  - **The iPhone needs the paid Apple Developer Program**: Apple's table gives a free account no Associated Domains
    (Part 2). Apple's CDN picks the file up within a day, and phones check it about weekly.
  - The QR itself does not change, so this can follow 1 at any time.
- **Until then, on the iPhone:** the web's code sheet, opened on a phone, could offer "Open in the Aimtrue app"
  linking to `aimtrue://have-a-code?code=ABC234`. That is one extra tap, and needs no entitlement. Without the app,
  Safari shows an error, so the button must be worded for people who have the app. It is worth it
  only together with 2, so that the app finds the right space.
- **Exposure:** the association files name the app's ids and two paths; nothing about any person or space.
- **Older apps:** without the entitlement or the filter, a link opens the browser, exactly as today.
- **Touches:** `apps/api/src/index.ts` (the two files), `apps/api/wrangler.jsonc` (three `run_worker_first` lists),
  `apps/mobile/app.config.ts`, a new `apps/mobile/src/app/+native-intent.tsx`, `docs/mobile/real-devices.md` (the
  capability table), and later a real domain's host (`stickiness-later.md`).

### 6. A friend from another space standing next to you (medium if it is common, M)

The owner kept R13 on 2026-11-04 (Phase 72, JF9): "A code admitting a non-member to one game is not scheduled." The
options:

| Option | What it takes | Crosses R13? |
| --- | --- | --- |
| **a. Today's door, faster for an admin host** (recommended, if this turns out to be common) | In the lobby, an admin sees "Someone from outside this space?": the space's 8-character join code as a QR (admins already read it), then the friend's request lands as a "Let in" right there. Only where joining by code is on, never a teen's space | No: the friend becomes a member, the way Phase 52 meant |
| **b. A one-game pass** ("Games between spaces" in `stickiness-later.md`) | A link that admits one person to one game and nothing else; it expires with the game and the host lets each one in. Needs a consent decision for children | **Yes**: the friend reads the host's first name, team names and the scoreboard of another space. The owner's call |
| **c. Seat them on your device** | Not possible: a seat is the host's own child here with no email (R35), credited to that child | n/a |

A new person (no account yet) is not helped by any of these: sign-up is Post-approved, so they wait for a platform
admin first.

**Touches (a):** the web's `game-page.tsx` lobby and `features/organizations` (the code card, Let in), the app's
`game-lobby.tsx` and `let-in` sheet; no new route (`GET /api/organization/code` is already admin-only).

### What to drop

- **A short-lived join link instead of the code.** The code already is one: it lives a day in the lobby and three
  hours in play, is unique across the platform, and shows a member only the level, the rules, the host's first name
  and the teams' sizes. A token adds something only for non-members (6b). Keep the code; the link is the code.
- **Phone-to-phone NFC.** An iPhone cannot act as a tag for an app like this, so it would work only between Android
  phones, or need a native module for a fraction of the room (Part 2).
- **NFC stickers.** A sticker holds a fixed link, and a game code lasts a day, so a classroom sticker could only open
  the "Have a code?" sheet or carry a space's join code. A printed QR does the same, on every phone, for nothing.
  Revisit only if a classroom asks.
- **Bluetooth, Nearby Connections, Multipeer.** No common API across iPhone, Android and the browser, new native
  modules and permissions, for what the code and the QR already do.
- **A wider "pass the device".** Seating a friend's child or a guest would record a person who is not this space's,
  or nobody at all: a consent and R35 question, not a sharing one.

---

## Where it lives

Line numbers as of 2026-11-06 (working tree on `member-home-stickiness`).

**Shared (`packages/shared/src/`)**
- `quest-games.ts`: `GAME_COUNTDOWN_MS` :64, `GAME_ROSTER_MAX` :73, `GAME_SEATS_MAX` :76,
  `GAME_CODE_NOT_FOUND_MESSAGE` :82-83, `GAME_CODE_ALPHABET` / `GAME_CODE_LENGTH` :86-87, `makeGameCode` :90,
  `normalizeGameCode` :99, `createGameSchema` :120-214 (`late_join` :136, `host_plays` :141, `invite_user_ids` :146,
  `seat_user_ids` :154), `joinGameSchema` :270-277, `gameIsSeated` :638, `gameOpenToJoin` :758-762.
- `quest-tiles.ts`: `tileGameRequest` :281. `tile-look.ts`: `openGameLabel` :138, `playAgain` :151.
- `home.ts`: `playWithRequest` :335, `playTogetherRequest` :354, Next up's `game_invite` / `open_game` :424-427,
  the "Have a code?" quick action :695.
- `spaces.ts`: `SPACE_CODE_ALPHABET` / `SPACE_CODE_LENGTH` :19-20, `spaceSlugFor` (a self-serve slug is `s-` + its
  code) :36, `decideLanding` (a link without `?org=` lands in the last space opened) :251.

**Worker (`apps/api/`)**
- `src/routes/quest-games.ts`: `GET /open` :160, `GET /waiting` :193, `POST /` create :255 (seats :278, roster
  :280-286, the code :288-293, invitations :358-366), `POST /lookup` :385-396 (the honest 404 :390), `POST /:id/join`
  :406.
- `src/repositories/quest-games.ts`: `codeInUse` (unique across every space) :115, `findGameByCode` (this space only)
  :179, `inviteToGame` :616, `waitingGames` (24 hours, lobby or late join) :673.
- `src/durable/quest-game.ts`: lobby and game lifetimes :66-68, `lookup` (a seated game is 404) :203-221, `join`
  and its refusals :279-292.
- `src/routes/organization.ts`: the space's join code, admins only :226-250.
- `wrangler.jsonc`: `run_worker_first` (`/api/*`, `/s/*`, `/play/*`; no `/.well-known/*`) :43-46, and restated per
  Worker; `PUBLIC_URL` :160, :263, :338.

**Web (`apps/web/src/`)**
- `features/quest/lobby-invite.tsx`: `gameInviteUrl` :10-12, `LobbyInvite` (QR, Share, the text) :18-56.
- `features/quest/game-page.tsx`: the lobby only :269-273, `Lobby` :301, code, Copy and QR :326-339, a team's code
  :341-347, `CopyButton` :412.
- `features/quest/games-card.tsx`: `GamesCard` (the Quest page's box) :39, `JoinDialog` :181, `JoinChoices` :231.
- `features/organizations/code-sheet.tsx`: `codeKind` :38, `CodeSheet` :48, kept when signed out :69-75 and :85-89,
  `KeptForYou` :229.
- `features/home/member-home.tsx` :101-108 and `features/guest/guest-home.tsx` :55, :286-293: `/?code=` opens the
  sheet. `features/guest/guest-store.ts` :121-123: `keptCode`.
- `features/play/play-home.tsx`: favorites with `host_plays` and the roster :64, the board's code box :480,
  `WaitingForYou` :560. `features/play/play-api.ts` :73-78: refreshed every 60 s.
- `features/quest/start-game-page.tsx`: the wizard's joining choice :335-345.
- `features/guest/play-link.tsx`: `MemberTileStart` :74. `App.tsx`: `/play/:code` :60, `quest/tile/:code` :99,
  `quest/games/:gameId` :101, the member home :104.
- `features/auth/require-auth.tsx` :49-51 (signed out: guest page or sign-in, keeping the link);
  `features/auth/login-page.tsx` :33 (back to it); `features/organizations/require-org.tsx` :14-23.

**App (`apps/mobile/`)**
- `app.config.ts`: the scheme `aimtrue` (`aimtrue-test` for the test app) :153, :171; `ios` with no
  `associatedDomains` :173-193; `android` with no `intentFilters` :194-208; `cameraPermission: false` :228. The
  production server :79-83.
- `package.json`: `qrcode` and `react-native-svg`; no `expo-camera`, `expo-barcode-scanner`,
  `react-native-vision-camera` or NFC module.
- `src/features/quest/game-lobby.tsx`: `inviteMessage` :47-52, the code and Share :113-130, the QR (lobby only)
  :132-142, a team's code :145-167.
- `src/features/play/play-model.ts`: `startRequest` :128-134, `tidyCode` / `codeKind` :137-148, `gameInviteUrl`
  :154-157, `gameShareText` :163-167. `src/features/quest/game-model.ts`: `shareText` :127, `spelledCode` :132.
- `src/features/play/qr-code.tsx`: the QR drawn with Views, no native module.
- `src/features/organizations/code-sheet.tsx`: `CodeSheet` :76 (a game's code goes to `JoinGameSheet` :137),
  `GuestCodeSheet` :199. `code-sheet-model.ts` :15, :55. `kept-for-you.tsx` :42-59.
- Routes: `src/app/(org)/have-a-code.tsx`, `src/app/(org)/quest/join-game.tsx`, `src/app/play/[code].tsx`
  (`aimtrue://play/G4Q5`); `src/app/index.tsx` :9-18 reads no `?code=`; `src/app/_layout.tsx` :124-142 (the guards).
- `src/features/quest/join-game-sheet.tsx` :31-60, `game-join-choices.tsx` :33-60, `games-panel.tsx` :25-37,
  `play/play-home.tsx` :117, :517-526, `home/next-up-card.tsx` :352, `home/home-sections.tsx` :371,
  `shell/quick-actions.ts` :28, :38-39.

**Docs.** `docs/data-exposure.md` R13 :30, R20 :37, R22 :39, R27 :44, R35 :52. `docs/quest-games-plan.md` :21-24
(inside one space). `docs/stickiness-plan.md` P6 :385-411 and P7 :413-431. `docs/journey-fixes-plan.md` :107-117
(Phase 72's decisions). `docs/userjourney/recommendations.md` :495-535 (JF9). `docs/mobile/real-devices.md` :11-20
(what a free Apple ID allows). `docs/roadmap/push-notifications.md` (no push on the iPhone without the paid account).
`docs/roadmap/stickiness-later.md` ("Games between spaces", "A real domain"). `docs/mobile/parity.md` :104 (already
records that the app has no handler for the web's `/?code=` link).
