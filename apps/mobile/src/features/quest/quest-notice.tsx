// The web's sonner toasts in Quest ("Saved. +1 point", "Approved. …", a refusal), said inside Quest's
// own full-screen frame. Mobile: the app's toast draws in a window of its own on iOS
// (`FullWindowOverlay`), which a full-screen modal keeps out of the accessibility tree -- VoiceOver
// (and the UI tests) never reached it over Quest -- so Quest shows the same Snackbar in its own view,
// a live region on Android and announced on iOS, with the toast's haptics. It sits above the keyboard
// when one is up (Android does not resize the window for it, edge to edge).
import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { Snackbar } from 'react-native-paper';

import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { haptics } from '@/lib/haptics';

interface Notice {
  id: number;
  text: string;
}

interface QuestNoticeApi {
  success: (text: string) => void;
  error: (text: string) => void;
}

const QuestNoticeContext = createContext<QuestNoticeApi | null>(null);

/** How long a notice stays: the toast's own. */
export const NOTICE_MS = 3500;

export function QuestNoticeHost({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const keyboard = useKeyboardHeight();

  const show = useCallback((text: string, tone: 'success' | 'error') => {
    if (tone === 'success') haptics.success();
    else haptics.error();
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(text);
    setNotice({ id: Date.now(), text });
  }, []);

  const api = useMemo<QuestNoticeApi>(
    () => ({ success: (text) => show(text, 'success'), error: (text) => show(text, 'error') }),
    [show],
  );

  return (
    <QuestNoticeContext value={api}>
      {children}
      <Snackbar
        testID="quest-notice"
        key={notice?.id}
        visible={notice !== null}
        onDismiss={() => setNotice(null)}
        duration={NOTICE_MS}
        wrapperStyle={{ alignSelf: 'center', maxWidth: 640, bottom: keyboard }}
      >
        {notice?.text ?? ''}
      </Snackbar>
    </QuestNoticeContext>
  );
}

export function useQuestNotice(): QuestNoticeApi {
  const context = use(QuestNoticeContext);
  if (!context) throw new Error('useQuestNotice must be used inside <QuestFrame>.');
  return context;
}
