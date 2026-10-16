// The finish of Add a student and Add a tutor (UI upgrades U3): the whole draft as ONE `POST /users`
// -- a student with their guardians, so the guardian rule holds -- checked first against the shared
// schema, so an SSN typed into a note never leaves the phone. Refusals come back by field, and the
// step flow opens the step that owns the first of them.
import { createUserRequestSchema } from '@tmi/shared';
import { useCallback, useState } from 'react';

import { issuesToErrors } from '@/features/teaching/session-form/use-session-form';
import { ApiRequestError } from '@/lib/api-client';
import { announceFormSaved } from '@/lib/form-bridge';
import { useOrgTimeZone } from '@/providers/auth-provider';
import { useCreateUser } from './api';
import { toRequest, todayIso, type FormState } from './person-form-model';

export interface AddedPerson {
  id: string;
  name: string;
}

export function useAddPerson() {
  const timeZone = useOrgTimeZone();
  const today = todayIso(timeZone);
  const createUser = useCreateUser();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string> | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  /** Something changed: the server's last word no longer applies. */
  const clearErrors = useCallback(() => {
    setFieldErrors(null);
    setFormError(null);
  }, []);

  /** Sends the draft; the added person, or null when it was refused (the messages are then set). */
  const submit = useCallback(
    async (form: FormState): Promise<AddedPerson | null> => {
      setFormError(null);
      const parsed = createUserRequestSchema.safeParse(toRequest(form, today));
      if (!parsed.success) {
        setFieldErrors(issuesToErrors(parsed.error.issues));
        return null;
      }
      try {
        const saved = await createUser.mutateAsync(parsed.data as never);
        const person = { id: saved.data.id, name: saved.data.full_name };
        // The welcome wizard, when it opened this flow, carries on from the saved record.
        announceFormSaved({ form: 'person', id: person.id, name: person.name });
        return person;
      } catch (error) {
        if (error instanceof ApiRequestError) {
          const byField = error.fieldErrors;
          setFieldErrors(Object.keys(byField).length > 0 ? byField : null);
          setFormError(error.message);
          return null;
        }
        setFormError('Could not add them. Check the connection and try again.');
        return null;
      }
    },
    [createUser, today],
  );

  return { submit, submitting: createUser.isPending, fieldErrors, formError, clearErrors, today };
}
