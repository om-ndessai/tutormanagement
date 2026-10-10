import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { Snackbar } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FullWindowOverlay } from 'react-native-screens';

import { haptics } from '@/lib/haptics';
import { NO_PLACEMENT, toastBottom, type ToastPlacement } from './toast-placement';

type Tone = 'success' | 'error' | 'info';
interface ToastMessage {
  id: number;
  text: string;
  tone: Tone;
  action?: { label: string; onPress: () => void };
}

interface ToastApi {
  success: (text: string, action?: ToastMessage['action']) => void;
  error: (text: string) => void;
  info: (text: string, action?: ToastMessage['action']) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
const PlacementContext = createContext<((placement: ToastPlacement) => void) | null>(null);

/**
 * Short confirmations at the bottom of the screen (the web app's sonner toasts), with an
 * optional action such as Undo. A success or error also gives its haptic -- the toast's is the
 * only one, so a caller never adds its own (ux-audit F-19).
 *
 * Placement (ux-audit F-2): above the tab bar and the live lesson banner, which the `(org)` layout
 * reports through `useReportToastPlacement`, so a toast never covers the tab labels or takes a tap
 * meant for a tab. On iOS it is drawn in a window of its own above everything
 * (`FullWindowOverlay`), so a toast raised from a form sheet shows over the sheet rather than
 * under it.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<ToastMessage | null>(null);
  const [placement, setPlacement] = useState<ToastPlacement>(NO_PLACEMENT);
  const insets = useSafeAreaInsets();

  const show = useCallback((text: string, tone: Tone, action?: ToastMessage['action']) => {
    if (tone === 'success') haptics.success();
    if (tone === 'error') haptics.error();
    setCurrent({ id: Date.now(), text, tone, action });
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (text, action) => show(text, 'success', action),
      error: (text) => show(text, 'error'),
      info: (text, action) => show(text, 'info', action),
    }),
    [show],
  );

  const report = useCallback((next: ToastPlacement) => {
    setPlacement((previous) =>
      previous.onTab === next.onTab && previous.bannerInset === next.bannerInset ? previous : next,
    );
  }, []);

  // Paper pads the wrapper by the bottom inset and gives the bar an 8pt margin of its own.
  const bottom = toastBottom(Platform.OS === 'ios' ? 'ios' : 'android', insets.bottom, placement);
  const snackbar = (
    <Snackbar
      testID="toast"
      key={current?.id}
      visible={current !== null}
      onDismiss={() => setCurrent(null)}
      duration={current?.action ? 6000 : 3500}
      wrapperStyle={{ paddingBottom: Math.max(0, bottom - 8) }}
      action={current?.action ? { label: current.action.label, onPress: current.action.onPress } : undefined}
    >
      {current?.text ?? ''}
    </Snackbar>
  );

  return (
    <ToastContext value={api}>
      <PlacementContext value={report}>
        {children}
        {Platform.OS === 'ios' && current ? (
          // Not modal: by default the overlay is an accessibility modal, which hid the whole
          // screen from VoiceOver (and the flows) for as long as a toast showed.
          <FullWindowOverlay unstable_accessibilityContainerViewIsModal={false}>{snackbar}</FullWindowOverlay>
        ) : (
          snackbar
        )}
      </PlacementContext>
    </ToastContext>
  );
}

export function useToast(): ToastApi {
  const context = use(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>.');
  return context;
}

/** Tells the toast what it must clear at the bottom of the screen; reset when the caller goes. */
export function useReportToastPlacement({ onTab, bannerInset }: ToastPlacement) {
  const report = use(PlacementContext);
  useEffect(() => {
    report?.({ onTab, bannerInset });
  }, [report, onTab, bannerInset]);
  useEffect(() => () => report?.(NO_PLACEMENT), [report]);
}
