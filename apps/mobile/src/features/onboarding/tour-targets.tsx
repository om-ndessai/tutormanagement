// What the feature tour points at: the phone's form of the web's `data-tour` attributes.
//
// A component that the tour may light calls `useTourTarget(id)` and puts the returned ref on its
// root view; the dashboard's scroll view registers itself with `useTourScroller()`, so a section
// below the fold can be scrolled into view first. Nothing is measured until a tour asks: the
// registry only remembers which views are mounted under which id.
import { createContext, use, useCallback, useState, type ReactNode } from 'react';
import { View as ViewHost, type ScrollView, type View } from 'react-native';

export interface WindowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class TourRegistry {
  private targets = new Map<string, Set<View>>();
  private scroller: ScrollView | null = null;

  register(id: string, view: View): () => void {
    const set = this.targets.get(id) ?? new Set<View>();
    set.add(view);
    this.targets.set(id, set);
    return () => {
      set.delete(view);
      if (set.size === 0 && this.targets.get(id) === set) this.targets.delete(id);
    };
  }

  registerScroller(view: ScrollView): () => void {
    this.scroller = view;
    return () => {
      if (this.scroller === view) this.scroller = null;
    };
  }

  views(id: string): View[] {
    return [...(this.targets.get(id) ?? [])];
  }

  has(prefix: string): boolean {
    return [...this.targets.keys()].some((id) => id.startsWith(prefix));
  }

  getScroller(): ScrollView | null {
    return this.scroller;
  }
}

/** Where a view is on screen; null when it is not laid out (zero size) or cannot be measured. */
export function measureView(view: View): Promise<WindowRect | null> {
  return new Promise((resolve) => {
    try {
      view.measureInWindow((x, y, width, height) => {
        resolve(width > 0 && height > 0 ? { x, y, width, height } : null);
      });
    } catch {
      resolve(null);
    }
  });
}

/** The first view under this id that is on screen now, with where it is. */
export async function resolveTarget(
  registry: TourRegistry,
  id: string,
): Promise<{ view: View; rect: WindowRect } | null> {
  for (const view of registry.views(id)) {
    const rect = await measureView(view);
    if (rect) return { view, rect };
  }
  return null;
}

/**
 * Scrolls the registered scroll view so that `view` sits at `desiredY` in the window (below the
 * header, which iOS draws over the content). Worked out from where things are on screen, so it
 * holds whatever inset the system gives the content: the offset now is the scroll view's top less
 * its content's top, and it moves by how far the target is from where it should be. False when
 * there is no scroller or nothing could be measured.
 */
export async function scrollIntoView(
  registry: TourRegistry,
  view: View,
  desiredY: number,
  animated: boolean,
): Promise<boolean> {
  const scroller = registry.getScroller();
  if (!scroller) return false;
  try {
    // RN has getInnerViewRef (the content view); its TypeScript types do not list it yet.
    const inner =
      (scroller as unknown as { getInnerViewRef?: () => View | null }).getInnerViewRef?.() ?? null;
    const frame = scroller.getNativeScrollRef() as unknown as View | null;
    if (!inner || !frame) return false;
    const [content, box, target] = await Promise.all([
      measureView(inner),
      measureView(frame),
      measureView(view),
    ]);
    if (!content || !box || !target) return false;
    const offset = box.y - content.y;
    scroller.scrollTo({ y: Math.max(0, offset + target.y - desiredY), animated });
    return true;
  } catch {
    return false;
  }
}

// Outside a provider (a component test, a screen outside an organization) nothing is a target.
const detached = new TourRegistry();
const TourTargetsContext = createContext<TourRegistry>(detached);

export function TourTargetsProvider({ children }: { children: ReactNode }) {
  const [registry] = useState(() => new TourRegistry());
  return <TourTargetsContext value={registry}>{children}</TourTargetsContext>;
}

export function useTourRegistry(): TourRegistry {
  return use(TourTargetsContext);
}

/** A ref for the view the tour lights for `id`; no id, no target. */
export function useTourTarget(id: string | undefined): (view: View | null) => void | (() => void) {
  const registry = use(TourTargetsContext);
  return useCallback(
    (view: View | null) => {
      if (!id || !view) return;
      return registry.register(id, view);
    },
    [id, registry],
  );
}

/** A ref for the scroll view that holds the tour's targets (the dashboard's). */
export function useTourScroller(): (view: ScrollView | null) => void | (() => void) {
  const registry = use(TourTargetsContext);
  return useCallback(
    (view: ScrollView | null) => {
      if (!view) return;
      return registry.registerScroller(view);
    },
    [registry],
  );
}

/** A plain view that the tour may light, for content that has no root of its own to carry the ref. */
export function TourTarget({ id, children }: { id: string; children: ReactNode }) {
  const ref = useTourTarget(id);
  return (
    <ViewHost ref={ref} nativeID={id} collapsable={false}>
      {children}
    </ViewHost>
  );
}
