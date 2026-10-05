import { useState } from 'react';
import { toast } from 'sonner';
import { UserPlusIcon } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ApiRequestError } from '@/lib/api-client';
import { formatTimestamp } from '@/lib/utils';
import { useAddPlatformAdmin, usePlatformAdmins } from './api';
import { FormField } from './form-field';

/** Who may use this console. Adding someone gives them every organization's front door. */
export function PlatformAdminsPage() {
  const admins = usePlatformAdmins();
  const add = useAddPlatformAdmin();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    try {
      await add.mutateAsync({ email, full_name: name });
      toast.success(`${name} is now a platform admin.`);
      setEmail('');
      setName('');
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
        title="Platform admins"
        description="They create organizations and their admins. They see nothing inside an organization unless it makes them a member."
      />
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Card className="py-0">
          <CardContent className="p-0">
            <ul className="divide-y" aria-label="Platform admins">
              {(admins.data?.data ?? []).map((admin) => (
                <li key={admin.user_id} className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{admin.full_name}</span>
                    <span className="text-muted-foreground block truncate text-xs">{admin.email}</span>
                  </span>
                  <span className="text-muted-foreground text-xs">Since {formatTimestamp(admin.created_at, '—')}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card className="py-0">
          <CardContent className="p-4">
            <form className="grid gap-3" onSubmit={submit} aria-label="Add a platform admin">
              <FormField id="pa-email" label="Google address" error={errors.email}>
                <Input id="pa-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              </FormField>
              <FormField id="pa-name" label="Name" error={errors.full_name}>
                <Input id="pa-name" value={name} onChange={(event) => setName(event.target.value)} />
              </FormField>
              <div className="flex justify-end">
                <Button type="submit" disabled={add.isPending || !email || !name}>
                  <UserPlusIcon />
                  Add platform admin
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
