import { useState } from 'react';
import { toast } from 'sonner';
import { SearchIcon } from 'lucide-react';
import type { PlatformPerson } from '@tmi/shared';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ApiRequestError } from '@/lib/api-client';
import { useLookupPerson, useUnpinPerson, useUpdatePerson } from './api';
import { FormField } from './form-field';

/**
 * Correcting a person's SHARED details -- name, email, phone -- which show in
 * every organization they belong to. An organization's own admins cannot
 * change these for someone who belongs to more than one, which is what stops
 * one organization taking over another's member by changing their email.
 */
export function PlatformPeoplePage() {
  const lookup = useLookupPerson();
  const update = useUpdatePerson();
  const unpin = useUnpinPerson();
  const [query, setQuery] = useState('');
  const [person, setPerson] = useState<PlatformPerson | null>(null);
  const [form, setForm] = useState({ full_name: '', email: '', phone: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function find(event: React.FormEvent) {
    event.preventDefault();
    try {
      const found = (await lookup.mutateAsync(query)).data;
      setPerson(found);
      setForm({ full_name: found.full_name, email: found.email ?? '', phone: found.phone ?? '' });
      setErrors({});
    } catch (caught) {
      setPerson(null);
      toast.error(caught instanceof ApiRequestError ? caught.message : 'Lookup failed.');
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!person) return;
    setErrors({});
    try {
      const updated = (await update.mutateAsync({ id: person.id, input: form })).data;
      setPerson(updated);
      toast.success('Shared details saved, in every organization.');
    } catch (caught) {
      if (caught instanceof ApiRequestError) {
        setErrors(caught.fieldErrors);
        toast.error(caught.message);
      }
    }
  }

  return (
    <>
      <PageHeader
        title="People"
        description="Correct someone’s shared name, email or phone, or let a recreated Google account sign in again."
      />
      <form className="mb-4 flex max-w-lg gap-2" onSubmit={find} aria-label="Find a person">
        <Input type="email" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="name@gmail.com" aria-label="Email address" />
        <Button type="submit" disabled={!query || lookup.isPending}>
          <SearchIcon />
          Find
        </Button>
      </form>

      {person && (
        <Card className="max-w-2xl py-0">
          <CardContent className="grid gap-4 p-5">
            <p className="text-muted-foreground text-sm">
              Belongs to {person.organization_count}{' '}
              {person.organization_count === 1 ? 'organization' : 'organizations'}.
            </p>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={save} aria-label="Shared details">
              <FormField id="pp-name" label="Name" error={errors.full_name}>
                <Input id="pp-name" value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} />
              </FormField>
              <FormField id="pp-email" label="Email" error={errors.email}>
                <Input id="pp-email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              </FormField>
              <FormField id="pp-phone" label="Phone" optional error={errors.phone}>
                <Input id="pp-phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              </FormField>
              <div className="flex items-end justify-end">
                <Button type="submit" disabled={update.isPending}>
                  Save shared details
                </Button>
              </div>
            </form>
            {person.google_sub_pinned && (
              <div className="flex flex-wrap items-center gap-3 border-t pt-4 text-sm">
                <p className="text-muted-foreground flex-1">
                  Signed in with a Google account before. If that account was deleted and recreated,
                  unpin it so the new one can sign in.
                </p>
                <Button
                  variant="outline"
                  onClick={async () => {
                    await unpin.mutateAsync(person.id);
                    setPerson({ ...person, google_sub_pinned: false });
                    toast.success('Unpinned: the next Google sign-in with this address is accepted.');
                  }}
                >
                  Unpin Google sign-in
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
