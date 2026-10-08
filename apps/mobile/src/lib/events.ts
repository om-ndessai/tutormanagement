/**
 * App-wide signals raised outside React (inside the api client, even inside a TanStack Query
 * retry) and handled by the auth provider. The web app uses window events for these.
 */
type EventMap = {
  /** The API refused the request for lack of a valid session. */
  unauthenticated: void;
  /** The API says the active organization may not be entered: none chosen, archived, removed. */
  'organization-required': void;
};

type Listener = () => void;
const listeners: { [K in keyof EventMap]?: Set<Listener> } = {};

export function emit(event: keyof EventMap): void {
  listeners[event]?.forEach((listener) => listener());
}

/** Subscribe; returns the unsubscribe function. */
export function on(event: keyof EventMap, listener: Listener): () => void {
  const set = (listeners[event] ??= new Set());
  set.add(listener);
  return () => set.delete(listener);
}
