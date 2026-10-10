// The welcome wizard's frame: the web's Dialog, as a full-screen modal with its own stack (welcome,
// then a guided setup, confirm details or done), so the app's own form sheets can open over it.
import { router, Stack, useNavigation, type Href } from 'expo-router';
import { createContext, use, useEffect, useMemo, type ReactNode } from 'react';
import { IconButton } from 'react-native-paper';

import { useStackOptions } from '@/features/shell/stack-options';
import { useOnboarding } from './onboarding-provider';

interface WizardFrame {
  /** Closes the wizard: the person has been through it (recorded the first time). */
  close: () => void;
  /** Closes the wizard and opens a page, to carry on there. */
  leaveFor: (href: Href) => void;
}

const WizardFrameContext = createContext<WizardFrame | null>(null);

export function useWizardFrame(): WizardFrame {
  const frame = use(WizardFrameContext);
  if (!frame) throw new Error('useWizardFrame must be used inside the wizard.');
  return frame;
}

export function WizardLayout({ children }: { children?: ReactNode }) {
  // The (org) stack's navigation: going back from it closes the whole wizard.
  const navigation = useNavigation();
  const { wizardClosed } = useOnboarding();
  const options = useStackOptions({ large: false });

  // However it closes -- the close button, a finished step, Android's back -- it counts.
  useEffect(() => () => wizardClosed(), [wizardClosed]);

  const frame = useMemo<WizardFrame>(
    () => ({
      close: () => navigation.goBack(),
      leaveFor: (href) => {
        navigation.goBack();
        router.navigate(href);
      },
    }),
    [navigation],
  );

  return (
    <WizardFrameContext value={frame}>
      <Stack
        screenOptions={{
          ...options,
          headerRight: () => (
            <IconButton
              testID="onboarding-close"
              icon="close"
              accessibilityLabel="Close"
              onPress={frame.close}
              style={{ margin: 0 }}
            />
          ),
        }}
      >
        {children}
      </Stack>
    </WizardFrameContext>
  );
}
