import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  AUTH_PROVIDER_LABELS,
  SIGN_IN_CLIENT_LABELS,
  SIGN_IN_DURATIONS_HOURS,
  SWITCHABLE_PROVIDERS,
  describeProviders,
  type AuthProvider,
  type SignInClientStatus,
} from '@tmi/shared';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { NotificationsSwitch } from '@/features/organizations/notifications-switch';
import { ApiRequestError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useSignInSettings, useUpdateSignInSetting } from './api';
import { PlaySettingsSection } from './play-settings-section';
import { GuestSettingsSection } from './guest-settings-section';
import { AccessJump } from './access-section';

type Switchable = (typeof SWITCHABLE_PROVIDERS)[number];

/** "until 9:30 PM" today, or with the day when it is not today; the reader's own clock. */
function untilText(until: string | null): string {
  if (!until) return 'until changed';
  const at = new Date(until);
  const sameDay = at.toDateString() === new Date().toDateString();
  return `until ${at.toLocaleString(undefined, sameDay ? { hour: 'numeric', minute: '2-digit' } : { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`;
}

/** What is in force for one client, in words. */
export function inForceText(status: SignInClientStatus): string {
  const { effective } = status;
  const what = `${describeProviders(effective.providers)} · sign-up ${effective.signup_open ? 'open' : 'closed'}`;
  return effective.source === 'console'
    ? `${what} · ${untilText(effective.until)}`
    : `This address's defaults: ${what}`;
}

/**
 * Phase 62 (P0): the console's settings. Sign-in first: for the web portal and the app separately,
 * which ways in besides Google (always on) and whether new people may sign up -- for a few hours, so
 * a demo cannot be left open by mistake, or until changed. Phase 62's Play settings join this page.
 */
export function PlatformSettingsPage() {
  const settings = useSignInSettings();
  const data = settings.data?.data;
  return (
    <>
      <PageHeader
        title="Settings"
        description="Platform-wide switches. Changes reach every visitor within a minute."
      />
      {/* Phase 65: who may sign up, and who waits; Review jumps to it in Guest play. */}
      <div className="mb-6">
        <AccessJump />
      </div>
      <section aria-labelledby="sign-in-heading" className="space-y-3">
        <div>
          <h2 id="sign-in-heading" className="text-base font-semibold">
            Sign-in
          </h2>
          <p className="text-muted-foreground text-sm">
            Google is always on. A setting lasts for the time chosen, then this address&apos;s defaults return.
          </p>
        </div>
        {settings.isPending ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : settings.isError || !data ? (
          <p className="text-destructive text-sm">The sign-in settings could not be loaded.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
            {data.clients.map((status) => (
              <SignInClientCard key={status.client} status={status} configured={data.configured} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="play-heading" className="mt-8 space-y-3">
        <div>
          <h2 id="play-heading" className="text-base font-semibold">
            Play
          </h2>
          <p className="text-muted-foreground text-sm">
            Tiles start a quest in one tap: G4T10 is Grade 4 for 10 minutes, BA3Q5 Beast Academy 3 for 5 questions, G4A5 a
            5-question assessment.
          </p>
        </div>
        <PlaySettingsSection />
      </section>

      <section aria-labelledby="guest-heading" className="mt-8 space-y-3">
        <div>
          <h2 id="guest-heading" className="text-base font-semibold">
            Guest play
          </h2>
          <p className="text-muted-foreground text-sm">
            Signed-out visitors play the open tiles on their device, then are offered a free account.
          </p>
        </div>
        <GuestSettingsSection />
      </section>
    </>
  );
}

function SignInClientCard({ status, configured }: { status: SignInClientStatus; configured: AuthProvider[] }) {
  const update = useUpdateSignInSetting();
  const label = SIGN_IN_CLIENT_LABELS[status.client];
  const start = status.effective.source === 'console' && status.setting ? status.setting : null;
  const [providers, setProviders] = useState<Switchable[]>([]);
  const [signupOpen, setSignupOpen] = useState(false);
  const [hours, setHours] = useState<number | null>(3);

  // Start from what is in force: the setting while it lasts, else the defaults.
  useEffect(() => {
    const from = start ?? { providers: status.defaults.providers, signup_open: status.defaults.signup_open };
    setProviders(SWITCHABLE_PROVIDERS.filter((provider) => from.providers.includes(provider)));
    setSignupOpen(from.signup_open);
  }, [status, start]);

  async function save(setting: { providers: Switchable[]; signup_open: boolean; hours: number | null } | null) {
    try {
      await update.mutateAsync({ client: status.client, setting });
      toast.success(setting ? `Sign-in for the ${label.toLowerCase()} saved.` : `The ${label.toLowerCase()} is back to its defaults.`);
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? caught.message : 'The setting could not be saved.');
    }
  }

  const slug = `sign-in-${status.client}`;
  return (
    <Card className="py-0" data-testid={slug}>
      <CardContent className="space-y-4 p-4">
        <div>
          <h3 className="font-medium">{label}</h3>
          <p className="text-muted-foreground text-sm" data-testid={`${slug}-in-force`}>
            {inForceText(status)}
          </p>
        </div>

        <ul className="divide-y rounded-md border">
          <li className="flex items-center gap-3 px-3 py-2 text-sm">
            <span className="flex-1">Google</span>
            <span className="text-muted-foreground text-xs">Always on</span>
          </li>
          {SWITCHABLE_PROVIDERS.map((provider) => {
            const ready = configured.includes(provider);
            return (
              <li key={provider} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="flex-1">
                  {AUTH_PROVIDER_LABELS[provider]}
                  {!ready && <span className="text-muted-foreground block text-xs">Not set up here</span>}
                </span>
                <NotificationsSwitch
                  label={`${AUTH_PROVIDER_LABELS[provider]} for the ${label.toLowerCase()}`}
                  checked={ready && providers.includes(provider)}
                  disabled={!ready || update.isPending}
                  onCheckedChange={(on) =>
                    setProviders((list) =>
                      on ? SWITCHABLE_PROVIDERS.filter((p) => p === provider || list.includes(p)) : list.filter((p) => p !== provider),
                    )
                  }
                />
              </li>
            );
          })}
          <li className="flex items-center gap-3 px-3 py-2 text-sm">
            <span className="flex-1">New people may sign up</span>
            <NotificationsSwitch
              label={`Sign-up for the ${label.toLowerCase()}`}
              checked={signupOpen}
              disabled={update.isPending}
              onCheckedChange={setSignupOpen}
            />
          </li>
        </ul>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">For how long</legend>
          <div className="flex flex-wrap gap-1.5">
            {[...SIGN_IN_DURATIONS_HOURS, null].map((value) => (
              <button
                key={value ?? 'none'}
                type="button"
                aria-pressed={hours === value}
                onClick={() => setHours(value)}
                className={cn(
                  'rounded-full border px-3 py-1 text-sm transition-colors',
                  hours === value ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
                )}
              >
                {value === null ? 'Until changed' : `${value} hour${value === 1 ? '' : 's'}`}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap gap-2">
          <Button
            disabled={update.isPending}
            onClick={() => void save({ providers: providers.filter((p) => configured.includes(p)), signup_open: signupOpen, hours })}
          >
            Save
          </Button>
          {status.setting && (
            <Button variant="outline" disabled={update.isPending} onClick={() => void save(null)}>
              Back to defaults
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
