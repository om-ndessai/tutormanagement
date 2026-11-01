import { Redirect } from 'expo-router';

/** Phase 60 (S7): the picker is the Spaces screen now; an old link to it lands there. */
export default function SelectOrganizationRoute() {
  return <Redirect href="/spaces" />;
}
