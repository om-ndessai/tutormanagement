import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ClipboardCheckIcon, PlayIcon, TrophyIcon } from 'lucide-react';
import {
  QUESTION_BANK_LEVEL_IDS,
  levelLabel,
  questLevelLabel,
  type QuestLevelInput,
  type QuestStudent,
} from '@tmi/shared';

import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ApiRequestError } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';
import { questRoles, useQuestReview, useQuestState, useQuestStudents, useSetQuestLevel } from './api';
import { GamesCard } from './games-card';

// Phase 42: Question Quest's page in the portal. A student starts their Quest
// here; a tutor or admin sees what waits for review, starts reviewing, and
// sets each student's starting level. The Quest itself runs full screen
// (quest-play-page, quest-review-page). docs/gamification-plan.md.

const NOT_SET = 'none';

export function QuestPage() {
  const { user } = useAuth();
  const roles = questRoles(user?.roles);

  return (
    <>
      <PageHeader
        title="Question Quest"
        description="Answer the question bank’s new questions, one at a time, and earn points. Tutors check each answer and approve the question for everyone."
        actions={<Badge variant="secondary">Beta</Badge>}
      />
      <div className="grid gap-6">
        {roles.plays && <PlayCard />}
        {/* Phase 46: games are for everyone here. */}
        <GamesCard />
        {roles.reviews && <ReviewCard />}
        {roles.reviews && <StudentsCard />}
      </div>
    </>
  );
}

function PlayCard() {
  const state = useQuestState();
  const data = state.data?.data;
  return (
    <Card className="py-0" data-testid="quest-play-card">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="grid flex-1 gap-1 text-sm">
          <h2 className="font-semibold">Your Quest</h2>
          {state.isPending ? (
            <Skeleton className="h-4 w-48" />
          ) : (
            <p className="text-muted-foreground">
              {questLevelLabel(data?.level_id ?? null)} · {data?.answered ?? 0} answered ·{' '}
              <span className="text-foreground inline-flex items-center gap-1 font-medium">
                <TrophyIcon className="size-3.5" /> {data?.points ?? 0} points
              </span>
            </p>
          )}
        </div>
        <Button asChild size="lg" disabled={!data?.level_id} data-testid="quest-start">
          <Link to="/quest/play">
            <PlayIcon /> {data?.answered ? 'Carry on' : 'Start'}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function ReviewCard() {
  const queue = useQuestReview();
  const data = queue.data?.data;
  return (
    <Card className="py-0" data-testid="quest-review-card">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="grid flex-1 gap-1 text-sm">
          <h2 className="font-semibold">Answers to review</h2>
          <p className="text-muted-foreground">
            {queue.isPending ? '…' : `${data?.waiting ?? 0} waiting`} ·{' '}
            <span className="text-foreground inline-flex items-center gap-1 font-medium">
              <TrophyIcon className="size-3.5" /> {data?.points ?? 0} points
            </span>
          </p>
        </div>
        <Button asChild size="lg" variant={data?.waiting ? 'default' : 'outline'} data-testid="quest-review-start">
          <Link to="/quest/review">
            <ClipboardCheckIcon /> Review
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function StudentsCard() {
  const students = useQuestStudents();
  const rows = students.data?.data ?? [];
  return (
    <Card className="py-0" data-testid="quest-students">
      <CardContent className="grid gap-3 p-5 text-sm">
        <div>
          <h2 className="font-semibold">Students</h2>
          <p className="text-muted-foreground text-xs">
            Set where each student starts. When they have answered every new question of a level, they move up by
            themselves. Only students who sign in can play.
          </p>
        </div>
        {students.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground">No students to show.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead className="text-right">Answered</TableHead>
                  <TableHead className="text-right">Confirmed</TableHead>
                  <TableHead className="text-right">Waiting</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <StudentRow key={row.user_id} row={row} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StudentRow({ row }: { row: QuestStudent }) {
  const setLevel = useSetQuestLevel();
  async function change(value: string) {
    try {
      await setLevel.mutateAsync({ studentId: row.user_id, level_id: value === NOT_SET ? null : (value as QuestLevelInput['level_id']) });
      toast.success(value === NOT_SET ? `${row.full_name}’s level is cleared.` : `${row.full_name} starts at ${levelLabel(value)}.`);
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? caught.message : 'Could not set the level.');
    }
  }
  return (
    <TableRow data-testid={`quest-student-${row.user_id}`}>
      <TableCell className="font-medium">{row.full_name}</TableCell>
      <TableCell>
        <Select value={row.level_id ?? NOT_SET} onValueChange={(value) => void change(value)}>
          <SelectTrigger className="w-44" aria-label={`${row.full_name}’s level`} data-testid={`quest-level-${row.user_id}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NOT_SET}>Not set</SelectItem>
            {QUESTION_BANK_LEVEL_IDS.map((id) => (
              <SelectItem key={id} value={id}>
                {levelLabel(id)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-right tabular-nums">{row.answered}</TableCell>
      <TableCell className="text-right tabular-nums">{row.confirmed}</TableCell>
      <TableCell className="text-right tabular-nums">{row.waiting}</TableCell>
      <TableCell className="text-right tabular-nums">{row.points}</TableCell>
    </TableRow>
  );
}

const LANDED = 'aimtrue.quest-landed';

/**
 * The sign-in landing (owner's brief): once per tab, a student with a question
 * waiting goes straight into Quest, and a tutor with answers waiting straight
 * to review. Never again in that tab, so leaving Quest stays left.
 */
export function QuestLanding() {
  const { user, organization } = useAuth();
  const navigate = useNavigate();
  const on = Boolean(organization?.gamify_question_quest);
  const roles = questRoles(user?.roles);
  const admin = Boolean(user?.roles.includes('admin'));
  const already = (() => {
    try {
      return sessionStorage.getItem(LANDED) === '1';
    } catch {
      return false;
    }
  })();
  const student = roles.plays && !roles.reviews;
  const tutor = !roles.plays && roles.reviews && !admin;
  const state = useQuestState(on && !already && student);
  const queue = useQuestReview(on && !already && tutor);

  useEffect(() => {
    if (!on || already) return;
    const mark = () => {
      try {
        sessionStorage.setItem(LANDED, '1');
      } catch {
        // Storage blocked: it may land again, which is harmless.
      }
    };
    if (student && state.data) {
      mark();
      if (state.data.data.question) navigate('/quest/play');
    } else if (tutor && queue.data) {
      mark();
      if (queue.data.data.waiting > 0) navigate('/quest/review');
    } else if (!student && !tutor) {
      mark();
    }
  }, [on, already, student, tutor, state.data, queue.data, navigate]);

  return null;
}
