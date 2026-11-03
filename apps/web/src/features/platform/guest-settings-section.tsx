import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { TILE_LEVEL_WORDS, type GuestSettings, type QuestionBankLevelId } from '@tmi/shared';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MathText } from '@/features/question-bank/math-text';
import { NotificationsSwitch } from '@/features/organizations/notifications-switch';
import { ApiRequestError } from '@/lib/api-client';
import { AccessSection } from './access-section';
import { useGuestConsole, useGuestPoolConsole, useSaveGuestPool, useSaveGuestSettings } from './api';

/**
 * Phase 63 (P16): guest play in the console -- its switches, the sign-up offer's timing and words, and
 * each level's free questions (the guest pool: reserved for guests, never served to members).
 */
export function GuestSettingsSection() {
  const guest = useGuestConsole();
  const save = useSaveGuestSettings();
  const data = guest.data?.data;
  const [settings, setSettings] = useState<GuestSettings | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  useEffect(() => {
    if (data) setSettings(data.settings);
  }, [data]);

  if (guest.isPending || !settings) return <p className="text-muted-foreground text-sm">Loading…</p>;
  if (guest.isError || !data) return <p className="text-destructive text-sm">Guest play could not be loaded.</p>;
  const set = <K extends keyof GuestSettings>(key: K, value: GuestSettings[K]) => setSettings({ ...settings, [key]: value });

  async function submit() {
    try {
      await save.mutateAsync(settings!);
      toast.success('Guest play saved.');
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? caught.message : 'Guest play could not be saved.');
    }
  }

  return (
    <div className="space-y-4" data-testid="guest-settings">
      {/* Phase 65: who may sign up, in the guest play section (owner, 2026-11-03). */}
      <AccessSection />
      {!data.address_allows && (
        <p className="bg-muted rounded-md px-3 py-2 text-sm">This address does not offer guest play (its GUEST_PLAY is off), whatever is set here.</p>
      )}
      <Card className="py-0">
        <CardContent className="grid gap-3 p-4 text-sm">
          <Row label="Guest play" hint="Anyone may play the open tiles without signing in.">
            <NotificationsSwitch label="Guest play" checked={settings.enabled} onCheckedChange={(on) => set('enabled', on)} />
          </Row>
          <Row label="Guest assessment" hint="Assessment tiles (G4A5) for guests, answered and marked on the device.">
            <NotificationsSwitch label="Guest assessment" checked={settings.assessment_enabled} onCheckedChange={(on) => set('assessment_enabled', on)} />
          </Row>
          <Row label="Sign-up offer after question" hint="0 turns the offer during a quest off.">
            <Input aria-label="Sign-up offer after question" type="number" className="w-20" value={settings.nudge_after} onChange={(e) => set('nudge_after', Number(e.target.value) || 0)} />
          </Row>
          <Row label="Not again for (hours)" hint="After someone closes the offer, on that device.">
            <Input aria-label="Not again for (hours)" type="number" className="w-20" value={settings.nudge_cooldown_hours} onChange={(e) => set('nudge_cooldown_hours', Number(e.target.value) || 0)} />
          </Row>
          <label className="grid gap-1">
            <span className="font-medium">After a right answer</span>
            <Input value={settings.nudge_right} onChange={(e) => set('nudge_right', e.target.value)} />
          </label>
          <label className="grid gap-1">
            <span className="font-medium">After a wrong answer</span>
            <Input value={settings.nudge_wrong} onChange={(e) => set('nudge_wrong', e.target.value)} />
          </label>
          <label className="grid gap-1">
            <span className="font-medium">The home bar</span>
            <Input value={settings.home_bar} onChange={(e) => set('home_bar', e.target.value)} />
          </label>
          <Button className="w-fit" disabled={save.isPending} onClick={() => void submit()}>
            Save guest play
          </Button>
        </CardContent>
      </Card>

      <Card className="py-0">
        <CardContent className="grid gap-2 p-4 text-sm">
          <h3 className="font-medium">Free questions per level</h3>
          <p className="text-muted-foreground text-xs">Reserved for guests: members never meet them. An open tile shows only where its level has some.</p>
          <ul className="flex flex-wrap gap-2">
            {data.pools.map((pool) => (
              <li key={pool.level_id}>
                <Button
                  variant={level === pool.level_id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLevel(level === pool.level_id ? null : pool.level_id)}
                  data-testid={`guest-pool-${pool.level_id}`}
                >
                  {TILE_LEVEL_WORDS[pool.level_id as QuestionBankLevelId]} · {pool.size}
                </Button>
              </li>
            ))}
          </ul>
          {level && <PoolEditor level={level} />}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid flex-1 gap-0.5">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground text-xs">{hint}</span>
      </span>
      {children}
    </div>
  );
}

function PoolEditor({ level }: { level: string }) {
  const pool = useGuestPoolConsole(level);
  const save = useSaveGuestPool();
  const data = pool.data?.data;
  if (pool.isPending) return <p className="text-muted-foreground text-xs">Loading…</p>;
  if (!data) return null;
  async function use(ids: string[]) {
    try {
      await save.mutateAsync({ level_id: level, question_ids: ids });
      await pool.refetch();
      toast.success(`${TILE_LEVEL_WORDS[level as QuestionBankLevelId]} has ${ids.length} free questions.`);
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? caught.message : 'The free questions could not be saved.');
    }
  }
  return (
    <div className="grid gap-3 border-t pt-3" data-testid="guest-pool-editor">
      <div className="grid gap-1">
        <h4 className="text-xs font-semibold uppercase">Now ({data.current.length})</h4>
        {data.current.length === 0 && <p className="text-muted-foreground text-xs">None yet: this level has no open guest tiles.</p>}
        <ol className="grid gap-1">
          {data.current.map((q) => (
            <li key={q.id} className="text-xs">
              <span className="text-muted-foreground mr-1">D{q.difficulty}{q.status === 'checked' ? ' · Beta' : ''}</span>
              <MathText text={q.stem.length > 140 ? `${q.stem.slice(0, 140)}…` : q.stem} />
            </li>
          ))}
        </ol>
      </div>
      <div className="grid gap-1">
        <h4 className="text-xs font-semibold uppercase">Suggested ({data.suggestion.length})</h4>
        <ol className="grid gap-1">
          {data.suggestion.map((q) => (
            <li key={q.id} className="text-xs">
              <span className="text-muted-foreground mr-1">D{q.difficulty}{q.status === 'checked' ? ' · Beta' : ''}</span>
              <MathText text={q.stem.length > 140 ? `${q.stem.slice(0, 140)}…` : q.stem} />
            </li>
          ))}
        </ol>
        <Button
          className="w-fit"
          size="sm"
          disabled={save.isPending || data.suggestion.length < 5}
          onClick={() => void use(data.suggestion.map((q) => q.id))}
          data-testid="guest-pool-use-suggestion"
        >
          Use the suggestion
        </Button>
      </div>
    </div>
  );
}
