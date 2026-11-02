// Phase 63 (P10, P13): where guest play goes. The guest screens sit outside both sign-in guards (the
// root layout), so signing up over them never unmounts them; these say where to go from them.
import { router } from 'expo-router';

/** The sign-up sheet, over whatever is on screen (a quest stays where it was beneath it). */
export function openSignupSheet() {
  router.push('/sign-up-sheet');
}

/**
 * Into the app as usual -- the person's space. Down to the first screen (the Play home, which sends a
 * signed-in person on through the landing rule), or straight there when the quest is the only screen.
 */
export function toSpace() {
  if (router.canDismiss()) router.dismissAll();
  else router.replace('/');
}

/** A guest's Exit: back to the Play home (beneath, or in place of this screen); signed in, their space. */
export function exitGuestPlay(signedIn: boolean) {
  if (signedIn) toSpace();
  else if (router.canGoBack()) router.back();
  else router.replace('/play');
}
