// Hands a parent created in a nested person form back to the form that asked for one.
//
// The student's form opens a second sheet (`person-form?preset=parent&for=guardian`); the new
// parent's id exists only once that sheet has saved, so it cannot travel as a route param. The
// guardian picker listens while it is mounted, and the nested sheet announces what it created
// just before it closes. Nothing is stored: a listener that is gone simply misses it.

export interface CreatedGuardian {
  id: string;
  full_name: string;
  email: string | null;
}

type Listener = (guardian: CreatedGuardian) => void;
const listeners = new Set<Listener>();

export function onGuardianCreated(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function announceGuardianCreated(guardian: CreatedGuardian): void {
  listeners.forEach((listener) => listener(guardian));
}
