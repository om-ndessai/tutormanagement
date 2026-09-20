import { useEffect, useRef, useState } from 'react';

/** Honours the OS "reduce motion" setting, which the app respects globally. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Animates a number up to its target.
 *
 * Eases out, so the figure lands rather than stopping dead. Jumps straight to
 * the value when the viewer has asked for reduced motion, or when the number
 * changes again mid-flight -- a dashboard refreshing under you should not
 * replay its animations.
 */
export function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));
  const previous = useRef(target);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }

    // Only animate the first arrival; later updates are data changes, not
    // entrances, and re-running would make the page feel unstable.
    if (previous.current !== target) {
      previous.current = target;
      setValue(target);
      return;
    }

    const from = 0;
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);

      setValue(Math.round(from + (target - from) * eased));

      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return value;
}
