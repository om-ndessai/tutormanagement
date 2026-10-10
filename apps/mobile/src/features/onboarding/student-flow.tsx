// Ported from apps/web/src/features/onboarding/student-flow.tsx @ 1132322.
//
// Adding a student, in the order that works (Phase 26): the family first -- a student cannot exist
// without a parent on file -- then the student, their assessment, their plan, and a tutor. Every
// step opens the app's own form sheet as a route, preset; nothing here is a second copy of a form.
// The sheets say what they saved (`form-bridge`), which moves the flow on. Any step may be
// skipped, and whatever was already added stays.
import { router, Stack, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Button } from 'react-native-paper';

import { OptionPicker } from '@/components/option-picker';
import { Screen } from '@/components/screen';
import { useUsers } from '@/features/users/api';
import { onFormSaved, type SavedForm } from '@/lib/form-bridge';
import { FlowSteps, StepPanel, StepText } from './flow-steps';
import { useWizardFrame } from './wizard-layout';
import { WizardHeading } from './wizard-screens';

type Step = 'family' | 'student' | 'assessment' | 'plan' | 'pairing' | 'done';

const STEPS: { key: Step; label: string }[] = [
  { key: 'family', label: 'Family' },
  { key: 'student', label: 'Student' },
  { key: 'assessment', label: 'Assessment' },
  { key: 'plan', label: 'Learning plan' },
  { key: 'pairing', label: 'Tutor' },
];

interface Person {
  id: string;
  name: string;
}

/** Back to the wizard's welcome, beneath this screen. */
export function backToStart() {
  if (router.canGoBack()) router.back();
  else router.replace('/onboarding');
}

/**
 * Which sheet the flow is waiting on, and what to do when it saves. A sheet closed without saving
 * says nothing, and the step stays where it was.
 */
export function useAwaitedSheet() {
  const awaiting = useRef<{ form: SavedForm; then: (id: string, name: string) => void } | null>(null);
  useEffect(
    () =>
      onFormSaved((event) => {
        const pending = awaiting.current;
        if (!pending || pending.form !== event.form) return;
        awaiting.current = null;
        pending.then(event.id, event.name ?? '');
      }),
    [],
  );
  return (href: Href, form: SavedForm, then: (id: string, name: string) => void) => {
    awaiting.current = { form, then };
    router.push(href);
  };
}

export function StudentFlow() {
  const { leaveFor } = useWizardFrame();
  const openSheet = useAwaitedSheet();

  const [step, setStep] = useState<Step>('family');
  const [done, setDone] = useState(new Set<string>());
  const [parent, setParent] = useState<Person | null>(null);
  const [chosenParent, setChosenParent] = useState('');
  const [student, setStudent] = useState<Person | null>(null);

  const parents = useUsers({ role: 'parent', limit: 100, sort: 'full_name' });

  function complete(key: Step, next: Step) {
    setDone((previous) => new Set(previous).add(key));
    setStep(next);
  }

  function restart() {
    setStep('family');
    setDone(new Set());
    setParent(null);
    setChosenParent('');
    setStudent(null);
  }

  const skip = (next: Step) => (
    <Button testID="student-flow-skip" mode="text" onPress={() => setStep(next)}>
      Skip
    </Button>
  );

  return (
    <Screen testID="screen-onboarding-student" edges={['bottom']}>
      <Stack.Screen options={{ title: 'Add a student' }} />
      <WizardHeading
        title="Add a student"
        description="The family first, then the student, their assessment, their plan and a tutor."
      />
      <FlowSteps steps={STEPS} current={step} done={done} />

      {step === 'family' ? (
        // The web's order, but the button to create the family leads: on a phone the open list of
        // existing parents would otherwise push it below the fold.
        <StepPanel testID="student-flow-family" title="First, the family" actions={skip('done')}>
          <StepText>
            Every student needs a parent or guardian on file, who is billed and kept informed. Choose an
            existing family, or create their account.
          </StepText>
          <Button
            testID="student-flow-create-parent"
            mode="contained"
            icon="plus"
            onPress={() =>
              openSheet(
                {
                  pathname: '/person-form',
                  params: { preset: 'parent', sections: 'identity,payment-handles' },
                },
                'person',
                (id, name) => {
                  setParent({ id, name });
                  complete('family', 'student');
                },
              )
            }
          >
            Create a family account
          </Button>
          <OptionPicker
            testID="student-flow-parent"
            label="An existing parent"
            placeholder="Choose a parent"
            searchPlaceholder="Search parents"
            options={(parents.data?.data ?? []).map((candidate) => ({
              id: candidate.id,
              label: candidate.full_name,
            }))}
            value={chosenParent}
            onChange={setChosenParent}
          />
          <Button
            testID="student-flow-use-parent"
            mode="outlined"
            disabled={!chosenParent}
            onPress={() => {
              const found = parents.data?.data.find((candidate) => candidate.id === chosenParent);
              if (!found) return;
              setParent({ id: found.id, name: found.full_name });
              complete('family', 'student');
            }}
          >
            Use this family
          </Button>
        </StepPanel>
      ) : null}

      {step === 'student' && parent ? (
        <StepPanel
          testID="student-flow-student"
          title="Now the student"
          actions={
            <>
              <Button
                testID="student-flow-add-student"
                mode="contained"
                icon="plus"
                onPress={() =>
                  openSheet(
                    {
                      pathname: '/person-form',
                      params: {
                        preset: 'student',
                        guardian: parent.id,
                        sections: 'identity,student,guardians,availability',
                      },
                    },
                    'person',
                    (id, name) => {
                      setStudent({ id, name });
                      complete('student', 'assessment');
                    },
                  )
                }
              >
                Add the student
              </Button>
              {skip('done')}
            </>
          }
        >
          <StepText>
            Linked to {parent.name}. Their school, course, goal for the year and what the family is charged
            per hour. A child with no email of their own needs none.
          </StepText>
        </StepPanel>
      ) : null}

      {step === 'assessment' && student ? (
        <StepPanel
          testID="student-flow-assessment"
          title={`Where ${student.name} stands`}
          actions={
            <>
              <Button
                testID="student-flow-assess"
                mode="contained"
                onPress={() =>
                  openSheet(
                    { pathname: '/assessment-form', params: { student: student.id } },
                    'assessment',
                    () => complete('assessment', 'plan'),
                  )
                }
              >
                Record the assessment
              </Button>
              {skip('plan')}
            </>
          }
        >
          <StepText>
            The initial assessment: a write-up, the level you recommend, and a 1–5 score on any topic you
            checked. The learning plan starts from it.
          </StepText>
        </StepPanel>
      ) : null}

      {step === 'plan' && student ? (
        <StepPanel
          testID="student-flow-plan-step"
          title={`${student.name}’s learning plan`}
          actions={
            <>
              <Button
                testID="student-flow-plan"
                mode="contained"
                onPress={() =>
                  openSheet({ pathname: '/plan-form', params: { student: student.id } }, 'plan', () =>
                    complete('plan', 'pairing'),
                  )
                }
              >
                Set the learning plan
              </Button>
              {skip('pairing')}
            </>
          }
        >
          <StepText>
            The goal and its date, the topics that lead there, and how often to meet. Progress is tracked
            against it lesson by lesson.
          </StepText>
        </StepPanel>
      ) : null}

      {step === 'pairing' && student ? (
        <StepPanel
          testID="student-flow-pairing"
          title={`A tutor for ${student.name}`}
          actions={
            <>
              <Button
                testID="student-flow-pair"
                mode="contained"
                onPress={() =>
                  openSheet(
                    { pathname: '/assignment-form', params: { student: student.id } },
                    'assignment',
                    () => complete('pairing', 'done'),
                  )
                }
              >
                Pair with a tutor
              </Button>
              {skip('done')}
            </>
          }
        >
          <StepText>
            Which tutor teaches them, and at what rate. Lessons can be recorded once they are paired.
          </StepText>
        </StepPanel>
      ) : null}

      {step === 'done' ? (
        <StepPanel
          testID="student-flow-done"
          title={student ? `${student.name} is set up` : 'Nothing added yet'}
          actions={
            <>
              {student ? (
                <Button
                  testID="student-flow-open-progress"
                  mode="outlined"
                  onPress={() => leaveFor(`/progress/${student.id}`)}
                >
                  Open their progress
                </Button>
              ) : null}
              <Button testID="student-flow-users" mode="outlined" onPress={() => leaveFor('/people')}>
                Go to Users
              </Button>
              <Button testID="student-flow-again" mode="outlined" onPress={restart}>
                Add another student
              </Button>
              <Button testID="onboarding-back-start" mode="text" onPress={backToStart}>
                Back to the start
              </Button>
            </>
          }
        >
          <StepText>
            {student
              ? 'Anything you skipped can be done from their record, their progress page or Pairings.'
              : 'You can add a family and a student from Users at any time.'}
          </StepText>
        </StepPanel>
      ) : null}
    </Screen>
  );
}
