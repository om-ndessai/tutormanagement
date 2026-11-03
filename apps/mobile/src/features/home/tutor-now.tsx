// The tutor's next lesson (Phase 43): the Now card's personal message, then the brief for that lesson.
// Since Phase 66 it sits in Home's "Your teaching" section, fed by the member home's `tutor.now` (one read,
// `GET /api/home`); a finished lesson to record is Next up's (CelebrateCard there), so this shows only
// the next lesson -- and not its card when Next up already shows that lesson (then Next up is that card).
// Under Home's band, which greets already, the card does not greet. No money.
import type { TutorHome } from '@tmi/shared';
import { View } from 'react-native';

import { useOrgClock } from '@/features/dashboard/home-data';
import { useActiveSession } from '@/features/teaching/api';
import { space } from '@/theme/tokens';
import { BriefCards } from './brief-cards';
import { NextCard } from './now-card';

export function TutorNow({ now, hideCard = false }: { now: TutorHome; hideCard?: boolean }) {
  const clock = useOrgClock();
  const active = useActiveSession();
  const running = Boolean(active.data?.data.mine);
  if (!now.next) return null;
  const card =
    hideCard || running ? null : (
      <NextCard
        lesson={now.next}
        brief={now.brief}
        part={now.part_of_day}
        today={clock.day}
        nowMinutes={clock.minutesOfDay}
        greet={false}
      />
    );
  const brief = now.brief ? <BriefCards lesson={now.next} brief={now.brief} today={clock.day} /> : null;
  if (!card && !brief) return null;
  return (
    <View testID="home-now" style={{ gap: space.md }}>
      {card}
      {brief}
    </View>
  );
}
