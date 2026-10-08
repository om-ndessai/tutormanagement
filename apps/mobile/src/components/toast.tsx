import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react';
import { Snackbar } from 'react-native-paper';

import { haptics } from '@/lib/haptics';

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

/**
 * Short confirmations at the bottom of the screen (the web app's sonner toasts), with an
 * optional action such as Undo. A success or error also gives its haptic.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<ToastMessage | null>(null);

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

  return (
    <ToastContext value={api}>
      {children}
      <Snackbar
        testID="toast"
        key={current?.id}
        visible={current !== null}
        onDismiss={() => setCurrent(null)}
        duration={current?.action ? 6000 : 3500}
        action={
          current?.action ? { label: current.action.label, onPress: current.action.onPress } : undefined
        }
      >
        {current?.text ?? ''}
      </Snackbar>
    </ToastContext>
  );
}

export function useToast(): ToastApi {
  const context = use(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>.');
  return context;
}
