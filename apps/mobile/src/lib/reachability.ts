/**
 * Whether the server answered the last request (ux-audit F-16). The api client reports every
 * outcome: a request that could not reach the server at all marks it unreachable; any answer,
 * even an error, marks it reachable again. Read through `useConnectivity`.
 */
type Listener = () => void;

let unreachable = false;
const listeners = new Set<Listener>();

export function reportReachable(reached: boolean): void {
  if (unreachable === !reached) return;
  unreachable = !reached;
  listeners.forEach((listener) => listener());
}

export function isServerUnreachable(): boolean {
  return unreachable;
}

export function subscribeReachability(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
