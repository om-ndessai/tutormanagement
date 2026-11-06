// Phase 75 (JF18, R34): a student's price on their record -- the amount where the reader may see it, "No price set"
// where the office has not set one (per mode when only one is missing), and nothing where it is set but not theirs.
import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render';
import { priceRows, StudentPrices } from './user-rates';

const prices = (inPerson: number | null, virtual: number | null, missing?: ('in_person' | 'virtual')[]) => ({
  charge_rate_in_person_cents: inPerson,
  charge_rate_virtual_cents: virtual,
  ...(missing ? { price_missing: missing } : {}),
});

describe('a student’s price on the record', () => {
  it('names the missing mode, or one line when both are', () => {
    expect(priceRows(prices(9500, null, ['virtual']))).toEqual([
      { mode: 'in_person', cents: 9500 },
      { mode: 'virtual', cents: null },
    ]);
    expect(priceRows(prices(null, null, ['in_person', 'virtual']))).toEqual([{ mode: 'both', cents: null }]);
    // A tutor's view: the prices are blanked (R4) and set -- nothing at all, never "No price set".
    expect(priceRows(prices(null, null, []))).toEqual([]);
    // An older Worker sends no flag: as before, only what is there.
    expect(priceRows(prices(9500, null))).toEqual([{ mode: 'in_person', cents: 9500 }]);
  });

  it('reads "No price set" where it is missing', async () => {
    await renderWithProviders(<StudentPrices student={{ ...prices(9500, null, ['virtual']) } as never} />);
    expect(screen.getByTestId('person-price-in-person')).toHaveTextContent(/\$95\.00 \/ hr/);
    expect(screen.getByTestId('person-price-virtual')).toHaveTextContent(/No price set/);
    await renderWithProviders(<StudentPrices student={{ ...prices(null, null, ['in_person', 'virtual']) } as never} />);
    expect(screen.getByTestId('person-price-missing')).toHaveTextContent(/No price set/);
  });
});
