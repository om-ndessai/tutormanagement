import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2Icon, SmileIcon } from 'lucide-react';
import {
  formatClockTime,
  type ReflectionDigest,
  type ReflectionPrompt,
  type TutoringSession,
} from '@tmi/shared';

import { Button } from '@/components/ui/button';
import { useSession } from '@/features/teaching/api';
import {
  ReflectionChips,
  ReflectionDialog,
  ReflectionFlags,
} from '@/features/teaching/session-reflection';
import { EmptyNote, Panel } from './stat-card';

// ---------------------------------------------------------------------------
// Phase 25 on the dashboards: the student's and parent's prompt for lessons
// still waiting for a reflection, and the tutor's view of what their students
// made of recent lessons. None of it carries money.
// ---------------------------------------------------------------------------

function firstName(fullName: string): string {
  return fullName.split(' ')[0] ?? fullName;
}

/**
 * Recent lessons still waiting for the student's reflection, each with a
 * button that opens the questions. Renders nothing when none are waiting.
 * `forChildren` words it for a parent, who reflects with each child.
 */
export function ReflectionPrompts({
  prompts,
  index,
  forChildren = false,
}: {
  prompts: ReflectionPrompt[];
  index: number;
  forChildren?: boolean;
}) {
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [reflecting, setReflecting] = useState<TutoringSession | null>(null);

  // A prompt names the lesson; the dialog needs the lesson itself, fetched
  // through the ordinary scoped read.
  const lesson = useSession(openingId);
  useEffect(() => {
    if (openingId && lesson.data) {
      setReflecting(lesson.data.data);
      setOpeningId(null);
    }
  }, [openingId, lesson.data]);

  if (prompts.length === 0) return null;

  return (
    <>
      <Panel
        index={index}
        title={forChildren ? 'Reflect with your children' : 'How did your lessons go?'}
        action={{ label: 'All sessions', to: '/sessions' }}
      >
        <p className="text-muted-foreground -mt-2 mb-2 text-xs">
          {forChildren
            ? 'A few questions about each recent lesson, answered together. Their tutor reads them.'
            : 'A few quick questions about each recent lesson. Your tutor reads them.'}
        </p>
        <ul className="divide-border divide-y">
          {prompts.map((prompt) => (
            <li key={prompt.session_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
              <span className="min-w-0 flex-1 text-sm">
                {forChildren && <span className="font-medium">{prompt.student_name} </span>}
                <span className={forChildren ? 'text-muted-foreground' : 'font-medium'}>
                  {forChildren ? 'with ' : 'With '}
                  {prompt.tutor_name}
                </span>
                <span className="text-muted-foreground block text-xs">
                  {prompt.occurred_on} · {formatClockTime(prompt.started_at)}
                </span>
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={openingId !== null}
                onClick={() => setOpeningId(prompt.session_id)}
                // The date and the time: two lessons on one day stay distinct.
                aria-label={
                  (forChildren
                    ? `Reflect with ${firstName(prompt.student_name)} on the ${prompt.occurred_on}`
                    : `Reflect on the ${prompt.occurred_on}`) +
                  ` ${formatClockTime(prompt.started_at)} lesson`
                }
              >
                {openingId === prompt.session_id ? <Loader2Icon className="animate-spin" /> : <SmileIcon />}
                Reflect
              </Button>
            </li>
          ))}
        </ul>
      </Panel>

      <ReflectionDialog session={reflecting} onClose={() => setReflecting(null)} />
    </>
  );
}

/**
 * What the tutor's students made of recent lessons, newest first, with where
 * each one missed ("Too fast", "Little new") -- so the next lesson can adjust.
 */
export function RecentReflections({ digests }: { digests: ReflectionDigest[] }) {
  if (digests.length === 0) {
    return (
      <EmptyNote>
        No reflections yet. A student, their parent or you can add one from a lesson on the
        sessions page.
      </EmptyNote>
    );
  }

  return (
    <ul className="divide-border divide-y">
      {digests.map(({ session_id, occurred_on, student_name, reflection }) => (
        <li key={session_id} className="grid gap-1 py-2.5">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <Link to={`/sessions?focus=${session_id}`} className="text-sm font-medium hover:underline">
              {student_name}
            </Link>
            <span className="text-muted-foreground text-xs">{occurred_on}</span>
            <span className="flex flex-wrap gap-1">
              <ReflectionFlags reflection={reflection} />
            </span>
          </div>
          <ReflectionChips reflection={reflection} />
          {(reflection.homework_notes || reflection.comment) && (
            <p className="text-muted-foreground line-clamp-2 text-xs">
              {[reflection.homework_notes, reflection.comment].filter(Boolean).join(' · ')}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
