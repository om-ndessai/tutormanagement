// Android: one ongoing notification with a system chronometer, requested as a promoted Live Update
// on Android 16+ (modules/live-lesson-notification, Kotlin). See live-surface.ts for the contract.
// A binary built before the module simply shows nothing.
import { requireOptionalNativeModule } from 'expo';

import type { LiveSurfaceDriver } from './live-surface';
import { LIVE_SURFACE_STOP_URL, LIVE_SURFACE_URL } from './live-surface';

type LiveLessonNotificationModule = {
  show(options: {
    title: string;
    startedAtMs: number;
    endsAtMs: number | null;
    openUrl: string;
    stopUrl: string;
    stopLabel: string;
  }): boolean;
  end(): void;
  isShowing(): boolean;
};

const native = requireOptionalNativeModule<LiveLessonNotificationModule>('LiveLessonNotification');

export const liveSurfaceDriver: LiveSurfaceDriver = {
  async show(content) {
    native?.show({
      title: content.title,
      startedAtMs: content.startedAtMs,
      endsAtMs: content.endsAtMs,
      openUrl: LIVE_SURFACE_URL,
      stopUrl: LIVE_SURFACE_STOP_URL,
      stopLabel: 'Stop',
    });
  },
  async end() {
    native?.end();
  },
  async isShowing() {
    return native?.isShowing() ?? false;
  },
};
