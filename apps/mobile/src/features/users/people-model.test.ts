import {
  canActOn,
  confirmsName,
  initials,
  seesTutorPay,
  SORT_OPTIONS,
  sortLabel,
  telUrl,
} from './people-model';

it('takes the initials of the first two names', () => {
  expect(initials('Sofia Okafor')).toBe('SO');
  expect(initials('  ana  maria lopez ')).toBe('AM');
  expect(initials('Cher')).toBe('C');
});

it('labels every sort choice, and falls back for an unknown pair', () => {
  for (const option of SORT_OPTIONS) expect(sortLabel(option.sort, option.order)).toBe(option.label);
  expect(sortLabel('email', 'desc')).toBe('Sort');
});

it('shows a tutor their own pay and the office anyone’s, nobody else', () => {
  expect(seesTutorPay({ id: 'a', roles: ['admin'] }, 'b')).toBe(true);
  expect(seesTutorPay({ id: 'b', roles: ['tutor'] }, 'b')).toBe(true);
  expect(seesTutorPay({ id: 'c', roles: ['tutor', 'parent'] }, 'b')).toBe(false);
  expect(seesTutorPay(null, 'b')).toBe(false);
});

it('lets only an admin act, and never on their own account', () => {
  expect(canActOn({ id: 'a', roles: ['admin'] }, { id: 'b' })).toBe(true);
  expect(canActOn({ id: 'a', roles: ['admin', 'tutor'] }, { id: 'a' })).toBe(false);
  expect(canActOn({ id: 'c', roles: ['tutor'] }, { id: 'b' })).toBe(false);
});

it('dials the digits of a phone number, and nothing without one', () => {
  expect(telUrl('(919) 555-0155')).toBe('tel:9195550155');
  expect(telUrl('+44 20 7946 0958')).toBe('tel:+442079460958');
  expect(telUrl(null)).toBeNull();
  expect(telUrl('()')).toBeNull();
});

it('confirms a permanent delete only with the name typed', () => {
  expect(confirmsName('jade xu ', 'Jade Xu')).toBe(true);
  expect(confirmsName('Jade', 'Jade Xu')).toBe(false);
  expect(confirmsName('', '')).toBe(false);
});
