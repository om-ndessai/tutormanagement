// The app-switcher cover (docs/mobile/ux-audit.md F-1; immersive-design.md §0.4 and §13): no
// money, notes or names on a system surface. iOS writes a snapshot of the screen for the app
// switcher the moment the app stops being the active one -- Finance, Billing, a parent's balance
// or the 1099 would sit there in full, and on disk until the next snapshot replaced it. While
// anybody is signed in, a cover in the organization's colours goes over every window as the app
// resigns active. It is drawn natively (modules/privacy-cover), not by React: a render is not
// guaranteed to land before the snapshot, and a view in the React tree sits under a presented
// form sheet. It shows only while the app is inactive, so screenshots and the flows are unaffected.
//
// expo-screen-capture's blur is the fallback for a binary built before the module: in this app
// (scene life cycle) it did not reach the snapshot, which is why the module exists.
//
// Android has no such cover: its recents preview is blanked by FLAG_SECURE, which SecureMoney
// sets on the money screens of the production build.
import { requireOptionalNativeModule } from 'expo';
import { disableAppSwitcherProtectionAsync, enableAppSwitcherProtectionAsync } from 'expo-screen-capture';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useAppTheme } from '@/providers/theme-provider';

type PrivacyCoverModule = {
  enable(background: string, tint: string): void;
  disable(): void;
};

const native = Platform.OS === 'ios' ? requireOptionalNativeModule<PrivacyCoverModule>('PrivacyCover') : null;

/** Covers the app-switcher snapshot (iOS) for as long as `active` is true. */
export function useAppSwitcherProtection(active: boolean) {
  const theme = useAppTheme();
  const background = theme.colors.background;
  const tint = theme.colors.primary;

  useEffect(() => {
    if (Platform.OS !== 'ios' || !active) return;
    if (native) {
      native.enable(background, tint);
      return () => native.disable();
    }
    enableAppSwitcherProtectionAsync(1).catch(() => {});
    return () => {
      disableAppSwitcherProtectionAsync().catch(() => {});
    };
  }, [active, background, tint]);
}
