// Ported from apps/web/src/features/question-bank/question-card.tsx @ b0d216e: the status badge,
// the check list, the card and its actions. Mobile (#54): the body is drawn by KaTeX in a web view
// (MathBody), with its spoken form as the label; the checks and the solver's working are native
// text, their maths in plain symbols. Only Approve, Retire and Restore are here -- Edit, Solve
// blind and Check again stay on the web, where a question the phone cannot fix is put right.
import {
  QUESTION_DIFFICULTY_LABELS,
  QUESTION_STATUS_LABELS,
  checkProblems,
  formatRelativeTime,
  type Question,
  type QuestionStatus,
} from '@tmi/shared';
import { useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';

import { OutlinedCard } from '@/components/outlined-card';
import { useToast } from '@/components/toast';
import { ApiRequestError } from '@/lib/api-client';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import { radius, space } from '@/theme/tokens';
import { useQuestionAction, type QuestionActionKind } from './api';
import { actionsFor } from './bank-model';
import { MathBody } from './math-body';
import { mathToText } from './math-text';
import { bodySpeech, bodyText, questionBodyHtml } from './question-html';
import { confirmRetire } from './retire-confirm';

export function errorMessage(error: unknown): string {
  return error instanceof ApiRequestError ? error.message : 'Something went wrong. Try again.';
}

function Pill({
  label,
  color,
  background,
  strike,
  testID,
}: {
  label: string;
  color: string;
  background: string;
  strike?: boolean;
  testID?: string;
}) {
  return (
    <View
      testID={testID}
      style={{
        backgroundColor: background,
        borderRadius: radius.sm,
        paddingHorizontal: space.sm,
        paddingVertical: 2,
      }}
    >
      <Text variant="labelMedium" style={{ color, textDecorationLine: strike ? 'line-through' : 'none' }}>
        {label}
      </Text>
    </View>
  );
}

export function StatusBadge({ status, testID }: { status: QuestionStatus; testID?: string }) {
  const theme = useAppTheme();
  const muted = { color: theme.tokens.mutedForeground, background: theme.tokens.muted };
  const look: Record<QuestionStatus, { color: string; background: string }> = {
    draft: muted,
    checked: { color: theme.colors.primary, background: withAlpha(theme.colors.primary, 0.1) },
    flagged: { color: theme.colors.error, background: withAlpha(theme.colors.error, 0.1) },
    approved: { color: theme.tokens.success, background: withAlpha(theme.tokens.success, 0.15) },
    retired: muted,
  };
  return (
    <Pill
      testID={testID}
      label={QUESTION_STATUS_LABELS[status]}
      {...look[status]}
      strike={status === 'retired'}
    />
  );
}

/** Each check, passed or not, so a reviewer sees what was verified as well as what failed. */
function CheckList({ question }: { question: Question }) {
  const theme = useAppTheme();
  const { lint, solve } = question.checks;
  const rows: { ok: boolean; text: string }[] = [
    {
      ok: lint.length === 0,
      text:
        lint.length === 0
          ? 'Code checks passed (form, choices, exact answer, no near-copy).'
          : lint.join(' '),
    },
  ];
  if (question.compute) {
    rows.push({
      ok: !lint.some((l) => l.includes('calculation')),
      text: `Answer computed exactly from ${question.compute}.`,
    });
  }
  if (solve) {
    rows.push(
      {
        ok: solve.agreed,
        // The answer may be a choice with maths in it.
        text: `Solved blind: ${mathToText(solve.answer, 'display')}, which ${solve.agreed ? 'matches' : 'does NOT match'}.`,
      },
      {
        ok: solve.single_answer,
        text: solve.single_answer ? 'One defensible answer.' : 'More than one defensible answer.',
      },
      { ok: solve.aligned, text: solve.aligned ? 'Tests this standard.' : 'Does not test this standard.' },
      {
        ok: solve.grade_appropriate,
        text: solve.grade_appropriate ? 'Suits the grade.' : 'Does not suit the grade.',
      },
      { ok: solve.error_free, text: solve.error_free ? 'No errors found.' : 'An error was found.' },
    );
  } else if (question.status !== 'approved' && question.status !== 'retired') {
    rows.push({ ok: false, text: 'Not yet solved blind.' });
  }

  return (
    <View
      testID={`question-bank-checks-${question.id}`}
      accessibilityLabel="Checks"
      style={{ gap: space.xs }}
    >
      {rows.map((row, index) => (
        <View
          key={index}
          accessible
          accessibilityLabel={`${row.ok ? 'Passed' : 'Failed'}: ${row.text}`}
          style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}
        >
          <View style={{ paddingTop: 2 }}>
            <Icon
              source={row.ok ? 'check' : 'close'}
              size={16}
              color={row.ok ? theme.tokens.success : theme.colors.error}
            />
          </View>
          <Text
            variant="bodySmall"
            style={{ flex: 1, color: row.ok ? theme.tokens.mutedForeground : theme.colors.error }}
          >
            {row.text}
          </Text>
        </View>
      ))}
      {solve?.issues ? (
        <Text variant="bodySmall" style={{ color: theme.colors.error, paddingLeft: 24 }}>
          Solver’s note: {mathToText(solve.issues, 'display')}
        </Text>
      ) : null}
    </View>
  );
}

/** "Approved by Nav Dessai, 2 hours ago", "Edited by hand" or "Written by Claude". */
export function provenance(question: Question): string {
  return question.status === 'approved' && question.reviewed_by_name
    ? `Approved by ${question.reviewed_by_name}, ${question.reviewed_at ? formatRelativeTime(question.reviewed_at) : ''}`.replace(
        /, $/,
        '',
      )
    : question.source === 'manual'
      ? 'Edited by hand'
      : 'Written by Claude';
}

/**
 * One question as a reviewer reads it: drawn as a student will see it, the key marked, the worked
 * solution, every check, and where it came from. `footer` takes the actions its screen offers;
 * Review passes `persistent` (one web view for the session) and `onRendered`, which it waits for
 * before its buttons wake.
 */
export function QuestionCard({
  question,
  footer,
  persistent,
  onRendered,
}: {
  question: Question;
  footer?: ReactNode;
  persistent?: boolean;
  onRendered?: (id: string) => void;
}) {
  const theme = useAppTheme();
  // Review keeps one card for the session: the working closes again for each new question.
  const [work, setWork] = useState({ id: question.id, open: false });
  const showWork = work.id === question.id && work.open;
  const problems = checkProblems(question.checks);
  const { kind, stem, choices, answer, solution } = question;
  const errorColor = theme.colors.error;
  const body = useMemo(() => {
    const content = { kind, stem, choices, answer, solution };
    return {
      html: questionBodyHtml(content, { errorColor }),
      speech: bodySpeech(content),
      plain: bodyText(content),
    };
  }, [kind, stem, choices, answer, solution, errorColor]);
  const working = question.checks.solve?.work;
  const secondary = { color: theme.colors.onSecondaryContainer, background: theme.colors.secondaryContainer };

  return (
    <OutlinedCard
      testID={`question-bank-card-${question.id}`}
      contentStyle={{ padding: space.lg, gap: space.md }}
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
        <StatusBadge status={question.status} testID={`question-bank-status-${question.id}`} />
        <Pill label={QUESTION_DIFFICULTY_LABELS[question.difficulty]} {...secondary} />
        <Pill label={question.kind === 'choice' ? 'Multiple choice' : 'Number answer'} {...secondary} />
        {question.skill ? (
          <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground, flexShrink: 1 }}>
            {question.skill}
          </Text>
        ) : null}
        {question.status === 'flagged' && problems.length > 0 ? (
          <Text variant="bodySmall" style={{ color: theme.colors.error }}>
            {problems.length === 1 ? '1 problem' : `${problems.length} problems`}
          </Text>
        ) : null}
      </View>

      <MathBody
        testID={`question-bank-body-${question.id}`}
        html={body.html}
        speech={body.speech}
        plain={body.plain}
        contentKey={question.id}
        persistent={persistent}
        onRendered={onRendered}
      />

      <CheckList question={question} />

      {working ? (
        <View style={{ alignItems: 'flex-start' }}>
          <Button
            testID={`question-bank-work-toggle-${question.id}`}
            mode="text"
            compact
            onPress={() => setWork({ id: question.id, open: !showWork })}
            accessibilityState={{ expanded: showWork }}
            style={{ marginLeft: -space.sm }}
          >
            {showWork ? 'Hide' : 'Show'} the solver’s working
          </Button>
          {showWork ? (
            <Text
              testID={`question-bank-work-${question.id}`}
              variant="bodySmall"
              style={{ color: theme.tokens.mutedForeground }}
            >
              {mathToText(working, 'display')}
            </Text>
          ) : null}
        </View>
      ) : null}

      <Text
        testID={`question-bank-provenance-${question.id}`}
        variant="bodySmall"
        style={{ color: theme.tokens.mutedForeground }}
      >
        {provenance(question)}
      </Text>

      {footer}
    </OutlinedCard>
  );
}

const TOASTS: Record<QuestionActionKind, string> = {
  approve: 'Approved.',
  retire: 'Retired.',
  restore: 'Restored: check it again.',
};

/**
 * A standard's card actions: Approve only when checked (the server holds the same rule), Retire
 * (after a confirm) unless retired, Restore only when retired. The toast gives the haptic.
 */
export function QuestionActions({ question }: { question: Question }) {
  const toast = useToast();
  const action = useQuestionAction();
  const offered = actionsFor(question.status);
  const busy = action.isPending;

  async function run(kind: QuestionActionKind) {
    if (kind === 'retire' && !(await confirmRetire())) return;
    action.mutate(
      { id: question.id, action: kind },
      {
        onSuccess: () => toast.success(TOASTS[kind]),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  }

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {offered.approve ? (
        <Button
          testID={`question-bank-approve-${question.id}`}
          mode="contained"
          icon="check"
          disabled={busy}
          loading={busy && action.variables?.action === 'approve'}
          onPress={() => void run('approve')}
        >
          Approve
        </Button>
      ) : null}
      {offered.restore ? (
        <Button
          testID={`question-bank-restore-${question.id}`}
          mode="outlined"
          icon="restore"
          disabled={busy}
          onPress={() => void run('restore')}
        >
          Restore
        </Button>
      ) : null}
      {offered.retire ? (
        <Button
          testID={`question-bank-retire-${question.id}`}
          mode="text"
          icon="close"
          disabled={busy}
          onPress={() => void run('retire')}
        >
          Retire
        </Button>
      ) : null}
    </View>
  );
}
