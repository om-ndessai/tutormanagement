import {
  cancelDateBounds,
  cancelledByText,
  defaultCancelDate,
  formatLessonDay,
  shiftDay,
} from './lesson-cancellation';

const series = { starts_on: '2026-09-01', ends_on: '2026-12-18', day_of_week: 2 };

describe('cancelling one lesson of a series', () => {
  it('lets a parent pick today or later only; the tutor and the office from the series start', () => {
    expect(cancelDateBounds({ ...series, cancel_as: 'parent' }, false, '2026-10-08')).toEqual({
      min: '2026-10-08',
      max: '2026-12-18',
      futureOnly: true,
      hint: 'Tuesdays only, from today on.',
    });
    expect(cancelDateBounds({ ...series, cancel_as: 'tutor' }, false, '2026-10-08')).toMatchObject({
      min: '2026-09-01',
      futureOnly: false,
      hint: 'Tuesdays only.',
    });
    // An admin who is also the parent keeps the office's reach (mayCancelOn).
    expect(cancelDateBounds({ ...series, cancel_as: 'parent' }, true, '2026-10-08').min).toBe('2026-09-01');
    // A series that has not started yet starts the picker at its first day.
    expect(cancelDateBounds({ ...series, cancel_as: 'parent' }, false, '2026-08-01').min).toBe('2026-09-01');
  });

  it('opens the picker on the next lesson, or the last one of a finished series', () => {
    expect(defaultCancelDate(series, '2026-10-08')).toBe('2026-10-13');
    expect(defaultCancelDate(series, '2026-10-13')).toBe('2026-10-13');
    expect(defaultCancelDate(series, '2026-08-01')).toBe('2026-09-01');
    expect(defaultCancelDate(series, '2027-01-05')).toBe('2026-12-15');
  });

  it('says who cancelled, and reads dates as calendar dates', () => {
    expect(cancelledByText('Maria Okafor', 'parent')).toBe('by Maria Okafor (the family)');
    expect(cancelledByText(null, 'admin')).toBe('by the office');
    expect(formatLessonDay('2026-11-24')).toBe('Tue, Nov 24');
    expect(shiftDay('2026-10-08', -28)).toBe('2026-09-10');
    expect(shiftDay('2026-12-30', 7)).toBe('2027-01-06');
  });
});
