import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  FEATURE_SET_LABELS,
  NOTIFICATION_KIND_LABELS,
  allowedFeatureSets,
  featureAllowed,
  ORG_PALETTE_LABELS,
  ORG_TIME_ZONE_LABELS,
  formatRelativeTime,
  type OrganizationSettings,
} from '@tmi/shared';

import { LogoLockup } from '@/components/brand/logo';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ApiRequestError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import {
  useOrganizationNotifications,
  useOrganizationSettings,
  useUpdateOrganizationSettings,
} from './api';
import { CurriculaCard } from './curricula-card';
import { SpaceCodeCard, SpaceDangerCard } from './space-code-card';
import { NotificationsSwitch } from './notifications-switch';

/** The payer box, as the form holds it. The switches and the question count save on their own. */
type SettingsForm = Record<
  Exclude<
    keyof OrganizationSettings,
    | 'email_notifications'
    | 'canvas_assessments'
    | 'canvas_assessments_unreviewed'
    | 'canvas_assessment_questions'
    | 'gamify_question_quest'
  >,
  string
>;

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
    const {
      email_notifications: _flag,
      canvas_assessments: _assessments,
      canvas_assessments_unreviewed: _unreviewed,
      canvas_assessment_questions: _questions,
      gamify_question_quest: _quest,
      ...payer
    } = loaded;
    setForm(
      Object.fromEntries(Object.entries(payer).map(([key, value]) => [key, value ?? ''])) as SettingsForm,
    );
  }, [settings.data]);

  if (!organization) return null;

  if (!isAdmin) {
    return (
      <PageHeader title="Space" description="Only an administrator can see the space’s settings." />
    );
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    try {
      await update.mutateAsync(form);
      toast.success('Space settings saved.');
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
        title="Space"
        description={
          featureAllowed(organization, 'tutoring')
            ? `What ${organization.name} files its 1099s under, teaches from, and how the portal presents it.`
            : `${organization.name}: its code, what it teaches from, and how it is set up.`
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
        {/* Phase 50: the 1099 payer belongs to Tutoring (payments and tax). */}
        {featureAllowed(organization, 'tutoring') && (
        <Card className="py-0">
          <CardContent className="p-5">
            <form className="grid gap-4" onSubmit={save} aria-label="1099 payer details">
              <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                1099 payer
              </h2>
              {field(
                'tin',
                'Payer TIN',
                'The EIN the space files under. Prefills the payer box — never a Social Security number, which the portal refuses to store.',
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
        )}

        <Card className="py-0 lg:row-span-2">
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
              <div>
                <dt className="text-muted-foreground text-xs">Feature sets</dt>
                <dd data-testid="org-feature-sets">
                  {allowedFeatureSets(organization).map((set) => FEATURE_SET_LABELS[set]).join(', ') || 'None yet'}
                </dd>
              </div>
            </dl>
            <p className="text-muted-foreground text-xs">
              To change the name, logo, palette, clock or feature sets, ask the platform administrator.
            </p>
          </CardContent>
        </Card>

        {/* Phase 52: how people join. */}
        <SpaceCodeCard />

        {/* Phase 51: a self-serve space sends no email under the platform's sender. */}
        {organization.created_via !== 'self_serve' && (
          <EmailNotificationsCard enabled={settings.data?.data.email_notifications ?? false} />
        )}

        <CurriculaCard />

        {featureAllowed(organization, 'assessment') && (
          <CanvasAssessmentsCard
            enabled={settings.data?.data.canvas_assessments ?? false}
            unreviewed={settings.data?.data.canvas_assessments_unreviewed ?? false}
            questions={settings.data?.data.canvas_assessment_questions ?? 10}
          />
        )}

        {featureAllowed(organization, 'quest') && (
          <GamificationCard questQuest={settings.data?.data.gamify_question_quest ?? false} />
        )}

        <SpaceDangerCard />
      </div>
    </>
  );
}

/**
 * Phase 38: the Assessment menu (beta) -- its switch, the trial of questions
 * not yet reviewed, and (Phase 40) how many questions an assessment draws.
 * Each saves at once and refreshes the session, so the menu and the start card
 * follow for the admin who changed them.
 */
function CanvasAssessmentsCard({
  enabled,
  unreviewed,
  questions,
}: {
  enabled: boolean;
  unreviewed: boolean;
  questions: number;
}) {
  const update = useUpdateOrganizationSettings();
  const { refreshSession } = useAuth();

  async function change(input: Partial<OrganizationSettings>, done: string, failed: string) {
    try {
      await update.mutateAsync(input);
      await refreshSession();
      toast.success(done);
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? caught.message : failed);
    }
  }

  return (
    <Card className="py-0" data-testid="canvas-assessments-setting">
      <CardContent className="grid gap-4 p-5 text-sm">
        <div className="flex items-start gap-4">
          <div className="grid flex-1 gap-1">
            <h2 className="text-muted-foreground flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
              Assessment
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] tracking-normal normal-case">
                Beta
              </Badge>
            </h2>
            <p className="text-muted-foreground text-xs">
              When on, everyone here sees an Assessment menu. A student answers questions by hand on a canvas, one
              question per page, with nothing marked while they work; on submitting, their tutors and the admins get a
              PDF of the questions and the handwriting, and can review it online for the family. It collects students’
              handwriting, so check that your consent forms cover it before students under 13 use it.
            </p>
          </div>
          <NotificationsSwitch
            checked={enabled}
            disabled={update.isPending}
            onCheckedChange={(next) =>
              void change(
                { canvas_assessments: next },
                next ? 'The Assessment menu is on.' : 'The Assessment menu is off.',
                'Could not change the Assessment menu.',
              )
            }
            label="Assessment menu"
          />
        </div>
        <div className="flex items-start gap-4 border-t pt-4">
          <div className="grid flex-1 gap-1">
            <h3 className="text-xs font-medium">Include questions not yet reviewed</h3>
            <p className="text-muted-foreground text-xs">
              A trial: assessments also draw on questions that passed every automatic check in the question bank but
              that no person has approved yet. The tutor’s PDF marks each one “not yet reviewed”.
            </p>
          </div>
          <NotificationsSwitch
            checked={unreviewed}
            disabled={update.isPending}
            onCheckedChange={(next) =>
              void change(
                { canvas_assessments_unreviewed: next },
                next ? 'Assessments may now use questions not yet reviewed.' : 'Assessments use approved questions only.',
                'Could not change the questions used.',
              )
            }
            label="Include questions not yet reviewed"
          />
        </div>
        <div className="flex items-start gap-4 border-t pt-4">
          <div className="grid flex-1 gap-1">
            <h3 className="text-xs font-medium">Questions in an assessment</h3>
            <p className="text-muted-foreground text-xs">
              How many questions each new assessment draws (1 to 25). Assessments already started keep theirs.
            </p>
          </div>
          <Select
            value={String(questions)}
            onValueChange={(value) =>
              void change(
                { canvas_assessment_questions: Number(value) },
                `Assessments now have ${value} question${value === '1' ? '' : 's'}.`,
                'Could not change the number of questions.',
              )
            }
          >
            <SelectTrigger className="w-20" aria-label="Questions in an assessment" data-testid="assessment-question-count">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 25 }, (_, i) => i + 1).map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Phase 42: gamification -- its flags, one switch each. The first is Question
 * Quest. Saves at once and refreshes the session, so the menu follows.
 */
function GamificationCard({ questQuest }: { questQuest: boolean }) {
  const update = useUpdateOrganizationSettings();
  const { refreshSession } = useAuth();

  async function toggle(next: boolean) {
    try {
      await update.mutateAsync({ gamify_question_quest: next });
      await refreshSession();
      toast.success(next ? 'Question Quest is on.' : 'Question Quest is off.');
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? caught.message : 'Could not change Question Quest.');
    }
  }

  return (
    <Card className="py-0" data-testid="gamification-setting">
      <CardContent className="grid gap-4 p-5 text-sm">
        <div className="flex items-start gap-4">
          <div className="grid flex-1 gap-1">
            <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Gamification</h2>
            <h3 className="text-xs font-medium">Question Quest</h3>
            <p className="text-muted-foreground text-xs">
              When on, a student who signs in answers the question bank’s questions that no person has approved yet,
              one at a time from the level their tutor sets, with no going back. Their tutor reviews each answer and
              approves the question for every space on the platform, or flags it. A student earns a point for
              each answer and another when a correct answer is approved; a tutor earns a point for each review.
            </p>
          </div>
          <NotificationsSwitch
            checked={questQuest}
            disabled={update.isPending}
            onCheckedChange={(next) => void toggle(next)}
            label="Question Quest"
          />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Phase 32: the organization's email notifications -- the switch, what it
 * does, and who was emailed lately. Names and outcomes only: the log holds no
 * addresses and no message text.
 */
function EmailNotificationsCard({ enabled }: { enabled: boolean }) {
  const update = useUpdateOrganizationSettings();
  const log = useOrganizationNotifications(true);
  const entries = log.data?.data ?? [];

  async function toggle(next: boolean) {
    try {
      await update.mutateAsync({ email_notifications: next });
      toast.success(next ? 'Email notifications are on.' : 'Email notifications are off.');
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? caught.message : 'Could not change notifications.');
    }
  }

  return (
    <Card className="py-0" data-testid="email-notifications">
      <CardContent className="grid gap-4 p-5 text-sm">
        <div className="flex items-start gap-4">
          <div className="grid flex-1 gap-1">
            <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Email notifications
            </h2>
            <p className="text-muted-foreground text-xs">
              When on, the people concerned are emailed when someone is added, a plan or assessment
              is added, lessons are scheduled, or a session is recorded. An email says what happened
              and links here — never money, notes or scores. On Cloudflare’s free plan only verified
              addresses receive mail; the others show as not delivered below.
            </p>
          </div>
          <NotificationsSwitch checked={enabled} disabled={update.isPending} onCheckedChange={toggle} />
        </div>

        <div className="grid gap-2">
          <h3 className="text-xs font-medium">Recent emails</h3>
          {entries.length === 0 ? (
            <p className="text-muted-foreground text-xs">Nothing sent yet.</p>
          ) : (
            <ul className="grid gap-1.5" aria-label="Recent emails">
              {entries.slice(0, 12).map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                  <span className="font-medium">{entry.recipient_name}</span>
                  <span className="text-muted-foreground">
                    {NOTIFICATION_KIND_LABELS[entry.kind]}
                    {entry.subject_name && entry.subject_name !== entry.recipient_name
                      ? ` · ${entry.subject_name}`
                      : ''}{' '}
                    · {formatRelativeTime(entry.created_at)}
                  </span>
                  <Badge
                    variant={entry.status === 'failed' ? 'destructive' : 'secondary'}
                    title={entry.detail ?? undefined}
                    className="ml-auto"
                  >
                    {entry.status === 'sent' ? 'Sent' : entry.status === 'failed' ? 'Not delivered' : 'Not sent here'}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
