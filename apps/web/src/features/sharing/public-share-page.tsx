import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckIcon, XIcon } from 'lucide-react';
import { shareHeadline, type PublicShare } from '@tmi/shared';

import { LogoFull } from '@/components/brand/logo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { MathText } from '@/features/question-bank/math-text';
import { ApiRequestError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useAnswerChallenge, usePublicShare } from './api';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/**
 * Phase 56: `/s/<id>`, the one page anyone may open signed out. The card --
 * numbers and the maker's chosen first name, nothing else -- and, for "Can you
 * solve this?", the question to answer: marked on the server, with the worked
 * solution after. No free text, no comments, no space's name (R22).
 */
export function PublicSharePage() {
  const { id = '' } = useParams();
  const query = usePublicShare(id);
  const share = query.data?.data;

  return (
    <div className="bg-background min-h-dvh px-4 py-10">
      <div className="mx-auto grid w-full max-w-xl gap-6">
        <div className="flex justify-center">
          <LogoFull className="h-12 w-auto" />
        </div>
        {query.isPending ? (
          <Skeleton className="h-48 w-full" />
        ) : !share || !share.available || !share.card ? (
          <Card className="py-0" data-testid="share-gone">
            <CardContent className="grid gap-2 p-6 text-center text-sm">
              <p className="font-medium">This share is no longer available.</p>
              <p className="text-muted-foreground">Its maker withdrew it, or it expired.</p>
            </CardContent>
          </Card>
        ) : (
          <ShareCardView share={share} />
        )}
        <p className="text-muted-foreground text-center text-xs">
          <Link to="/" className="underline">
            Aimtrue
          </Link>{' '}
          · maths practice, one question at a time
        </p>
      </div>
    </div>
  );
}

function ShareCardView({ share }: { share: PublicShare }) {
  const card = share.card!;
  return (
    <Card className="py-0" data-testid="share-card">
      <CardContent className="grid gap-4 p-6">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Aimtrue Quest{share.first_name ? ` · ${share.first_name}` : ''}
        </p>
        <h1 className="text-2xl font-bold" data-testid="share-headline">
          {shareHeadline(card)}
        </h1>
        {card.kind === 'game_result' && card.marks.length > 0 && (
          <div className="flex flex-wrap gap-1.5" aria-label={`${card.correct} right of ${card.total}`}>
            {card.marks.map((mark, i) => (
              <span
                key={i}
                className={cn(
                  'size-6 rounded-md',
                  mark === 'right' ? 'bg-success' : mark === 'wrong' ? 'bg-destructive' : 'bg-muted',
                )}
              />
            ))}
          </div>
        )}
        {card.kind === 'challenge' && share.question && <Challenge share={share} />}
      </CardContent>
    </Card>
  );
}

function Challenge({ share }: { share: PublicShare }) {
  const question = share.question!;
  const answer = useAnswerChallenge(share.id);
  const [choice, setChoice] = useState<number | null>(null);
  const [number, setNumber] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const response = question.kind === 'choice' ? (choice === null ? '' : question.choices[choice]!) : number.trim();
  const result = answer.data?.data;

  async function submit() {
    setProblem(null);
    try {
      await answer.mutateAsync({ answer: response, ...(token ? { turnstile_token: token } : {}) });
    } catch (caught) {
      setProblem(caught instanceof ApiRequestError ? caught.message : 'Could not check that. Try again.');
    }
  }

  return (
    <div className="grid gap-4">
      <MathText text={question.stem} className="text-lg leading-relaxed" />
      {result ? (
        <div className="grid gap-2" data-testid="challenge-result">
          {result.correct ? (
            <Badge className="w-fit">
              <CheckIcon /> Right!
            </Badge>
          ) : (
            <Badge variant="destructive" className="w-fit">
              <XIcon /> Not quite
            </Badge>
          )}
          <p className="text-sm">
            <span className="font-medium">Answer: </span>
            <MathText text={result.answer} />
          </p>
          <details className="text-muted-foreground text-sm" open>
            <summary className="cursor-pointer">Solution</summary>
            <MathText text={result.solution} className="mt-2 block" />
          </details>
        </div>
      ) : (
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {question.kind === 'choice' ? (
            <div role="radiogroup" aria-label="Your answer" className="grid gap-2">
              {question.choices.map((text, i) => (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={choice === i}
                  data-testid={`challenge-choice-${LETTERS[i]}`}
                  onClick={() => setChoice(choice === i ? null : i)}
                  className={cn(
                    'flex min-h-12 items-center gap-3 rounded-lg border px-4 py-2 text-left transition-colors',
                    choice === i ? 'border-primary bg-primary/10 font-medium' : 'hover:bg-muted',
                  )}
                >
                  <span className="text-muted-foreground w-5 text-sm font-semibold">{LETTERS[i]}</span>
                  <MathText text={text} />
                </button>
              ))}
            </div>
          ) : (
            <Input
              value={number}
              onChange={(event) => setNumber(event.target.value)}
              inputMode="decimal"
              placeholder="A number, like 12, 3/4 or 2.5"
              data-testid="challenge-number"
            />
          )}
          {share.turnstile_site_key && <Turnstile siteKey={share.turnstile_site_key} onToken={setToken} />}
          {problem && <p className="text-destructive text-sm">{problem}</p>}
          <Button
            type="submit"
            disabled={!response || answer.isPending || (Boolean(share.turnstile_site_key) && !token)}
            data-testid="challenge-submit"
          >
            Check my answer
          </Button>
        </form>
      )}
    </div>
  );
}

declare global {
  interface Window {
    turnstile?: {
      render(element: HTMLElement, options: { sitekey: string; callback: (token: string) => void }): string;
      remove(widgetId: string): void;
    };
  }
}

/** Cloudflare Turnstile's widget: proves a person is answering before the Worker marks it. */
function Turnstile({ siteKey, onToken }: { siteKey: string; onToken: (token: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let widget: string | null = null;
    const mount = () => {
      if (ref.current && window.turnstile) widget = window.turnstile.render(ref.current, { sitekey: siteKey, callback: onToken });
    };
    if (window.turnstile) mount();
    else {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.onload = mount;
      document.head.appendChild(script);
    }
    return () => {
      if (widget && window.turnstile) window.turnstile.remove(widget);
    };
  }, [siteKey, onToken]);
  return <div ref={ref} />;
}
