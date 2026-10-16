// Developer-only: the production app's welcome screen, which a development build never shows (it
// signs in as a seeded person instead).
//   aimtrue://dev/welcome  -- full-screen modal; the button does nothing. Absent from production
//   (DEV_TOOLS).
import { Redirect } from 'expo-router';

import { Screen } from '@/components/screen';
import { Welcome } from '@/features/auth/welcome';
import { DEV_TOOLS } from '@/lib/variant';

export default function DevWelcome() {
  if (!DEV_TOOLS) return <Redirect href="/" />;
  return (
    <Screen testID="screen-dev-welcome" edges={['top', 'bottom']} scroll={false}>
      <Welcome busy={false} onSignIn={() => undefined} />
    </Screen>
  );
}
