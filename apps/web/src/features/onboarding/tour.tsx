import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TourOutcome } from '@tmi/shared';

import { Button } from '@/components/ui/button';
import type { TourStep } from './tour-steps';

const CARD_WIDTH = 320;
const GAP = 14;
const PAD = 6;

/** The first element carrying this tour id that is actually on screen. */
function visibleTarget(id: string): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`);
  for (const element of candidates) {
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return element;
  }
  return null;
}

/**
 * Where a step points: its own target, or -- for a menu item hidden behind a
 * phone's menu button -- that button. Null when neither is on screen, and the
 * step is then left out.
 */
function resolveTarget(step: TourStep): { element: HTMLElement; inMenu: boolean } | null {
  const own = visibleTarget(step.target);
  if (own) return { element: own, inMenu: false };
  if (step.target.startsWith('nav-')) {
    const toggle = visibleTarget('nav-toggle');
    if (toggle) return { element: toggle, inMenu: true };
  }
  return null;
}

/** Beside the target where there is room, else below or above; a sheet on a phone. */
function cardPosition(rect: DOMRect | null): React.CSSProperties {
  const width = window.innerWidth;
  const height = window.innerHeight;

  if (width < 640 || !rect) {
    return { left: 16, right: 16, bottom: 16 };
  }

  const clampTop = (top: number) => Math.max(16, Math.min(top, height - 240));
  const clampLeft = (left: number) => Math.max(16, Math.min(left, width - CARD_WIDTH - 16));

  if (rect.right + GAP + CARD_WIDTH + 16 <= width) {
    return { left: rect.right + GAP, top: clampTop(rect.top), width: CARD_WIDTH };
  }
  if (rect.left - GAP - CARD_WIDTH >= 16) {
    return { left: rect.left - GAP - CARD_WIDTH, top: clampTop(rect.top), width: CARD_WIDTH };
  }
  if (rect.bottom + GAP + 220 <= height) {
    return { left: clampLeft(rect.left), top: rect.bottom + GAP, width: CARD_WIDTH };
  }
  return { left: clampLeft(rect.left), top: Math.max(16, rect.top - GAP - 220), width: CARD_WIDTH };
}

/**
 * The feature tour (Phase 26): the page dimmed, one part of it lit, and a
 * card saying what that part does. Back, Next, Skip, or Esc to leave.
 *
 * Which steps run is decided once the page has drawn: a step whose target is
 * not on screen -- a panel this person does not have -- is left out, so the
 * counter never promises a step that will not come.
 */
export function Tour({
  steps,
  onDone,
}: {
  steps: TourStep[];
  onDone: (outcome: TourOutcome) => void;
}) {
  const [available, setAvailable] = useState<TourStep[] | null>(null);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [inMenu, setInMenu] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);

  // Wait for the dashboard to have drawn -- the tour may have just navigated
  // there -- then keep the steps that have something to point at.
  useEffect(() => {
    let attempts = 0;
    let timer: number;

    const settle = () => {
      const ready = document.querySelector('[data-tour^="dash-"]') !== null;
      if (ready || attempts >= 25) {
        setAvailable(steps.filter((step) => resolveTarget(step) !== null));
        return;
      }
      attempts += 1;
      timer = window.setTimeout(settle, 100);
    };
    settle();

    return () => window.clearTimeout(timer);
  }, [steps]);

  const step = available?.[index] ?? null;

  const measure = useCallback(() => {
    if (targetRef.current) setRect(targetRef.current.getBoundingClientRect());
  }, []);

  // Point at the current step's target, and keep the light on it as the page
  // scrolls or resizes.
  useLayoutEffect(() => {
    if (!step) return;
    const resolved = resolveTarget(step);
    targetRef.current?.removeAttribute('data-tour-active');

    if (!resolved) {
      targetRef.current = null;
      setRect(null);
      return;
    }

    targetRef.current = resolved.element;
    resolved.element.setAttribute('data-tour-active', 'true');
    setInMenu(resolved.inMenu);

    const box = resolved.element.getBoundingClientRect();
    if (box.top < 0 || box.bottom > window.innerHeight) {
      resolved.element.scrollIntoView({ block: 'center' });
    }
    measure();
    cardRef.current?.focus();
  }, [step, measure]);

  useEffect(() => {
    let frame = 0;
    const onChange = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    window.addEventListener('resize', onChange);
    window.addEventListener('scroll', onChange, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onChange);
      window.removeEventListener('scroll', onChange, true);
      targetRef.current?.removeAttribute('data-tour-active');
    };
  }, [measure]);

  const finish = useCallback(
    (outcome: TourOutcome) => {
      targetRef.current?.removeAttribute('data-tour-active');
      onDone(outcome);
    },
    [onDone],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish('skipped');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finish]);

  // Nothing on this page to point at: there is no tour to give.
  useEffect(() => {
    if (available && available.length === 0) finish('completed');
  }, [available, finish]);

  if (!available || !step) return null;

  const last = index === available.length - 1;

  return createPortal(
    <div className="fixed inset-0 z-[70]" data-testid="tour">
      {/* Holds the page still while the tour talks about it. */}
      <div className="absolute inset-0" aria-hidden />
      {rect ? (
        <div
          aria-hidden
          className="ring-primary pointer-events-none absolute rounded-lg shadow-[0_0_0_9999px_rgb(0_0_0/0.55)] ring-2 transition-all duration-200"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
          }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-black/55" />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        tabIndex={-1}
        className="bg-popover text-popover-foreground absolute rounded-lg border p-4 shadow-xl outline-none"
        style={cardPosition(rect)}
      >
        <p className="text-muted-foreground text-xs" aria-live="polite">
          {index + 1} of {available.length}
        </p>
        <h2 id="tour-title" className="font-display mt-1 text-base font-semibold">
          {step.title}
        </h2>
        <p id="tour-body" className="mt-1 text-sm">
          {step.body}
          {inMenu && <span className="text-muted-foreground"> You will find it in the menu.</span>}
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => finish('skipped')}>
            Skip tour
          </Button>
          <div className="flex gap-2">
            {index > 0 && (
              <Button variant="outline" size="sm" onClick={() => setIndex((current) => current - 1)}>
                Back
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => (last ? finish('completed') : setIndex((current) => current + 1))}
            >
              {last ? 'Finish' : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
