import { useEffect, useMemo, useState } from 'react';
import { Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';
import {
  PLAN_STATUSES,
  PLAN_STATUS_LABELS,
  formatDuration,
  type Assessment,
  type LearningPlan,
  type PlanStatus,
  type Rating,
} from '@tmi/shared';

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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiRequestError } from '@/lib/api-client';
import { localToday } from './dates';
import { TEXTAREA } from './assessment-dialog';
import { useCreatePlan, useCurriculum, useUpdatePlan } from './api';
import { LevelSelect, PlanTopicsEditor } from './topic-pickers';

const SESSION_LENGTHS = [30, 45, 60, 75, 90, 120];

/** A year from a date, as the default goal date. */
function aYearOn(iso: string): string {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

/**
 * The recommended course of tutoring: a goal and its date, the topics that
 * lead there, and how often to meet.
 *
 * A new plan starts from the latest assessment: every topic it scored 3 or
 * below is pre-selected, weakest first, because those are what the plan is
 * for. The assessor then trims and reorders.
 */
export function PlanDialog({
  open,
  onOpenChange,
  studentId,
  studentName,
  existing,
  assessment,
  defaultGoal,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
  existing: LearningPlan | null;
  /** The assessment a new plan answers: the student's latest. */
  assessment: Assessment | null;
  /**
   * The goal already on the student's record. A new plan starts from it,
   * because the two are one goal: saving the plan writes its goal back.
   */
  defaultGoal?: string | null;
}) {
  const { data } = useCurriculum();
  const levels = useMemo(() => data?.data ?? [], [data]);

  const [goal, setGoal] = useState('');
  const [targetLevel, setTargetLevel] = useState('');
  const [startsOn, setStartsOn] = useState(localToday());
  const [targetOn, setTargetOn] = useState(aYearOn(localToday()));
  const [perWeek, setPerWeek] = useState(1);
  const [minutes, setMinutes] = useState(60);
  const [recommendation, setRecommendation] = useState('');
  const [topics, setTopics] = useState<string[]>([]);
  const [status, setStatus] = useState<PlanStatus>('active');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const create = useCreatePlan();
  const update = useUpdatePlan();
  const saving = create.isPending || update.isPending;

  const baseline = useMemo(
    () => new Map<string, Rating>((assessment?.ratings ?? []).map((r) => [r.topic_id, r.rating])),
    [assessment],
  );

  useEffect(() => {
    if (!open) return;
    setErrors({});

    if (existing) {
      setGoal(existing.goal);
      setTargetLevel(existing.target_level_id ?? '');
      setStartsOn(existing.starts_on);
      setTargetOn(existing.target_on);
      setPerWeek(existing.sessions_per_week);
      setMinutes(existing.session_minutes);
      setRecommendation(existing.recommendation ?? '');
      setTopics(existing.topic_ids);
      setStatus(existing.status);
      return;
    }

    const order = new Map<string, number>();
    levels.forEach((level) =>
      level.topics.forEach((topic) => order.set(topic.id, level.stage * 100 + topic.number)),
    );
    const weakest = (assessment?.ratings ?? [])
      .filter((row) => row.rating <= 3)
      .sort((a, b) => a.rating - b.rating || (order.get(a.topic_id) ?? 0) - (order.get(b.topic_id) ?? 0))
      .map((row) => row.topic_id);

    const today = localToday();
    setGoal(defaultGoal ?? '');
    setTargetLevel('');
    setStartsOn(today);
    setTargetOn(aYearOn(today));
    setPerWeek(1);
    setMinutes(60);
    setRecommendation('');
    setTopics(weakest);
    setStatus('active');
  }, [open, existing, assessment, levels, defaultGoal]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});

    const body = {
      goal: goal.trim(),
      target_level_id: targetLevel || null,
      starts_on: startsOn,
      target_on: targetOn,
      sessions_per_week: perWeek,
      session_minutes: minutes,
      recommendation: recommendation.trim() || null,
      topic_ids: topics,
    };

    try {
      if (existing) {
        await update.mutateAsync({ id: existing.id, input: { ...body, status } });
        toast.success('Plan updated.');
      } else {
        await create.mutateAsync({
          student_user_id: studentId,
          assessment_id: assessment?.id ?? null,
          ...body,
        });
        toast.success('Plan created.');
      }
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setErrors(error.fieldErrors);
        toast.error(error.message);
        return;
      }
      toast.error('Could not save the plan.');
    }
  }

  const fieldError = (key: string) =>
    errors[key] ? (
      <p role="alert" className="text-destructive text-xs">
        {errors[key]}
      </p>
    ) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
        <form onSubmit={handleSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>
              {existing ? 'Edit learning plan' : 'Learning plan'} for {studentName}
            </DialogTitle>
            <DialogDescription>
              {assessment && !existing
                ? `Answers the ${assessment.assessed_on} assessment. Topics it rated 3 or below are chosen for you.`
                : 'The goal, when it is due, what to cover, and how often to meet.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="goal" className={errors.goal ? 'text-destructive' : ''}>
                Goal
              </Label>
              <Input
                id="goal"
                value={goal}
                placeholder="e.g. Ready for AoPS Prealgebra by next school year"
                onChange={(event) => setGoal(event.target.value)}
                aria-invalid={Boolean(errors.goal)}
              />
              {fieldError('goal') ?? (
                <p className="text-muted-foreground text-xs">
                  {existing && existing.status !== 'active'
                    ? 'This plan is finished, so its goal is kept as history.'
                    : `Also the goal on ${studentName}’s record — the two are always the same.`}
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="target-level">Getting ready for</Label>
                <LevelSelect
                  id="target-level"
                  levels={levels}
                  value={targetLevel}
                  onChange={setTargetLevel}
                  placeholder="Optional"
                  allowNone
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="starts-on">Tutoring starts</Label>
                <Input id="starts-on" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="target-on" className={errors.target_on ? 'text-destructive' : ''}>
                  Goal date
                </Label>
                <Input
                  id="target-on"
                  type="date"
                  value={targetOn}
                  min={startsOn}
                  onChange={(e) => setTargetOn(e.target.value)}
                  aria-invalid={Boolean(errors.target_on)}
                />
                {fieldError('target_on')}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="per-week">Sessions a week</Label>
                <Select value={String(perWeek)} onValueChange={(v) => setPerWeek(Number(v))}>
                  <SelectTrigger id="per-week" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n === 1 ? 'Once a week' : n === 2 ? 'Twice a week' : `${n} times a week`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="session-minutes">Each session</Label>
                <Select value={String(minutes)} onValueChange={(v) => setMinutes(Number(v))}>
                  <SelectTrigger id="session-minutes" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SESSION_LENGTHS.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {formatDuration(n)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {existing && (
                <div className="grid gap-2">
                  <Label htmlFor="plan-status">Status</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as PlanStatus)}>
                    <SelectTrigger id="plan-status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLAN_STATUSES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {PLAN_STATUS_LABELS[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="recommendation">Recommendation</Label>
              <textarea
                id="recommendation"
                rows={4}
                value={recommendation}
                onChange={(event) => setRecommendation(event.target.value)}
                placeholder="The course of tutoring, in your words: what first, what can wait, what to watch for."
                className={TEXTAREA}
              />
            </div>

            <div className="grid gap-2">
              <Label className={errors.topic_ids ? 'text-destructive' : ''}>Topics to cover</Label>
              {levels.length > 0 && (
                <PlanTopicsEditor levels={levels} value={topics} onChange={setTopics} baseline={baseline} />
              )}
              {fieldError('topic_ids')}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2Icon className="animate-spin" />}
              {existing ? 'Save changes' : 'Create plan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
