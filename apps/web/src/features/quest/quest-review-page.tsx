import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { CheckIcon, FlagIcon, TrophyIcon, XIcon } from 'lucide-react';
import { QUESTION_DIFFICULTY_LABELS, questLevelLabel, type QuestReviewItem } from '@tmi/shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiRequestError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { MathText } from '@/features/question-bank/math-text';
import { useQuestReview, useReviewQuest } from './api';
import { QuestFrame } from './fullscreen-frame';

// Phase 42: a tutor's Question Quest review, full screen. One answer at a
// time, oldest first. The tutor judges the QUESTION: approving it puts it in
// the bank for every organization (owner, 2026-10-20); flagging it, with a
// reason, sends it to the platform console. docs/gamification-plan.md.

const LETTERS = ['A', 'B', 'C', 'D'];

export function QuestReviewPage() {
  const queue = useQuestReview();
  const data = queue.data?.data;

  return (
    <QuestFrame
      title="Review Quest answers"
      shortTitle="Review"
      testId="quest-review"
      status={
        data ? (
          <>
            <span data-testid="quest-waiting">{data.waiting} waiting</span>
            <span className="text-foreground flex items-center gap-1 font-medium" data-testid="quest-points">
              <TrophyIcon className="size-4" /> {data.points} {data.points === 1 ? 'point' : 'points'}
            </span>
          </>
        ) : null
      }
    >
      {queue.isPending ? (
        <Skeleton className="h-96 w-full" />
      ) : queue.isError || !data ? (
        <p className="text-destructive text-sm">The answers could not be loaded.</p>
      ) : !data.item ? (
        <Card className="py-0" data-testid="quest-review-empty">
          <CardContent className="grid gap-4 p-6 text-sm">
            <p>No answers are waiting for you. Well done.</p>
            <Button asChild variant="outline" className="w-fit">
              <Link to="/quest">Back</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ReviewCard key={data.item.attempt_id} item={data.item} />
      )}
    </QuestFrame>
  );
}

function ReviewCard({ item }: { item: QuestReviewItem }) {
  const review = useReviewQuest();
  const [flagging, setFlagging] = useState(false);
  const [note, setNote] = useState('');
  const q = item.question;
  const firstName = item.student_name.split(' ')[0] ?? item.student_name;

  async function decide(decision: 'approve' | 'flag') {
    try {
      await review.mutateAsync({
        attemptId: item.attempt_id,
        decision,
        ...(decision === 'flag' ? { note: note.trim() } : {}),
      });
      setFlagging(false);
      toast.success(decision === 'approve' ? 'Approved. The question is in the bank.' : 'Flagged for the platform.');
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? caught.message : 'Could not save the review.');
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start" data-testid="quest-review-item">
      <Card className="py-0">
        <CardContent className="grid gap-4 p-6">
          <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="secondary">{questLevelLabel(q.level_id)}</Badge>
            <span>
              {q.topic_code} · {q.topic_name}
            </span>
            <span>· {QUESTION_DIFFICULTY_LABELS[q.difficulty]}</span>
            {q.skill ? <span>· {q.skill}</span> : null}
          </div>
          <MathText text={q.stem} className="text-lg leading-relaxed" />
          {q.kind === 'choice' && (
            <ul className="grid gap-2" aria-label="Options">
              {q.choices.map((choice, i) => {
                const key = choice === q.answer;
                const chosen = choice === item.answer;
                return (
                  <li
                    key={i}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border px-3 py-2 text-sm',
                      key && 'border-primary bg-primary/10',
                      chosen && !key && 'border-destructive/50',
                    )}
                  >
                    <span className="text-muted-foreground w-4 font-semibold">{LETTERS[i]}</span>
                    <MathText text={choice} className="flex-1" />
                    {key && <Badge>Key</Badge>}
                    {chosen && <Badge variant="outline">{firstName}’s answer</Badge>}
                  </li>
                );
              })}
            </ul>
          )}
          <div className="grid gap-1 border-t pt-4 text-sm">
            <p className="font-medium">Worked solution</p>
            <MathText text={q.solution} className="text-muted-foreground leading-relaxed" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <Card className="py-0">
          <CardContent className="grid gap-2 p-5 text-sm">
            <p className="font-medium">{item.student_name}’s answer</p>
            <p className="flex items-center gap-2 text-lg" data-testid="quest-student-answer">
              <MathText text={item.answer} />
              {item.correct ? (
                <Badge data-testid="quest-answer-mark">
                  <CheckIcon /> Matches the key
                </Badge>
              ) : (
                <Badge variant="outline" data-testid="quest-answer-mark">
                  <XIcon /> Does not match
                </Badge>
              )}
            </p>
            {q.kind === 'numeric' && (
              <p className="text-muted-foreground">
                Key: <MathText text={q.answer} />
              </p>
            )}
            {(q.solver_answer || q.solver_issues) && (
              <p className="text-muted-foreground text-xs">
                The blind solver answered {q.solver_answer ?? '—'}
                {q.solver_issues ? ` and noted: ${q.solver_issues}` : '.'}
              </p>
            )}
          </CardContent>
        </Card>
        <p className="text-muted-foreground text-xs">
          Judge the question, not only the answer: is the key right, is there exactly one defensible answer, is it
          clear and fit for the level? Approving puts it in the bank for every organization.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            size="lg"
            onClick={() => void decide('approve')}
            disabled={review.isPending}
            data-testid="quest-approve"
          >
            <CheckIcon /> Question is right
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => setFlagging(true)}
            disabled={review.isPending}
            data-testid="quest-flag"
          >
            <FlagIcon /> Question has a problem
          </Button>
        </div>
      </div>

      <Dialog open={flagging} onOpenChange={setFlagging}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>What is wrong with the question?</DialogTitle>
            <DialogDescription>
              It leaves the bank’s queue and goes to the platform, with your reason. {firstName}’s answer is kept.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={400}
            rows={4}
            placeholder="For example: two of the options are correct."
            aria-label="Reason"
            data-testid="quest-flag-note"
            className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setFlagging(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void decide('flag')}
              disabled={!note.trim() || review.isPending}
              data-testid="quest-flag-confirm"
            >
              Flag the question
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
