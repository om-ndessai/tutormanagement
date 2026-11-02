import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { CheckIcon, XIcon } from 'lucide-react';
import { TILE_LEVEL_TAGS, TILE_LEVEL_WORDS, dailyShareText, type QuestionBankLevelId } from '@tmi/shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MathText } from '@/features/question-bank/math-text';
import { ApiRequestError } from '@/lib/api-client';
import { useDaily, useSaveDaily } from './habit-api';

/**
 * Phase 64 (P19): the Daily set -- five questions of a level, the same for everyone today. The questions
 * come without keys; the answers go to the server in one request at the end, which marks them and
 * sends back the keys with the result (R20). One play a day, and a share grid that names nobody.
 */
export function DailyPage() {
  const { level = 'NC26.4' } = useParams();
  const daily = useDaily(level);
  const save = useSaveDaily(level);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(string | null)[]>([]);
  const [typed, setTyped] = useState('');
  const started = useRef(Date.now());
  const data = daily.data?.data;
  const tag = TILE_LEVEL_TAGS[level as QuestionBankLevelId] ?? level;
  const words = TILE_LEVEL_WORDS[level as QuestionBankLevelId] ?? level;

  useEffect(() => {
    started.current = Date.now();
  }, [data?.day]);

  if (daily.isPending) return <p className="text-muted-foreground p-6 text-sm">Getting today&apos;s Daily…</p>;
  if (!data || data.questions.length === 0) return <p className="p-6 text-sm">There is no Daily for {words} today.</p>;

  const result = data.result;
  if (result) {
    const text = dailyShareText(tag, data.number, result.marks, result.seconds);
    return (
      <div className="mx-auto grid max-w-2xl gap-4 p-4" data-testid="daily-result">
        <Card className="py-0">
          <CardContent className="grid gap-3 p-6">
            <h1 className="font-display text-2xl font-semibold">
              {tag}D #{data.number} · {result.right} of {result.of}
            </h1>
            <p className="font-mono text-lg tracking-widest" data-testid="daily-grid">
              {result.marks.map((m) => (m ? '✓' : '✗')).join('')}
            </p>
            <p className="text-muted-foreground text-sm">A new Daily tomorrow. Same five questions for everyone today.</p>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={async () => {
                  try {
                    if (navigator.share) await navigator.share({ title: 'Aimtrue Daily', text });
                    else {
                      await navigator.clipboard.writeText(text);
                      toast.success('Copied: paste it anywhere.');
                    }
                  } catch {
                    // Dismissed.
                  }
                }}
                data-testid="daily-share"
              >
                Share
              </Button>
              <Button variant="outline" asChild>
                <Link to="/">Back to Play</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
        {data.questions.map((q, i) => (
          <Card key={q.id} className="py-0">
            <CardContent className="grid gap-1 p-4 text-sm">
              <p className="flex items-center gap-2 font-medium">
                {result.marks[i] ? <CheckIcon className="text-primary size-4" /> : <XIcon className="text-destructive size-4" />} {i + 1}
              </p>
              <MathText text={q.stem} />
              {q.answer !== undefined && (
                <p className="text-muted-foreground">
                  Answer: <MathText text={q.answer} />
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const question = data.questions[index]!;
  function answer(given: string | null) {
    const next = [...answers, given];
    setAnswers(next);
    setTyped('');
    if (next.length < data!.questions.length) {
      setIndex(index + 1);
      return;
    }
    save
      .mutateAsync({ day: data!.day, answers: next, seconds: Math.round((Date.now() - started.current) / 1000) })
      .catch((caught) => toast.error(caught instanceof ApiRequestError ? caught.message : 'The result could not be saved.'));
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-4 p-4" data-testid="daily-play">
      <p className="text-muted-foreground text-sm">
        {tag}D #{data.number} · {words} · question {index + 1} of {data.questions.length}
      </p>
      <Card className="py-0">
        <CardContent className="grid gap-4 p-6">
          {question.beta && <Badge variant="secondary" className="w-fit px-1.5 py-0 text-[10px]">Beta</Badge>}
          <MathText text={question.stem} className="text-lg leading-relaxed" />
          {question.kind === 'choice' ? (
            <div className="grid gap-2" role="group" aria-label="Your answer">
              {question.choices.map((choice, i) => (
                <Button key={i} variant="outline" className="h-auto justify-start whitespace-normal py-3 text-left" onClick={() => answer(choice)} data-testid={`daily-choice-${i}`}>
                  <span className="mr-2 font-semibold">{String.fromCharCode(65 + i)}</span>
                  <MathText text={choice} />
                </Button>
              ))}
            </div>
          ) : (
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (typed.trim()) answer(typed.trim());
              }}
            >
              <Input aria-label="Your answer" value={typed} onChange={(e) => setTyped(e.target.value)} inputMode="decimal" data-testid="daily-number" />
              <Button type="submit">Answer</Button>
            </form>
          )}
          <Button variant="ghost" className="w-fit" onClick={() => answer(null)} data-testid="daily-skip">
            Skip
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
