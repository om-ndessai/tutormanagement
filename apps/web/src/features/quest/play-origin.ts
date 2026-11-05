import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// Phase 73 (JF36): leaving a game returns to where it was opened -- the home, the Quest page -- as the app does.
// The origin travels in the history entry's state (never the address, which a game link is shared by).

export interface PlayOriginState {
  from?: string;
}

/** A page of the portal to go back to; never a full-screen Quest page (a game, the wizard, a tile's start). */
function safeOrigin(value: unknown): string | null {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/quest/')
    ? value
    : null;
}

/** Where this full-screen page was opened from: its Exit's target. */
export function useExitTo(fallback = '/quest'): string {
  const location = useLocation();
  return safeOrigin((location.state as PlayOriginState | null)?.from) ?? fallback;
}

/** The origin to hand on when opening a game from here: this page, or, from a full-screen page, the one it came from. */
export function usePlayFrom(): string {
  const location = useLocation();
  const passed = safeOrigin((location.state as PlayOriginState | null)?.from);
  if (!location.pathname.startsWith('/quest/')) return location.pathname;
  // A tile link and the Daily are opened from the home.
  return passed ?? (location.pathname.startsWith('/quest/tile/') || location.pathname.startsWith('/quest/daily/') ? '/' : '/quest');
}

/** Opens a game, carrying where it was opened from. */
export function useGoToGame() {
  const navigate = useNavigate();
  const from = usePlayFrom();
  return useCallback(
    (gameId: string, options: { replace?: boolean } = {}) =>
      navigate(`/quest/games/${gameId}`, { replace: options.replace, state: { from } satisfies PlayOriginState }),
    [navigate, from],
  );
}

/** What a Back button there says: home, Quest, or just Back. */
export function backLabel(to: string): string {
  if (to === '/') return 'Back home';
  if (to === '/quest') return 'Back to Quest';
  return 'Back';
}
