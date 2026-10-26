import {
  businessSummary,
  formFromBusiness,
  validateBusinessForm,
  EMPTY_BUSINESS_FORM,
} from './business-form';

const ROW = {
  id: 'b-1',
  name: 'Lakeside Learning LLC',
  tin: '12-3456789',
  payer_address_line1: '1 Main St',
  payer_address_line2: null,
  payer_city: 'Durham',
  payer_state: 'NC',
  payer_postal_code: '27701',
  archived_at: null,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
  spaces: [
    { id: 's1', slug: 'a', name: 'Space A' },
    { id: 's2', slug: 'b', name: 'Space B' },
  ],
};

describe('the console organization form (Phase 54)', () => {
  it('reads a business into the form, blanks for nulls', () => {
    expect(formFromBusiness(ROW)).toMatchObject({ name: 'Lakeside Learning LLC', payer_address_line2: '' });
    expect(formFromBusiness(null)).toEqual(EMPTY_BUSINESS_FORM);
  });

  it('needs a name, and refuses an SSN for a TIN', () => {
    const empty = validateBusinessForm(EMPTY_BUSINESS_FORM, true);
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.errors.name).toBe('Name is required.');
    const ssn = validateBusinessForm({ ...EMPTY_BUSINESS_FORM, name: 'X', tin: '123-45-6789' }, true);
    expect(ssn.ok).toBe(false);
    if (!ssn.ok) expect(ssn.errors.tin).toBeTruthy();
    expect(validateBusinessForm({ ...EMPTY_BUSINESS_FORM, name: 'X', tin: '12-3456789' }, true).ok).toBe(
      true,
    );
  });

  it('says whether a TIN is on file and which spaces it runs', () => {
    expect(businessSummary(ROW)).toBe('TIN on file · runs Space A, Space B');
    expect(businessSummary({ tin: null, spaces: [] })).toBe('No TIN yet · runs no space');
  });
});
