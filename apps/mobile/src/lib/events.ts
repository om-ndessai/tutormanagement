/**
 * App-wide signals raised outside React (inside the api client, even inside a TanStack Query
 * retry) and handled by the auth provider. The web app uses window events for these.
 */
type EventMap = {
  /** The API refused the request for lack of a valid session. */
  unauthenticated: void;
  /** The API says the active organization may not be entered: none chosen, archived, removed. */
  'organization-required': void;
  /** Phase 50: a feature set is off here now (the session's organization is stale). */
  'feature-unavailable': void;
  /**
   * Phase 65 (A4, A7): the person may not use the app -- their sign-up waits for approval or was
   * declined, or sign-up is by invitation and they are not on the list. Carries the server's words, and
   * (not_on_list, UI audit JF8) the address the server checked, when it says (`details.email`).
   */
  'access-refused': { code: string; message: string; email?: string };
};

type EventName = keyof EventMap;
type Listener<K extends EventName> = (payload: EventMap[K]) => void;
const listeners: Partial<Record<EventName, Set<(payload: any) => void>>> = {};

export function emit<K extends EventName>(
  event: K,
  ...payload: EventMap[K] extends void ? [] : [EventMap[K]]
): void {
  listeners[event]?.forEach((listener) => listener(payload[0]));
}

/** Subscribe; returns the unsubscribe function. */
export function on<K extends EventName>(event: K, listener: Listener<K>): () => void {
  const set = (listeners[event] ??= new Set());
  set.add(listener);
  return () => set.delete(listener);
}
