import { useEffect, useRef, useState } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { useTheme } from '@/providers/theme-provider';

const GSI_SRC = 'https://accounts.google.com/gsi/client';

/** The slice of Google Identity Services this component uses. */
interface GoogleIdentityServices {
  accounts: {
    id: {
      initialize(options: {
        client_id: string;
        callback: (response: { credential?: string }) => void;
        auto_select?: boolean;
        cancel_on_tap_outside?: boolean;
      }): void;
      renderButton(
        parent: HTMLElement,
        options: {
          type?: 'standard' | 'icon';
          theme?: 'outline' | 'filled_blue' | 'filled_black';
          size?: 'small' | 'medium' | 'large';
          text?: 'signin_with' | 'signup_with' | 'continue_with';
          shape?: 'rectangular' | 'pill';
          width?: number;
          logo_alignment?: 'left' | 'center';
        },
      ): void;
      disableAutoSelect(): void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityServices;
  }
}

/** Loads the GIS script once per page, even if several components ask for it. */
let scriptPromise: Promise<void> | null = null;

function loadGsi(): Promise<void> {
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      // Let a later attempt retry rather than caching the failure forever.
      scriptPromise = null;
      reject(new Error('Could not load Google sign-in.'));
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}

/**
 * Renders Google's own sign-in button. Google requires that the button be drawn
 * by their script, so this mounts a container and hands it over.
 *
 * `onCredential` receives the ID token, which is opaque here — it only means
 * anything once the Worker has verified it against Google's public keys.
 */
export function GoogleSignInButton({
  clientId,
  onCredential,
  disabled,
}: {
  clientId: string;
  onCredential: (credential: string) => void;
  disabled?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');

  // Google invokes the callback it was given at initialize() time, so keep a
  // ref to the latest handler instead of re-initializing on every render.
  const handlerRef = useRef(onCredential);
  handlerRef.current = onCredential;

  useEffect(() => {
    let cancelled = false;

    loadGsi()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google) return;

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response.credential) handlerRef.current(response.credential);
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'center',
          width: 320,
        });

        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('failed');
      });

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  // Google's button ignores the page theme; re-render it when ours flips so the
  // two do not clash.
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (state !== 'ready' || !containerRef.current || !window.google) return;

    containerRef.current.replaceChildren();
    window.google.accounts.id.renderButton(containerRef.current, {
      type: 'standard',
      theme: resolvedTheme === 'dark' ? 'filled_black' : 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      logo_alignment: 'center',
      width: 320,
    });
  }, [resolvedTheme, state]);

  if (state === 'failed') {
    return (
      <p className="text-destructive text-sm" role="alert">
        Could not reach Google sign-in. Check your connection and reload.
      </p>
    );
  }

  return (
    <div className="flex min-h-11 justify-center">
      {state === 'loading' && <Skeleton className="h-11 w-[320px] rounded-md" />}
      <div
        ref={containerRef}
        // Google's iframe ignores pointer-events styling, so a pending sign-in
        // is blocked by covering it rather than by disabling it.
        className={disabled ? 'pointer-events-none opacity-60' : undefined}
      />
    </div>
  );
}
