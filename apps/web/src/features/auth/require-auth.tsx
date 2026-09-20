import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2Icon } from 'lucide-react';

import { LogoMark } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/providers/auth-provider';

/**
 * Route guard for everything inside the portal.
 *
 * This is a convenience, not a security boundary — the Worker rejects
 * unauthenticated API calls regardless of what the SPA renders.
 */
export function RequireAuth() {
  const { status, statusMessage } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3">
        <LogoMark className="size-12 opacity-80" />
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2Icon className="size-4 animate-spin" />
          Loading your portal…
        </p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <LogoMark className="size-12 opacity-60" />
        <h1 className="text-xl font-semibold">The portal can’t start</h1>
        <p className="text-muted-foreground text-sm">
          {statusMessage ?? 'The server did not respond. Check your connection and try again.'}
        </p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    // Remember where they were headed so sign-in can return them there.
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return <Outlet />;
}
