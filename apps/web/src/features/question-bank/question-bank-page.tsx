import { Link, useNavigate } from 'react-router-dom';
import { ClipboardCheckIcon, ImageOffIcon, SparklesIcon, SquareIcon } from 'lucide-react';
import {
  QUESTIONS_PER_DIFFICULTY_TARGET,
  QUESTION_DIFFICULTY_LABELS,
  topicCovered,
  type QuestionCoverageLevel,
  type QuestionCoverageTopic,
} from '@tmi/shared';

import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useQuestionCoverage } from './api';
import { describeProgress, useWriteQuestions } from './use-write-questions';

const TARGET = QUESTIONS_PER_DIFFICULTY_TARGET * 3;

const approvedOf = (topic: QuestionCoverageTopic) => topic.approved.reduce((a, b) => a + b, 0);
/** Standards still short of their target that can be asked in text. */
const toWrite = (level: QuestionCoverageLevel) =>
  level.topics.filter((t) => !t.needs_figure && !topicCovered(t) && t.checked + t.draft === 0);

function ApprovedCell({ topic }: { topic: QuestionCoverageTopic }) {
  return (
    <span
      className="flex items-center gap-1"
      title={topic.approved.map((n, i) => `${QUESTION_DIFFICULTY_LABELS[(i + 1) as 1 | 2 | 3]}: ${n}`).join(', ')}
    >
      {topic.approved.map((count, index) => (
        <span
          key={index}
          className={cn(
            'inline-flex h-5 min-w-5 items-center justify-center rounded px-1 text-xs tabular-nums',
            count >= QUESTIONS_PER_DIFFICULTY_TARGET ? 'bg-success/15 text-success' : count > 0 ? 'bg-warning/20' : 'bg-muted text-muted-foreground',
          )}
        >
          {count}
        </span>
      ))}
    </span>
  );
}

function LevelSection({ level }: { level: QuestionCoverageLevel }) {
  const navigate = useNavigate();
  const writer = useWriteQuestions();
  const pending = toWrite(level);
  const covered = level.topics.filter(topicCovered).length;

  return (
    <section className="grid gap-2" aria-labelledby={`level-${level.level_id}`} data-testid={`bank-level-${level.level_id}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 id={`level-${level.level_id}`} className="text-lg font-semibold">
          {level.name}
        </h2>
        <span className="text-muted-foreground text-sm">
          {covered} of {level.topics.length} standards at target
        </span>
        <div className="ml-auto flex gap-2">
          {writer.running ? (
            <Button size="sm" variant="outline" onClick={writer.cancel}>
              <SquareIcon /> Stop after this one
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={pending.length === 0}
              onClick={() => void writer.run(pending.map((t) => ({ topic_id: t.topic_id, code: t.code })))}
            >
              <SparklesIcon /> Write for {pending.length} standard{pending.length === 1 ? '' : 's'}
            </Button>
          )}
        </div>
      </div>
      {(writer.running || writer.progress.total > 0) && (
        <p className={cn('text-sm', writer.progress.error ? 'text-destructive' : 'text-muted-foreground')} role="status">
          {describeProgress(writer.progress)}
        </p>
      )}
      <Card className="py-0">
        <CardContent className="p-0">
          <ul className="divide-y">
            {level.topics.map((topic) => (
              <li key={topic.topic_id}>
                <button
                  type="button"
                  onClick={() => navigate(`/platform/questions/${encodeURIComponent(topic.topic_id)}`)}
                  className="hover:bg-muted/50 grid w-full gap-1 px-4 py-2.5 text-left text-sm sm:grid-cols-[6rem_1fr_auto_auto] sm:items-center sm:gap-4"
                >
                  <span className="font-medium">{topic.code}</span>
                  <span className="min-w-0">
                    {topic.name}
                    {topic.needs_figure && (
                      <Badge variant="outline" className="ml-2">
                        <ImageOffIcon /> Needs a figure
                      </Badge>
                    )}
                  </span>
                  <ApprovedCell topic={topic} />
                  <span className="text-muted-foreground text-xs sm:w-44 sm:text-right">
                    {[
                      topic.checked && `${topic.checked} to review`,
                      topic.flagged && `${topic.flagged} flagged`,
                      topic.draft && `${topic.draft} not checked`,
                    ]
                      .filter(Boolean)
                      .join(' · ') || (topicCovered(topic) ? 'At target' : '')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}

/**
 * The question bank (Phase 36): every standard of NC 2026 grades 3-8 and Math 1,
 * with its approved questions by difficulty against the target, and what is
 * waiting for review. Questions reach a test only once a person approves them.
 */
export function QuestionBankPage() {
  const coverage = useQuestionCoverage();
  const levels = coverage.data?.data ?? [];
  const topics = levels.flatMap((l) => l.topics);
  const approved = topics.reduce((sum, t) => sum + approvedOf(t), 0);
  const toReview = topics.reduce((sum, t) => sum + t.checked, 0);
  const flagged = topics.reduce((sum, t) => sum + t.flagged, 0);
  const askable = topics.filter((t) => !t.needs_figure);

  return (
    <>
      <PageHeader
        title="Question bank"
        description={`Claude writes each question; code checks it and a second model solves it blind; a person approves it. The target is ${TARGET} approved per standard, ${QUESTIONS_PER_DIFFICULTY_TARGET} at each difficulty.`}
        actions={
          <div className="flex flex-wrap gap-2">
            {/* Phase 51: approvals suggested by spaces whose Quest reviews are not trusted. */}
            <Button asChild variant="outline">
              <Link to="/platform/questions/review?suggested=1" data-testid="bank-suggested">
                Suggested by spaces
              </Link>
            </Button>
            <Button asChild disabled={toReview === 0}>
              <Link to="/platform/questions/review">
                <ClipboardCheckIcon /> Review {toReview} checked
              </Link>
            </Button>
          </div>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="bank-totals">
        {[
          ['Approved', approved],
          ['Standards at target', `${askable.filter(topicCovered).length} / ${askable.length}`],
          ['Waiting for review', toReview],
          ['Flagged', flagged],
        ].map(([label, value]) => (
          <Card key={label} className="py-0">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs">{label}</p>
              <p className="text-2xl font-semibold tabular-nums">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-8">
        {levels.map((level) => (
          <LevelSection key={level.level_id} level={level} />
        ))}
      </div>
    </>
  );
}
