// Ported from apps/web/src/features/onboarding/tutor-flow.tsx @ 1132322.
//
// Adding a tutor (Phase 26): who they are, then their tax details and how they are paid, then their
// students. Since UI upgrades U3 the first step is the Add a tutor flow (`/onboarding/add-tutor`, in
// the wizard's own stack: basics, background, teaching, availability and pay); the second is the person form scoped to the tax fields
// and payment handles (`sections`) -- the record is saved whole, so it never clears the rest.
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Button } from 'react-native-paper';

import { Screen } from '@/components/screen';
import { FlowSteps, StepPanel, StepText } from './flow-steps';
import { backToStart, useAwaitedSheet } from './student-flow';
import { useWizardFrame } from './wizard-layout';
import { WizardHeading } from './wizard-screens';

type Step = 'tutor' | 'financials' | 'pairing' | 'done';

const STEPS: { key: Step; label: string }[] = [
  { key: 'tutor', label: 'Tutor' },
  { key: 'financials', label: 'Tax and payment' },
  { key: 'pairing', label: 'Students' },
];

export function TutorFlow() {
  const { leaveFor } = useWizardFrame();
  const openSheet = useAwaitedSheet();

  const [step, setStep] = useState<Step>('tutor');
  const [done, setDone] = useState(new Set<string>());
  const [tutor, setTutor] = useState<{ id: string; name: string } | null>(null);

  function complete(key: Step, next: Step) {
    setDone((previous) => new Set(previous).add(key));
    setStep(next);
  }

  function restart() {
    setStep('tutor');
    setDone(new Set());
    setTutor(null);
  }

  const skip = (next: Step) => (
    <Button testID="tutor-flow-skip" mode="text" onPress={() => setStep(next)}>
      Skip
    </Button>
  );

  return (
    <Screen testID="screen-onboarding-tutor" edges={['bottom']}>
      <Stack.Screen options={{ title: 'Add a tutor' }} />
      <WizardHeading
        title="Add a tutor"
        description="Who they are, how they are paid, when they can teach, and their students."
      />
      <FlowSteps steps={STEPS} current={step} done={done} />

      {step === 'tutor' ? (
        <StepPanel
          testID="tutor-flow-tutor"
          title="Who they are"
          actions={
            <>
              <Button
                testID="tutor-flow-add-tutor"
                mode="contained"
                icon="plus"
                onPress={() =>
                  openSheet(
                    '/onboarding/add-tutor',
                    'person',
                    (id, name) => {
                      setTutor({ id, name });
                      complete('tutor', 'financials');
                    },
                  )
                }
              >
                Add the tutor
              </Button>
              {skip('done')}
            </>
          }
        >
          <StepText>
            Their name and the Google address they sign in with, their background, when they can teach, and
            what they are paid per hour.
          </StepText>
        </StepPanel>
      ) : null}

      {step === 'financials' && tutor ? (
        <StepPanel
          testID="tutor-flow-financials"
          title={`Tax and payment for ${tutor.name}`}
          actions={
            <>
              <Button
                testID="tutor-flow-set-financials"
                mode="contained"
                onPress={() =>
                  openSheet(
                    {
                      pathname: '/person-form',
                      params: { id: tutor.id, sections: 'tutor-tax,payment-handles' },
                    },
                    'person',
                    () => complete('financials', 'pairing'),
                  )
                }
              >
                Set up tax and payment
              </Button>
              {skip('pairing')}
            </>
          }
        >
          <StepText>
            Their mailing address for the 1099, whether the office holds their SSN — a tick, never the
            number — and how they are paid (Zelle, Venmo).
          </StepText>
        </StepPanel>
      ) : null}

      {step === 'pairing' && tutor ? (
        <StepPanel
          testID="tutor-flow-pairing"
          title={`Students for ${tutor.name}`}
          actions={
            <>
              <Button
                testID="tutor-flow-pair"
                mode="contained"
                onPress={() =>
                  openSheet({ pathname: '/assignment-form', params: { tutor: tutor.id } }, 'assignment', () =>
                    complete('pairing', 'done'),
                  )
                }
              >
                Pair with a student
              </Button>
              {skip('done')}
            </>
          }
        >
          <StepText>
            Which student they teach, and at what rate. Pair more from Pairings at any time.
          </StepText>
        </StepPanel>
      ) : null}

      {step === 'done' ? (
        <StepPanel
          testID="tutor-flow-done"
          title={tutor ? `${tutor.name} is set up` : 'Nothing added yet'}
          actions={
            <>
              <Button testID="tutor-flow-pairings" mode="outlined" onPress={() => leaveFor('/pairings')}>
                Go to Pairings
              </Button>
              <Button testID="tutor-flow-users" mode="outlined" onPress={() => leaveFor('/people')}>
                Go to Users
              </Button>
              <Button testID="tutor-flow-again" mode="outlined" onPress={restart}>
                Add another tutor
              </Button>
              <Button testID="onboarding-back-start" mode="text" onPress={backToStart}>
                Back to the start
              </Button>
            </>
          }
        >
          <StepText>
            {tutor
              ? 'Anything you skipped can be finished from their record on the Users page.'
              : 'You can add a tutor from Users at any time.'}
          </StepText>
        </StepPanel>
      ) : null}
    </Screen>
  );
}
