import * as Haptics from 'expo-haptics';

/**
 * The app's one haptics vocabulary (docs/mobile/immersive-design.md, "Haptics"). Components
 * say what happened; this decides how it feels. Never ad-hoc Haptics calls elsewhere.
 */
export const haptics = {
  /** A choice changed: a tab, a segment, a toggle, a star. */
  selection: () => void Haptics.selectionAsync().catch(() => undefined),
  /** Something was saved or done: recorded, posted, sent. */
  success: () =>
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined),
  /** It did not work. */
  error: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined),
  /** About to do something that cannot be undone. */
  warning: () =>
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined),
  /** A light physical cue: a sheet snapping, a timer starting. */
  impact: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined),
};
