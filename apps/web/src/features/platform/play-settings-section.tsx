import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowDownIcon, ArrowUpIcon, XIcon } from 'lucide-react';
import {
  QUESTION_BANK_LEVEL_IDS,
  TILE_LEVEL_WORDS,
  tileCode,
  tileValueProblem,
  tileWords,
  type PlaySettings,
  type QuestTileInput,
  type QuestionBankLevelId,
  type TileFormat,
  type TileGuestState,
} from '@tmi/shared';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { NotificationsSwitch } from '@/features/organizations/notifications-switch';
import { ApiRequestError } from '@/lib/api-client';
import { usePlayConsole, useResetTiles, useSavePlay } from './api';

const GUEST_LABELS: Record<TileGuestState, string> = { open: 'Open', locked: 'Locked', hidden: 'Hidden' };
const FORMAT_LABELS: Record<TileFormat, string> = { Q: 'Questions', T: 'Minutes', A: 'Assessment' };

function shapeOf(format: TileFormat): Pick<QuestTileInput, 'kind' | 'mode'> {
  return format === 'A' ? { kind: 'assessment', mode: 'count' } : { kind: 'quest', mode: format === 'T' ? 'timed' : 'count' };
}

/**
 * Phase 62 (P5): the tiles and the Play settings, on the console's Settings page. Edited here and saved
 * together: the Play home's switch, how many questions a level needs before members see its tiles,
 * and the ordered list -- each tile open, locked or hidden for guests (Phase 63), shown or not to members.
 */
export function PlaySettingsSection() {
  const play = usePlayConsole();
  const save = useSavePlay();
  const reset = useResetTiles();
  const data = play.data?.data;
  const [settings, setSettings] = useState<PlaySettings | null>(null);
  const [tiles, setTiles] = useState<QuestTileInput[]>([]);
  const [level, setLevel] = useState<QuestionBankLevelId>('NC26.4');
  const [format, setFormat] = useState<TileFormat>('Q');
  const [value, setValue] = useState('5');

  useEffect(() => {
    if (!data) return;
    setSettings(data.settings);
    setTiles(data.tiles.map(({ kind, level_id, mode, value: n, guest, members }) => ({ kind, level_id, mode, value: n, guest, members })));
  }, [data]);

  const draft = useMemo(() => ({ ...shapeOf(format), level_id: level, value: Number(value) }), [format, level, value]);
  const draftProblem = tileValueProblem(draft);
  const draftCode = draftProblem ? null : tileCode(draft);
  const duplicate = draftCode !== null && tiles.some((tile) => tileCode(tile) === draftCode);

  if (play.isPending || !settings) return <p className="text-muted-foreground text-sm">Loading…</p>;
  if (play.isError) return <p className="text-destructive text-sm">The Play settings could not be loaded.</p>;

  const move = (index: number, by: number) =>
    setTiles((list) => {
      const next = [...list];
      const [tile] = next.splice(index, 1);
      next.splice(Math.max(0, Math.min(next.length, index + by)), 0, tile!);
      return next;
    });
  const update = (index: number, patch: Partial<QuestTileInput>) =>
    setTiles((list) => list.map((tile, i) => (i === index ? { ...tile, ...patch } : tile)));

  async function submit() {
    try {
      await save.mutateAsync({ settings: settings!, tiles });
      toast.success('Play settings saved.');
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? caught.message : 'The Play settings could not be saved.');
    }
  }

  return (
    <div className="space-y-4" data-testid="play-settings">
      <Card className="py-0">
        <CardContent className="grid gap-4 p-4 text-sm">
          <div className="flex items-start gap-3">
            <div className="grid flex-1 gap-0.5">
              <span className="font-medium">Play home</span>
              <span className="text-muted-foreground text-xs">
                Members start a quest in one tap from their home: Continue, favorites and the tiles below.
              </span>
            </div>
            <NotificationsSwitch
              label="Play home"
              checked={settings.play_home}
              onCheckedChange={(on) => setSettings({ ...settings, play_home: on })}
            />
          </div>
          <div className="flex items-start gap-3 border-t pt-3">
            <div className="grid flex-1 gap-0.5">
              <span className="font-medium">Daily set</span>
              <span className="text-muted-foreground text-xs">
                Five questions a level, the same for everyone each day, played once, with a share grid.
              </span>
            </div>
            <NotificationsSwitch
              label="Daily set"
              checked={settings.daily}
              onCheckedChange={(on) => setSettings({ ...settings, daily: on })}
            />
          </div>
          <label className="flex items-center gap-3 border-t pt-3">
            <span className="flex-1">
              <span className="block font-medium">Questions a level needs</span>
              <span className="text-muted-foreground block text-xs">Members see a tile only while its level has this many to play.</span>
            </span>
            <Input
              type="number"
              min={1}
              max={1000}
              className="w-24"
              aria-label="Questions a level needs"
              value={settings.min_depth}
              onChange={(event) => setSettings({ ...settings, min_depth: Number(event.target.value) || 1 })}
            />
          </label>
        </CardContent>
      </Card>

      <Card className="py-0">
        <CardContent className="p-0">
          <div className="flex flex-wrap items-end gap-2 border-b p-4">
            <div className="grid gap-1">
              <span className="text-xs font-medium">Level</span>
              <Select value={level} onValueChange={(v) => setLevel(v as QuestionBankLevelId)}>
                <SelectTrigger className="w-56" aria-label="Level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUESTION_BANK_LEVEL_IDS.map((id) => (
                    <SelectItem key={id} value={id}>
                      {TILE_LEVEL_WORDS[id]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <span className="text-xs font-medium">Kind</span>
              <Select value={format} onValueChange={(v) => setFormat(v as TileFormat)}>
                <SelectTrigger className="w-36" aria-label="Kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(FORMAT_LABELS) as TileFormat[]).map((f) => (
                    <SelectItem key={f} value={f}>
                      {FORMAT_LABELS[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="grid gap-1">
              <span className="text-xs font-medium">{format === 'T' ? 'Minutes' : 'Questions'}</span>
              <Input
                type="number"
                className="w-24"
                aria-label="How many"
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
            </label>
            <Button
              variant="outline"
              disabled={draftCode === null || duplicate}
              onClick={() => setTiles((list) => [...list, { ...draft, guest: 'locked', members: draft.kind === 'quest' }])}
            >
              Add {draftCode ?? 'tile'}
            </Button>
            <span className="text-muted-foreground text-xs">
              {draftProblem ?? (duplicate ? `${draftCode} is already listed.` : tileWords(draft))}
            </span>
          </div>

          <ul className="divide-y" aria-label="Tiles">
            {tiles.map((tile, index) => {
              const code = tileCode(tile);
              return (
                <li key={code} className="flex flex-wrap items-center gap-3 px-4 py-2 text-sm" data-testid={`tile-${code}`}>
                  <span className="w-20 font-mono font-semibold">{code}</span>
                  <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">{tileWords(tile)}</span>
                  <Select value={tile.guest} onValueChange={(v) => update(index, { guest: v as TileGuestState })}>
                    <SelectTrigger className="w-28" aria-label={`Guests: ${code}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(GUEST_LABELS) as TileGuestState[]).map((state) => (
                        <SelectItem key={state} value={state}>
                          {GUEST_LABELS[state]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="flex items-center gap-1.5 text-xs">
                    Members
                    <NotificationsSwitch
                      label={`Members: ${code}`}
                      checked={tile.members}
                      disabled={tile.kind === 'assessment'}
                      onCheckedChange={(on) => update(index, { members: on })}
                    />
                  </span>
                  <span className="flex">
                    <Button variant="ghost" size="icon" aria-label={`Move ${code} up`} disabled={index === 0} onClick={() => move(index, -1)}>
                      <ArrowUpIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Move ${code} down`}
                      disabled={index === tiles.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDownIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${code}`}
                      onClick={() => setTiles((list) => list.filter((_, i) => i !== index))}
                    >
                      <XIcon />
                    </Button>
                  </span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button disabled={save.isPending} onClick={() => void submit()}>
          Save Play settings
        </Button>
        {!data?.is_default && (
          <Button
            variant="outline"
            disabled={reset.isPending}
            onClick={() =>
              void reset.mutateAsync().then(
                () => toast.success('The default tiles are back.'),
                () => toast.error('The default tiles could not be put back.'),
              )
            }
          >
            Default tiles
          </Button>
        )}
      </div>
    </div>
  );
}
