// Phase 33: a schedule's places, from apps/web/src/features/schedules/schedule-dialog.tsx @ 2933e3f
// (working tree). One in-person place and one online room, each optional, at least one in all
// (`scheduleLocationProblem`, shared).
import type { Assignment, Location } from '@tmi/shared';

export interface ScheduleLocationChoice {
  physicalId: string;
  virtualId: string;
}

/**
 * A new schedule starts at the tutor's own in-person place (else the first in-person one offered,
 * else the first online one), so the common case needs no choice at all -- and the schedule flows
 * written before locations existed still save.
 */
export function defaultScheduleLocations(
  pairing: Pick<Assignment, 'tutor_user_id' | 'locations'>,
): ScheduleLocationChoice {
  const physical =
    pairing.locations.find((l) => l.kind === 'physical' && l.owner_user_id === pairing.tutor_user_id) ??
    pairing.locations.find((l) => l.kind === 'physical') ??
    null;
  return {
    physicalId: physical?.id ?? '',
    virtualId: physical ? '' : (pairing.locations.find((l) => l.kind === 'virtual')?.id ?? ''),
  };
}

/** An existing schedule's own choice. */
export function existingScheduleLocations(locations: readonly Location[]): ScheduleLocationChoice {
  return {
    physicalId: locations.find((l) => l.kind === 'physical')?.id ?? '',
    virtualId: locations.find((l) => l.kind === 'virtual')?.id ?? '',
  };
}

/** The chosen places, from those the pairing offers. */
export function chosenScheduleLocations(
  offered: readonly Location[],
  choice: ScheduleLocationChoice,
): Location[] {
  return offered.filter((l) => l.id === choice.physicalId || l.id === choice.virtualId);
}
