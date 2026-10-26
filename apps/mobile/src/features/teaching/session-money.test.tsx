// SessionMoney, as the exposure flows rely on it (R1-R3): each money_view shows its own side's
// figure under its own label and never the other side's; 'none' renders nothing at all.
import { formatCents } from '@tmi/shared';
import { screen } from '@testing-library/react-native';

import { session } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { SessionMoney, describeSessionMoney } from './session-money';

// The fixture: tutor 6500/hr -> 9750; family 9000/hr -> 13500.
const TUTOR = formatCents(9750);
const FAMILY = formatCents(13500);

describe('SessionMoney by side', () => {
  it('gives a tutor their pay, labelled "Your pay", and never the price', async () => {
    await renderWithProviders(<SessionMoney session={session({ money_view: 'tutor' })} />);
    expect(screen.getByText('Your pay')).toBeTruthy();
    expect(screen.getByText(TUTOR)).toBeTruthy();
    expect(screen.queryByText('You pay')).toBeNull();
    expect(screen.queryByText(FAMILY)).toBeNull();
    expect(screen.queryByText(/Tutor \$/)).toBeNull();
  });

  it('gives a family the price, labelled "You pay", and never the pay', async () => {
    await renderWithProviders(<SessionMoney session={session({ money_view: 'family' })} />);
    expect(screen.getByText('You pay')).toBeTruthy();
    expect(screen.getByText(FAMILY)).toBeTruthy();
    expect(screen.queryByText('Your pay')).toBeNull();
    expect(screen.queryByText(TUTOR)).toBeNull();
    expect(screen.queryByText(/Tutor \$/)).toBeNull();
  });

  it('gives the office the charge and its split, never a personal label', async () => {
    await renderWithProviders(<SessionMoney session={session({ money_view: 'admin' })} />);
    expect(screen.getByText('Charged')).toBeTruthy();
    expect(screen.getByText(FAMILY)).toBeTruthy();
    expect(screen.getByText(new RegExp(`Tutor \\${TUTOR}`))).toBeTruthy();
    expect(screen.queryByText('Your pay')).toBeNull();
    expect(screen.queryByText('You pay')).toBeNull();
  });

  it('renders nothing for a reader on neither side', async () => {
    await renderWithProviders(<SessionMoney session={session({ money_view: 'none' })} />);
    expect(screen.queryByTestId('session-money')).toBeNull();
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it('the compact form keeps the same sides', async () => {
    await renderWithProviders(<SessionMoney compact session={session({ money_view: 'tutor' })} />);
    expect(screen.getByText('Your pay')).toBeTruthy();
    expect(screen.queryByText(FAMILY)).toBeNull();
  });

  it('a deletion sentence names only the reader side', () => {
    expect(describeSessionMoney(session({ money_view: 'tutor' }))).toBe(`your ${TUTOR} pay for it`);
    expect(describeSessionMoney(session({ money_view: 'family' }))).toBe(`its ${FAMILY} charge`);
    expect(describeSessionMoney(session({ money_view: 'none' }))).toBe('its record');
  });
});

describe('SessionMoney on a lesson paid directly (Phase 54)', () => {
  // One price, the same on both sides: what the family pays the tutor.
  const direct = (view: 'admin' | 'tutor' | 'family') =>
    session({
      money_view: view,
      paid_directly: true,
      tutor_rate_cents: 6000,
      charge_rate_cents: 6000,
      tutor_amount_cents: view === 'family' ? null : 6000,
      charge_amount_cents: view === 'tutor' ? null : 6000,
    });

  it('tells the tutor the family pays them', async () => {
    await renderWithProviders(<SessionMoney session={direct('tutor')} />);
    expect(screen.getByText('Family pays you')).toBeTruthy();
    expect(screen.queryByText('Your pay')).toBeNull();
  });

  it('tells the family they pay the tutor', async () => {
    await renderWithProviders(<SessionMoney session={direct('family')} />);
    expect(screen.getByText('You pay the tutor')).toBeTruthy();
  });

  it('shows the office no cut, in either layout', async () => {
    await renderWithProviders(<SessionMoney session={direct('admin')} />);
    expect(screen.getByText('Paid to the tutor')).toBeTruthy();
    expect(screen.queryByText(/Tutor \$/)).toBeNull();
    await renderWithProviders(<SessionMoney session={direct('admin')} compact />);
    expect(screen.queryByText(/^\$[0-9.,]+ to /)).toBeNull();
    expect(describeSessionMoney(direct('admin'))).toBe(`its ${formatCents(6000)} price`);
  });
});
