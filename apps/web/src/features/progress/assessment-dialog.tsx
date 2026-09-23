import { useEffect, useState } from 'react';
import { Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';
import type { Assessment, Rating } from '@tmi/shared';

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
import { ApiRequestError } from '@/lib/api-client';
import { localToday } from './dates';
import { useCreateAssessment, useCurriculum, useUpdateAssessment } from './api';
import { RatingLegend } from './rating';
import { LevelSelect, TopicRatingsEditor } from './topic-pickers';

export const TEXTAREA =
  'border-input bg-transparent placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]';

/**
 * Records where a student stands: a write-up, the level recommended, and a
 * 1-5 score on any topic the assessor chose to check.
 */
export function AssessmentDialog({
  open,
  onOpenChange,
  studentId,
  studentName,
  existing,
  defaultCourse,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
  existing: Assessment | null;
  defaultCourse?: string | null;
}) {
  const { data } = useCurriculum();
  const levels = data?.data ?? [];

  const [assessedOn, setAssessedOn] = useState(localToday());
  const [course, setCourse] = useState('');
  const [level, setLevel] = useState('');
  const [summary, setSummary] = useState('');
  const [ratings, setRatings] = useState(new Map<string, Rating>());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const create = useCreateAssessment();
  const update = useUpdateAssessment();
  const saving = create.isPending || update.isPending;

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setAssessedOn(existing?.assessed_on ?? localToday());
    setCourse(existing?.school_course ?? defaultCourse ?? '');
    setLevel(existing?.recommended_level_id ?? '');
    setSummary(existing?.summary ?? '');
    setRatings(new Map((existing?.ratings ?? []).map((row) => [row.topic_id, row.rating])));
  }, [open, existing, defaultCourse]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});

    const body = {
      assessed_on: assessedOn,
      school_course: course.trim() || null,
      recommended_level_id: level || null,
      summary: summary.trim() || null,
      ratings: [...ratings].map(([topic_id, rating]) => ({ topic_id, rating })),
    };

    try {
      if (existing) {
        await update.mutateAsync({ id: existing.id, input: body });
        toast.success('Assessment updated.');
      } else {
        await create.mutateAsync({ student_user_id: studentId, ...body });
        toast.success('Assessment recorded.');
      }
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setErrors(error.fieldErrors);
        toast.error(error.message);
        return;
      }
      toast.error('Could not save the assessment.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={handleSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>{existing ? 'Edit assessment' : 'Assess'} {studentName}</DialogTitle>
            <DialogDescription>
              Where they stand today. Rate only the topics you checked — an unrated topic is not a
              1.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="assessed-on">Assessed on</Label>
                <Input
                  id="assessed-on"
                  type="date"
                  value={assessedOn}
                  onChange={(event) => setAssessedOn(event.target.value)}
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="school-course">Currently enrolled in</Label>
                <Input
                  id="school-course"
                  value={course}
                  placeholder="e.g. Grade 5 math at school"
                  onChange={(event) => setCourse(event.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="recommended-level">Recommended level</Label>
              <LevelSelect
                id="recommended-level"
                levels={levels}
                value={level}
                onChange={setLevel}
                placeholder="Where they should work"
                allowNone
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="summary" className={errors.summary ? 'text-destructive' : ''}>
                Assessment
              </Label>
              <textarea
                id="summary"
                rows={7}
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                placeholder="What they can do, where the gaps are, how they approach problems…"
                className={TEXTAREA}
                aria-invalid={Boolean(errors.summary)}
              />
              {errors.summary && (
                <p role="alert" className="text-destructive text-xs">
                  {errors.summary}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Label>Topic ratings</Label>
                <span className="text-muted-foreground text-xs">{ratings.size} rated</span>
              </div>
              <RatingLegend />
              {levels.length > 0 && (
                <TopicRatingsEditor
                  levels={levels}
                  ratings={ratings}
                  onChange={setRatings}
                  initialLevel={level || existing?.ratings[0]?.topic_id.split('.')[0]}
                />
              )}
              {errors.ratings && (
                <p role="alert" className="text-destructive text-xs">
                  {errors.ratings}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2Icon className="animate-spin" />}
              {existing ? 'Save changes' : 'Record assessment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
