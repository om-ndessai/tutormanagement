import { filterRows, matches, personHref } from './search-model';

describe('search model', () => {
  it('matches when every word typed appears, ignoring case', () => {
    expect(matches('Billing payments money balances 1099 tax', 'bill')).toBe(true);
    expect(matches('Billing payments money balances 1099 tax', 'MONEY tax')).toBe(true);
    expect(matches('Billing payments money balances 1099 tax', 'money lessons')).toBe(false);
    expect(matches('switch organization Riverside Tutoring', 'switch river')).toBe(true);
    expect(matches('anything', '  ')).toBe(true);
  });

  it('filters rows on their value strings', () => {
    const rows = [{ value: 'Sessions lessons record' }, { value: 'Billing money' }];
    expect(filterRows(rows, 'money')).toEqual([{ value: 'Billing money' }]);
    expect(filterRows(rows, '')).toHaveLength(2);
  });

  it('opens a student’s progress for a non-admin, and the person otherwise', () => {
    const sofia = { id: 's1', roles: ['student' as const] };
    const maria = { id: 'm1', roles: ['tutor' as const, 'parent' as const] };
    expect(personHref(sofia, false)).toEqual({
      pathname: '/progress/[studentId]',
      params: { studentId: 's1' },
    });
    expect(personHref(sofia, true)).toEqual({ pathname: '/people/[id]', params: { id: 's1' } });
    expect(personHref(maria, false)).toEqual({ pathname: '/people/[id]', params: { id: 'm1' } });
  });
});
