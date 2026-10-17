import { useState } from 'react';
import { toast } from 'sonner';
import {
  QUESTION_DIFFICULTIES,
  QUESTION_DIFFICULTY_LABELS,
  lintQuestion,
  questionUpdateSchema,
  type Question,
  type QuestionDifficulty,
  type QuestionKind,
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
import { TEXTAREA } from '@/features/progress/assessment-dialog';
import { ApiRequestError } from '@/lib/api-client';
import { useUpdateQuestion } from './api';
import { MathText } from './math-text';

/**
 * Correcting a question by hand. The code checks run as you type, the preview
 * renders the maths, and saving clears the blind solve: the question must be
 * solved blind again before it can be approved.
 */
export function QuestionEditDialog({ question, onClose }: { question: Question; onClose: () => void }) {
  const [kind, setKind] = useState<QuestionKind>(question.kind);
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>(question.difficulty);
  const [stem, setStem] = useState(question.stem);
  const [choices, setChoices] = useState<string[]>(
    question.kind === 'choice' ? question.choices : ['', '', '', ''],
  );
  const [answer, setAnswer] = useState(question.answer);
  const [compute, setCompute] = useState(question.compute ?? '');
  const [solution, setSolution] = useState(question.solution);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const update = useUpdateQuestion();

  const input = {
    kind,
    difficulty,
    stem,
    choices: kind === 'choice' ? choices : [],
    answer,
    compute: compute.trim() || null,
    solution,
  };
  // The same checks the server runs, near-copies aside (it knows the bank).
  const problems = lintQuestion(input);

  function save() {
    const parsed = questionUpdateSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])));
      return;
    }
    update.mutate(
      { id: question.id, input: parsed.data },
      {
        onSuccess: (result) => {
          toast.success(
            result.data.status === 'flagged' ? 'Saved, but a code check still fails.' : 'Saved. Solve it blind again before approving.',
          );
          onClose();
        },
        onError: (error) => {
          if (error instanceof ApiRequestError) setErrors(error.fieldErrors);
          toast.error(error instanceof ApiRequestError ? error.message : 'Could not save.');
        },
      },
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit question · {question.topic_code}</DialogTitle>
          <DialogDescription>
            Maths goes between dollar signs: <code>$\frac{'{3}{4}'}$</code>, <code>$7 \times 8$</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="flex flex-wrap gap-4">
            <fieldset className="grid gap-1.5">
              <legend className="mb-1.5 text-sm font-medium">Kind</legend>
              <div className="flex gap-2">
                {(['choice', 'numeric'] as const).map((value) => (
                  <Button key={value} type="button" size="sm" variant={kind === value ? 'default' : 'outline'} onClick={() => setKind(value)}>
                    {value === 'choice' ? 'Multiple choice' : 'Number answer'}
                  </Button>
                ))}
              </div>
            </fieldset>
            <fieldset className="grid gap-1.5">
              <legend className="mb-1.5 text-sm font-medium">Difficulty</legend>
              <div className="flex gap-2">
                {QUESTION_DIFFICULTIES.map((value) => (
                  <Button key={value} type="button" size="sm" variant={difficulty === value ? 'default' : 'outline'} onClick={() => setDifficulty(value)}>
                    {QUESTION_DIFFICULTY_LABELS[value]}
                  </Button>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="q-stem">Question</Label>
            <textarea id="q-stem" rows={3} value={stem} onChange={(e) => setStem(e.target.value)} className={TEXTAREA} />
            {errors.stem && <p className="text-destructive text-xs">{errors.stem}</p>}
            <p className="bg-muted/50 rounded-md px-3 py-2 text-sm"><MathText text={stem} /></p>
          </div>

          {kind === 'choice' && (
            <div className="grid gap-2 sm:grid-cols-2">
              {choices.map((choice, index) => (
                <div key={index} className="grid gap-1">
                  <Label htmlFor={`q-choice-${index}`}>Choice {String.fromCharCode(65 + index)}</Label>
                  <Input
                    id={`q-choice-${index}`}
                    value={choice}
                    onChange={(e) => setChoices(choices.map((c, i) => (i === index ? e.target.value : c)))}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-1">
              <Label htmlFor="q-answer">{kind === 'choice' ? 'Answer (the correct choice, exactly)' : 'Answer (a number)'}</Label>
              <Input id="q-answer" value={answer} onChange={(e) => setAnswer(e.target.value)} />
              {errors.answer && <p className="text-destructive text-xs">{errors.answer}</p>}
            </div>
            <div className="grid gap-1">
              <Label htmlFor="q-compute">Calculation behind it (optional)</Label>
              <Input id="q-compute" value={compute} placeholder="3/4*24" onChange={(e) => setCompute(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="q-solution">Worked solution</Label>
            <textarea id="q-solution" rows={3} value={solution} onChange={(e) => setSolution(e.target.value)} className={TEXTAREA} />
            {errors.solution && <p className="text-destructive text-xs">{errors.solution}</p>}
          </div>

          <ul className="grid gap-1 text-xs" aria-label="Code checks" data-testid="edit-checks">
            {problems.length === 0 ? (
              <li className="text-success">The code checks pass.</li>
            ) : (
              problems.map((problem) => (
                <li key={problem} className="text-destructive">
                  {problem}
                </li>
              ))
            )}
          </ul>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
