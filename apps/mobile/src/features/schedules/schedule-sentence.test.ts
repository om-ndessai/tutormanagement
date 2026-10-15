import { placesPhrase, scheduleSentence, shortDate } from './schedule-sentence';

const ROOM = { kind: 'physical', name: 'Institute, room 2' } as const;
const ONLINE = { kind: 'virtual', name: 'Online room' } as const;

const base = {
  dayOfWeek: 1,
  startTime: '16:00',
  durationMinutes: 60,
  mode: 'in_person',
  places: [ROOM],
  startsOn: '2026-10-19',
  endsOn: null,
  today: '2026-10-15',
} as const;

describe('scheduleSentence', () => {
  it('says the lesson as the spec’s example', () => {
    expect(scheduleSentence(base)).toBe('Every Monday, 4:00–5:00 PM, at Institute, room 2, starting Oct 19.');
  });

  it('names the first lesson, not the date the series may start from', () => {
    // Thursday the 15th: the first Monday on or after it is the 19th.
    expect(scheduleSentence({ ...base, startsOn: '2026-10-15' })).toContain('starting Oct 19.');
  });

  it('adds the end, and the year of a date in another year', () => {
    expect(scheduleSentence({ ...base, endsOn: '2027-03-01' })).toBe(
      'Every Monday, 4:00–5:00 PM, at Institute, room 2, starting Oct 19, until Mar 1, 2027.',
    );
    expect(scheduleSentence({ ...base, startsOn: '2027-01-01', today: '2026-12-20' })).toContain(
      'starting Jan 4, 2027.',
    );
  });

  it('says a range across midday with both periods', () => {
    expect(scheduleSentence({ ...base, startTime: '11:30', durationMinutes: 90 })).toContain(
      '11:30 AM – 1:00 PM',
    );
  });

  it('says an online lesson, and leads with the usual place when there are two', () => {
    expect(scheduleSentence({ ...base, mode: 'virtual', places: [ONLINE] })).toBe(
      'Every Monday, 4:00–5:00 PM, online in Online room, starting Oct 19.',
    );
    expect(placesPhrase([ONLINE, ROOM], 'in_person')).toBe('at Institute, room 2, or online in Online room');
    expect(placesPhrase([ROOM, ONLINE], 'virtual')).toBe('online in Online room, or at Institute, room 2');
  });

  it('leaves the place out when none is chosen yet', () => {
    expect(scheduleSentence({ ...base, places: [] })).toBe('Every Monday, 4:00–5:00 PM, starting Oct 19.');
  });

  it('formats a calendar date without reading the device’s zone', () => {
    expect(shortDate('2026-01-01', '2026')).toBe('Jan 1');
    expect(shortDate('2026-12-31', '2027')).toBe('Dec 31, 2026');
  });
});
