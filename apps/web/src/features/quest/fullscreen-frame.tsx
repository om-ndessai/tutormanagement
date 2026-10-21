import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { MaximizeIcon, MinimizeIcon, XIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';

// Phase 42: Question Quest runs outside the portal's frame -- no menu, no
// header -- with the browser's own full screen a button away (a browser only
// grants it on a tap, never by itself). docs/gamification-plan.md.

function useFullscreen() {
  const [on, setOn] = useState(() => typeof document !== 'undefined' && Boolean(document.fullscreenElement));
  useEffect(() => {
    const sync = () => setOn(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  const supported = typeof document !== 'undefined' && Boolean(document.documentElement.requestFullscreen);
  async function toggle() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // Refused (an iPhone's Safari has no page full screen): the frame is already distraction-free.
    }
  }
  return { on, supported, toggle };
}

export function QuestFrame({
  title,
  shortTitle,
  status,
  children,
  testId,
}: {
  title: string;
  /** What a phone shows instead, where the header has room for little else. */
  shortTitle: string;
  /** Points, a count, a level: the line at the top right. */
  status?: ReactNode;
  children: ReactNode;
  testId: string;
}) {
  const fullscreen = useFullscreen();

  // Leaving Quest leaves the browser's full screen too.
  useEffect(
    () => () => {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    },
    [],
  );

  return (
    <div className="bg-background text-foreground flex min-h-dvh flex-col" data-testid={testId}>
      <header className="flex items-center gap-3 border-b px-4 py-3 sm:px-6">
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">
          <span className="sm:hidden">{shortTitle}</span>
          <span className="hidden sm:inline">{title}</span>
        </h1>
        {status ? <div className="text-muted-foreground flex items-center gap-3 text-sm">{status}</div> : null}
        {fullscreen.supported && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void fullscreen.toggle()}
            aria-label={fullscreen.on ? 'Leave full screen' : 'Full screen'}
            data-testid="quest-fullscreen"
          >
            {fullscreen.on ? <MinimizeIcon /> : <MaximizeIcon />}
          </Button>
        )}
        <Button asChild variant="outline" size="sm" data-testid="quest-exit">
          <Link to="/quest">
            <XIcon /> Exit
          </Link>
        </Button>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
