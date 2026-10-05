import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ORG_PALETTE_LABELS, ORG_TIME_ZONE_LABELS, type OrganizationSettings } from '@tmi/shared';

import { LogoLockup } from '@/components/brand/logo';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiRequestError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import { useOrganizationSettings, useUpdateOrganizationSettings } from './api';

type SettingsForm = Record<keyof OrganizationSettings, string>;

const EMPTY: SettingsForm = {
  tin: '',
  payer_address_line1: '',
  payer_address_line2: '',
  payer_city: '',
  payer_state: '',
  payer_postal_code: '',
};

/**
 * The organization's own settings, for its admins: the payer box on every
 * 1099 it issues. Its name, look and clock are set by the platform, and shown
 * here for reference.
 */
export function OrganizationSettingsPage() {
  const { organization, user } = useAuth();
  const isAdmin = Boolean(user?.roles.includes('admin'));
  const settings = useOrganizationSettings(isAdmin);
  const update = useUpdateOrganizationSettings();

  const [form, setForm] = useState<SettingsForm>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const loaded = settings.data?.data;
    if (!loaded) return;
    setForm(
      Object.fromEntries(
        Object.entries(loaded).map(([key, value]) => [key, value ?? '']),
      ) as SettingsForm,
    );
  }, [settings.data]);

  if (!organization) return null;

  if (!isAdmin) {
    return (
      <PageHeader title="Organization" description="Only an administrator can see the organization’s settings." />
    );
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    try {
      await update.mutateAsync(form);
      toast.success('Organization settings saved.');
    } catch (caught) {
      if (caught instanceof ApiRequestError) {
        setErrors(caught.fieldErrors);
        toast.error(caught.message);
      }
    }
  }

  const field = (key: keyof SettingsForm, label: string, hint?: string, placeholder?: string) => (
    <div className="grid content-start gap-2">
      <Label htmlFor={`org-${key}`} className={cn(errors[key] && 'text-destructive')}>
        {label} <span className="text-muted-foreground font-normal">(optional)</span>
      </Label>
      <Input
        id={`org-${key}`}
        value={form[key]}
        placeholder={placeholder}
        aria-invalid={Boolean(errors[key])}
        onChange={(event) => setForm((previous) => ({ ...previous, [key]: event.target.value }))}
      />
      {errors[key] ? (
        <p className="text-destructive text-xs">{errors[key]}</p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}
    </div>
  );

  return (
    <>
      <PageHeader
        title="Organization"
        description={`What ${organization.name} files its 1099s under, and how the portal presents it.`}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
        <Card className="py-0">
          <CardContent className="p-5">
            <form className="grid gap-4" onSubmit={save} aria-label="1099 payer details">
              <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                1099 payer
              </h2>
              {field(
                'tin',
                'Payer TIN',
                'The EIN the organization files under. Prefills the payer box — never a Social Security number, which the portal refuses to store.',
                '12-3456789',
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                {field('payer_address_line1', 'Address')}
                {field('payer_address_line2', 'Address line 2')}
                {field('payer_city', 'City')}
                <div className="grid grid-cols-2 gap-4">
                  {field('payer_state', 'State', undefined, 'NC')}
                  {field('payer_postal_code', 'ZIP', undefined, '27514')}
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={update.isPending || settings.isPending}>
                  Save
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="py-0">
          <CardContent className="grid gap-3 p-5 text-sm">
            <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Set by the platform
            </h2>
            <LogoLockup />
            <dl className="grid gap-2">
              <div>
                <dt className="text-muted-foreground text-xs">Name</dt>
                <dd>{organization.name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Palette</dt>
                <dd>{ORG_PALETTE_LABELS[organization.palette]}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Lessons are recorded on</dt>
                <dd>{ORG_TIME_ZONE_LABELS[organization.time_zone]} time</dd>
              </div>
            </dl>
            <p className="text-muted-foreground text-xs">
              To change the name, logo, palette or clock, ask the platform administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
