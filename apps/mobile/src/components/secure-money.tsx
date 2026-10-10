// Android's FLAG_SECURE while money is on screen (docs/mobile/immersive-design.md, "System
// surfaces"): blank in recents, no screenshots. Production only -- the development and e2e builds
// must stay screenshottable for the flows. Shared by the Finance tabs, Billing, the payment form,
// the parent's Home (whose balances have no Finance tab to hide behind) and Organization (the payer
// TIN). iOS has no FLAG_SECURE: its app-switcher snapshot is covered by privacy-cover.tsx.
import { usePreventScreenCapture } from 'expo-screen-capture';
import { Platform } from 'react-native';

import { APP_VARIANT } from '@/lib/variant';

function PreventCapture({ tag }: { tag: string }) {
  usePreventScreenCapture(tag);
  return null;
}

const SECURE = Platform.OS === 'android' && APP_VARIANT === 'production';

/** Renders nothing; blocks screen capture while mounted, on Android production builds. */
export function SecureMoney({ tag = 'finance' }: { tag?: string }) {
  return SECURE ? <PreventCapture tag={tag} /> : null;
}
