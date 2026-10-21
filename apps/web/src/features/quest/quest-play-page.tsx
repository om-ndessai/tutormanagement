import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { SparklesIcon, TrophyIcon } from 'lucide-react';
import { QUEST_POINTS, questLevelLabel, type QuestQuestion } from '@tmi/shared';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiRequestError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { MathText } from '@/features/question-bank/math-text';
import { useAnswerQuest, useQuestState, useQuestSummary } from './api';
import { QuestFrame } from './fullscreen-frame';
import { QuestWelcome } from './quest-welcome';

// Phase 42: a student's Question Quest, full screen. One question at a time,
// answered once: no going back, no skipping. Nothing is marked here -- the
// key has not been checked by a person yet -- so the student sees "saved",
// and the points for trying. docs/gamification-plan.md.

const LETTERS = ['A', 'B', 'C', 'D'];

export function QuestPlayPage() {
  const state = useQuestState();
  const data = state.data?.data;
  // The welcome, once each time Quest opens (owner, 2026-10-21).
  const summary = useQuestSummary();
  const [welcomed, setWelcomed] = useState(false);
  const closeWelcome = useCallback(() => setWelcomed(true), []);
  const welcome = summary.data?.data;
  const showWelcome = !welcomed && Boolean(welcome?.level_id) && Boolean(data?.question);

  // The point collected: "+N" floats up beside the counter, which bumps as it ticks.
  const points = data?.points ?? 0;
  const previous = useRef<number | null>(null);
  const [burst, setBurst] = useState<{ id: number; gained: number } | null>(null);
  useEffect(() => {
    if (previous.current !== null && points > previous.current) {
      setBurst({ id: Date.now(), gained: points - previous.current });
    }
    previous.current = points;
  }, [points]);

  return (
    <QuestFrame
      title="Question Quest"
      shortTitle="Quest"
      testId="quest-play"
      status={
        data ? (
          <>
            <span data-testid="quest-level">{questLevelLabel(data.level_id)}</span>
            <span className="relative flex items-center">
              <span
                key={burst?.id ?? 'still'}
                className={cn('text-foreground flex items-center gap-1 font-medium', burst && 'quest-bump')}
                data-testid="quest-points"
              >
                <TrophyIcon className="size-4" /> {data.points} {data.points === 1 ? 'point' : 'points'}
              </span>
              {burst && (
                <span
                  key={`b${burst.id}`}
                  className="quest-burst text-primary pointer-events-none absolute -top-3 right-0 text-sm font-bold"
                  data-testid="quest-points-burst"
                  aria-hidden
                >
                  +{burst.gained}
                </span>
              )}
            </span>
          </>
        ) : null
      }
    >
      {state.isPending ? (
        <Skeleton className="h-80 w-full" />
      ) : state.isError || !data ? (
        <Message text="Question Quest could not be loaded." />
      ) : !data.level_id ? (
        <Message
          testId="quest-no-level"
          text="Your tutor has not chosen your starting level yet. Ask them to set it, then come back."
        />
      ) : data.finished || !data.question ? (
        <Message
          testId="quest-finished"
          text={`You have answered every question there is to answer for now. ${data.answered} answered in all.`}
        />
      ) : (
        <>
          {data.moved_up_from && (
            <p
              className="bg-primary/10 text-primary flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium"
              data-testid="quest-moved-up"
            >
              <SparklesIcon className="size-4" /> You finished {questLevelLabel(data.moved_up_from)}. On to{' '}
              {questLevelLabel(data.level_id)}!
            </p>
          )}
          <div key={data.question.id} className="quest-enter">
            <QuestionCard question={data.question} answered={data.answered} />
          </div>
        </>
      )}
      {showWelcome && welcome && <QuestWelcome summary={welcome} onClose={closeWelcome} />}
    </QuestFrame>
  );
}

function Message({ text, testId }: { text: string; testId?: string }) {
  return (
    <Card className="py-0" data-testid={testId}>
      <CardContent className="grid gap-4 p-6 text-sm">
        <p>{text}</p>
        <Button asChild variant="outline" className="w-fit">
          <Link to="/quest">Back</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function QuestionCard({ question, answered }: { question: QuestQuestion; answered: number }) {
  const answer = useAnswerQuest();
  const [choice, setChoice] = useState<number | null>(null);
  const [number, setNumber] = useState('');
  const response = question.kind === 'choice' ? (choice === null ? '' : question.choices[choice]!) : number.trim();

  async function submit() {
    if (!response) return;
    try {
      await answer.mutateAsync({ question_id: question.id, answer: response });
      toast.success(`Saved. +${QUEST_POINTS.student_attempt} point${QUEST_POINTS.student_attempt === 1 ? '' : 's'}`, { duration: 1500 });
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? caught.message : 'Could not save your answer.');
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
      <Card className="py-0" data-testid="quest-question">
        <CardContent className="grid gap-3 p-6">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Question {answered + 1}
          </p>
          <MathText text={question.stem} className="text-lg leading-relaxed" />
        </CardContent>
      </Card>

      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {question.kind === 'choice' ? (
          <div role="radiogroup" aria-label="Your answer" className="grid gap-2">
            {question.choices.map((text, i) => {
              const selected = choice === i;
              return (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  data-testid={`quest-choice-${LETTERS[i]}`}
                  onClick={() => setChoice(selected ? null : i)}
                  className={cn(
                    'flex min-h-14 items-center gap-3 rounded-lg border px-4 py-3 text-left text-base transition-colors',
                    'focus-visible:ring-ring outline-none focus-visible:ring-2',
                    selected ? 'border-primary bg-primary/10 font-medium' : 'hover:bg-muted',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold',
                      selected ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {LETTERS[i]}
                  </span>
                  <MathText text={text} />
                </button>
              );
            })}
          </div>
        ) : (
          <label className="grid gap-2 text-sm font-medium">
            Your answer
            <Input
              value={number}
              onChange={(event) => setNumber(event.target.value)}
              inputMode="decimal"
              autoComplete="off"
              placeholder="A number, like 12, 3/4 or 2.5"
              className="h-14 text-lg"
              data-testid="quest-number"
              autoFocus
            />
          </label>
        )}
        <Button type="submit" size="lg" disabled={!response || answer.isPending} data-testid="quest-submit">
          Submit answer
        </Button>
        <p className="text-muted-foreground text-xs">
          Once you submit, the answer is saved and the next question comes. Your tutor checks each one.
        </p>
      </form>
    </div>
  );
}
