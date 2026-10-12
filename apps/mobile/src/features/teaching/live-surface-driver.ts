// The live lesson's system surface where there is none (web, Jest): nothing to show.
// The platform drivers are live-surface-driver.ios.ts and live-surface-driver.android.ts.
import type { LiveSurfaceDriver } from './live-surface';

export const liveSurfaceDriver: LiveSurfaceDriver = {
  show: async () => undefined,
  end: async () => undefined,
  isShowing: async () => false,
};
