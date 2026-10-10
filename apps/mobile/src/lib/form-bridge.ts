// Says what a form sheet saved, to whoever opened it and is still listening.
//
// The welcome wizard (#34) opens the app's own sheets as routes -- the person form, the
// assessment, the plan, the pairing -- and needs to know when one has saved, and what it made
// (the new parent's id, to link the student to). A route param cannot carry that back, so each
// sheet announces what it saved just before it closes, as `guardian-bridge` does for the student
// form. Nothing is stored: a listener that is gone simply misses it, and the sheets behave the
// same whether anyone listens or not.

export type SavedForm = 'person' | 'assessment' | 'plan' | 'assignment';

export interface FormSaved {
  form: SavedForm;
  /** The saved row's id. */
  id: string;
  /** A person's name, for the wizard's next step ("Now the student"). */
  name?: string;
}

type Listener = (event: FormSaved) => void;
const listeners = new Set<Listener>();

/** Subscribe; returns the unsubscribe function. */
export function onFormSaved(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function announceFormSaved(event: FormSaved): void {
  listeners.forEach((listener) => listener(event));
}
