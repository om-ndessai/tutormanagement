import type { Location } from '@tmi/shared';

import {
  chosenScheduleLocations,
  defaultScheduleLocations,
  existingScheduleLocations,
} from './schedule-locations';

function place(id: string, kind: Location['kind'], owner: string): Location {
  return {
    id,
    owner_user_id: owner,
    owner_name: owner,
    name: id,
    kind,
    address: null,
    reminder_minutes: 0,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
  };
}

const studentHome = place('home', 'physical', 'student-1');
const tutorRoom = place('room', 'physical', 'tutor-1');
const tutorOnline = place('online', 'virtual', 'tutor-1');

describe('defaultScheduleLocations', () => {
  it('starts a new schedule at the tutor’s own in-person place', () => {
    expect(
      defaultScheduleLocations({
        tutor_user_id: 'tutor-1',
        locations: [studentHome, tutorOnline, tutorRoom],
      }),
    ).toEqual({ physicalId: 'room', virtualId: '' });
  });

  it('falls back to the first in-person place, then to the first online one', () => {
    expect(
      defaultScheduleLocations({ tutor_user_id: 'tutor-1', locations: [tutorOnline, studentHome] }),
    ).toEqual({
      physicalId: 'home',
      virtualId: '',
    });
    expect(defaultScheduleLocations({ tutor_user_id: 'tutor-1', locations: [tutorOnline] })).toEqual({
      physicalId: '',
      virtualId: 'online',
    });
    expect(defaultScheduleLocations({ tutor_user_id: 'tutor-1', locations: [] })).toEqual({
      physicalId: '',
      virtualId: '',
    });
  });
});

describe('existing and chosen', () => {
  it('keeps an existing schedule’s own places', () => {
    expect(existingScheduleLocations([tutorOnline, studentHome])).toEqual({
      physicalId: 'home',
      virtualId: 'online',
    });
  });

  it('takes only places the pairing offers', () => {
    const offered = [tutorRoom, tutorOnline, studentHome];
    expect(
      chosenScheduleLocations(offered, { physicalId: 'room', virtualId: 'online' }).map((l) => l.id),
    ).toEqual(['room', 'online']);
    expect(chosenScheduleLocations(offered, { physicalId: 'gone', virtualId: '' })).toEqual([]);
  });
});
