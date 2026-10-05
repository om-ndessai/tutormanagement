import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ImageUpIcon, Trash2Icon, UserMinusIcon, UserPlusIcon } from 'lucide-react';
import {
  LOGO_KINDS,
  MAX_LOGO_BYTES,
  ORG_PALETTES,
  ORG_PALETTE_HEX,
  ORG_PALETTE_LABELS,
  ORG_TIME_ZONES,
  ORG_TIME_ZONE_LABELS,
  type LogoKind,
  type OrganizationListItem,
  type OrgPalette,
  type OrgTimeZone,
} from '@tmi/shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ApiRequestError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { OrgAvatar } from '@/features/organizations/org-avatar';
import {
  useAddOrganizationAdmin,
  useCreateOrganization,
  useOrganizationAdmins,
  useRemoveLogo,
  useRemoveOrganizationAdmin,
  useUpdateOrganization,
  useUploadLogo,
} from './api';
import { FormField } from './form-field';

interface FormState {
  name: string;
  short_name: string;
  slug: string;
  tagline: string;
  blurb: string;
  place: string;
  palette: OrgPalette;
  time_zone: OrgTimeZone;
  builtin_institute: boolean;
}

const EMPTY: FormState = {
  name: '',
  short_name: '',
  slug: '',
  tagline: '',
  blurb: '',
  place: '',
  palette: 'platform',
  time_zone: 'America/New_York',
  builtin_institute: false,
};

/** "Riverside Tutoring" -> "riverside-tutoring", as a first suggestion. */
function slugFrom(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/**
 * Creating or editing an organization: its name and address name, its look
 * (palette, logos), its clock, and -- once it exists -- its admins.
 */
export function OrganizationDialog({
  open,
  onOpenChange,
  existing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing: OrganizationListItem | null;
}) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [slugTouched, setSlugTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const create = useCreateOrganization();
  const update = useUpdateOrganization();

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setSlugTouched(Boolean(existing));
    setForm(
      existing
        ? {
            name: existing.name,
            short_name: existing.short_name,
            slug: existing.slug,
            tagline: existing.tagline ?? '',
            blurb: existing.blurb ?? '',
            place: existing.place ?? '',
            palette: existing.palette,
            time_zone: existing.time_zone,
            builtin_institute: existing.builtin_logo === 'institute',
          }
        : EMPTY,
    );
  }, [open, existing]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    const input = {
      name: form.name,
      short_name: form.short_name,
      slug: form.slug,
      tagline: form.tagline,
      blurb: form.blurb,
      place: form.place,
      palette: form.palette,
      time_zone: form.time_zone,
      builtin_logo: form.builtin_institute ? ('institute' as const) : null,
    };
    try {
      if (existing) {
        await update.mutateAsync({ id: existing.id, input });
        toast.success(`${form.name} saved.`);
      } else {
        await create.mutateAsync(input);
        toast.success(`${form.name} created. Add its first admin next.`);
      }
      onOpenChange(false);
    } catch (caught) {
      if (caught instanceof ApiRequestError) {
        setErrors(caught.fieldErrors);
        if (caught.status === 409) setErrors({ slug: caught.message });
        toast.error(caught.message);
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{existing ? existing.name : 'New organization'}</DialogTitle>
          <DialogDescription>
            {existing
              ? 'Its identity and look. Its own admins keep its payer details.'
              : 'Its name and look. Its admins come next, once it exists.'}
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={save} id="organization-form">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="org-name" label="Name" error={errors.name}>
              <Input
                id="org-name"
                value={form.name}
                onChange={(event) => {
                  set('name', event.target.value);
                  if (!slugTouched) set('slug', slugFrom(event.target.value));
                }}
                placeholder="Riverside Tutoring"
              />
            </FormField>
            <FormField id="org-short" label="Short name" error={errors.short_name} hint="For the sidebar and the tab title.">
              <Input id="org-short" value={form.short_name} onChange={(event) => set('short_name', event.target.value)} placeholder="Riverside" />
            </FormField>
            <FormField
              id="org-slug"
              label="Address name"
              error={errors.slug}
              hint="Lower-case letters, digits and hyphens. Names its files and remembers the choice."
            >
              <Input
                id="org-slug"
                value={form.slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  set('slug', event.target.value);
                }}
                placeholder="riverside"
              />
            </FormField>
            <FormField id="org-place" label="Place" optional error={errors.place}>
              <Input id="org-place" value={form.place} onChange={(event) => set('place', event.target.value)} placeholder="Durham, North Carolina" />
            </FormField>
            <FormField id="org-tagline" label="Tagline" optional error={errors.tagline}>
              <Input id="org-tagline" value={form.tagline} onChange={(event) => set('tagline', event.target.value)} />
            </FormField>
            <FormField id="org-tz" label="Lessons are recorded on" error={errors.time_zone}>
              <Select value={form.time_zone} onValueChange={(value) => set('time_zone', value as OrgTimeZone)}>
                <SelectTrigger id="org-tz" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORG_TIME_ZONES.map((zone) => (
                    <SelectItem key={zone} value={zone}>
                      {ORG_TIME_ZONE_LABELS[zone]} time
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <FormField id="org-blurb" label="Description" optional error={errors.blurb} hint="The line under the tagline on the sign-in page.">
            <Input id="org-blurb" value={form.blurb} onChange={(event) => set('blurb', event.target.value)} />
          </FormField>

          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">Palette</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Palette">
              {ORG_PALETTES.filter((palette) => palette !== 'plum' || form.builtin_institute || form.palette === 'plum').map((palette) => (
                <button
                  key={palette}
                  type="button"
                  role="radio"
                  aria-checked={form.palette === palette}
                  onClick={() => set('palette', palette)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                    form.palette === palette ? 'border-primary ring-primary/30 ring-2' : 'hover:bg-accent/50',
                  )}
                >
                  <span
                    aria-hidden
                    className="size-4 rounded-full"
                    // The swatch IS the palette's colour, as data.
                    style={{ backgroundColor: ORG_PALETTE_HEX[palette] }}
                  />
                  {ORG_PALETTE_LABELS[palette]}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-primary size-4"
              checked={form.builtin_institute}
              onChange={(event) => set('builtin_institute', event.target.checked)}
            />
            Wear the Mathematics Institute of the Triangle’s built-in logo
          </label>
        </form>

        {existing && (
          <>
            <Separator />
            <LogoSection organization={existing} />
            <Separator />
            <AdminsSection organization={existing} />
          </>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {existing ? 'Close' : 'Cancel'}
          </Button>
          <Button type="submit" form="organization-form" disabled={create.isPending || update.isPending}>
            {existing ? 'Save' : 'Create organization'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LogoSection({ organization }: { organization: OrganizationListItem }) {
  const upload = useUploadLogo();
  const remove = useRemoveLogo();
  const inputs = useRef<Record<LogoKind, HTMLInputElement | null>>({ mark: null, full: null });

  async function onFile(kind: LogoKind, file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) {
      toast.error('A logo may be at most 256 KB.');
      return;
    }
    try {
      await upload.mutateAsync({ id: organization.id, kind, file });
      toast.success('Logo updated.');
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? (caught.fieldErrors.logo ?? caught.message) : 'Upload failed.');
    } finally {
      const input = inputs.current[kind];
      if (input) input.value = '';
    }
  }

  return (
    <section className="grid gap-3" aria-label="Logos">
      <h3 className="text-sm font-medium">Logos</h3>
      <p className="text-muted-foreground text-xs">
        PNG or WebP, at most 256 KB. The mark is square and goes in the browser tab and the
        sidebar; the full logo goes on the sign-in page.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {LOGO_KINDS.map((kind) => {
          const url = kind === 'mark' ? organization.logo_mark_url : organization.logo_full_url;
          return (
            <div key={kind} className="flex items-center gap-3 rounded-lg border p-3">
              <span className="bg-muted flex h-12 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md">
                {url ? <img src={url} alt="" className="max-h-full max-w-full object-contain" /> : <ImageUpIcon className="text-muted-foreground size-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm">{kind === 'mark' ? 'Mark' : 'Full logo'}</p>
                <div className="mt-1 flex gap-1">
                  <input
                    ref={(element) => {
                      inputs.current[kind] = element;
                    }}
                    type="file"
                    accept="image/png,image/webp"
                    className="hidden"
                    aria-label={kind === 'mark' ? 'Upload mark' : 'Upload full logo'}
                    data-testid={`logo-input-${kind}`}
                    onChange={(event) => void onFile(kind, event.target.files?.[0])}
                  />
                  <Button size="sm" variant="outline" disabled={upload.isPending} onClick={() => inputs.current[kind]?.click()}>
                    {url ? 'Replace' : 'Upload'}
                  </Button>
                  {url && (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={kind === 'mark' ? 'Remove mark' : 'Remove full logo'}
                      onClick={() => void remove.mutateAsync({ id: organization.id, kind })}
                    >
                      <Trash2Icon />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AdminsSection({ organization }: { organization: OrganizationListItem }) {
  const admins = useOrganizationAdmins(organization.id);
  const add = useAddOrganizationAdmin(organization.id);
  const remove = useRemoveOrganizationAdmin(organization.id);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function addAdmin(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    try {
      await add.mutateAsync({ email, full_name: name });
      toast.success(`${name || email} added as an admin of ${organization.name}.`);
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
    <section className="grid gap-3" aria-label="Admins">
      <h3 className="text-sm font-medium">Admins</h3>
      <ul className="grid gap-2">
        {(admins.data?.data ?? []).map((admin) => (
          <li key={admin.user_id} className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm">
            <span className="min-w-0 flex-1">
              <span className="block truncate">{admin.full_name}</span>
              <span className="text-muted-foreground block truncate text-xs">{admin.email}</span>
            </span>
            {admin.status !== 'active' && <Badge variant="outline">{admin.status === 'invited' ? 'Invited' : 'Suspended'}</Badge>}
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Remove ${admin.full_name} as an admin`}
              disabled={remove.isPending}
              onClick={() => void remove.mutateAsync(admin.user_id)}
            >
              <UserMinusIcon />
            </Button>
          </li>
        ))}
        {admins.data && admins.data.data.length === 0 && (
          <li className="text-muted-foreground text-sm">No admins yet. Add the first one below.</li>
        )}
      </ul>

      <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={addAdmin} aria-label="Add an admin">
        <FormField id="admin-email" label="Google address" error={errors.email}>
          <Input id="admin-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@gmail.com" />
        </FormField>
        <FormField id="admin-name" label="Name" error={errors.full_name}>
          <Input id="admin-name" value={name} onChange={(event) => setName(event.target.value)} />
        </FormField>
        <Button type="submit" disabled={add.isPending || !email || !name}>
          <UserPlusIcon />
          Add admin
        </Button>
      </form>
      <p className="text-muted-foreground text-xs">
        Someone new signs in with that Google address to accept. Someone who already uses the
        portal is invited, and accepts when they next sign in.
      </p>
    </section>
  );
}

export { OrgAvatar };
