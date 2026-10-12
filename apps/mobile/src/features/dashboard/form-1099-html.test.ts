import { buildForm1099Html, escapeHtml, formatPayerAddress, normaliseSsn } from './form-1099-html';

const SSN = '123-45-6789';

function build(overrides: Partial<Parameters<typeof buildForm1099Html>[0]> = {}) {
  return buildForm1099Html({
    payerName: 'Example Tutoring',
    payerTin: '47-2019388',
    payerAddress: '100 Franklin Street\nAnytown, NC 27514',
    tutorName: 'Alex Chen',
    address: '88 Kildaire Farm Road\nApt 12\nCary, NC 27513',
    year: 2026,
    amountCents: 36000,
    ssn: SSN,
    ...overrides,
  });
}

describe('normaliseSsn', () => {
  it('formats nine digits however they were typed', () => {
    expect(normaliseSsn('123456789')).toBe(SSN);
    expect(normaliseSsn('123-45-6789')).toBe(SSN);
    expect(normaliseSsn(' 123 45 6789 ')).toBe(SSN);
  });

  it('refuses anything but nine digits', () => {
    expect(normaliseSsn('12345678')).toBeNull();
    expect(normaliseSsn('1234567890')).toBeNull();
    expect(normaliseSsn('')).toBeNull();
  });
});

describe('the 1099-NEC page', () => {
  it('fills the payer, recipient, amount and the number', () => {
    const html = build();
    expect(html).toContain('Example Tutoring<br>100 Franklin Street<br>Anytown, NC 27514<br>TIN 47-2019388');
    expect(html).toContain('Alex Chen<br>88 Kildaire Farm Road<br>Apt 12<br>Cary, NC 27513');
    expect(html).toContain('$360.00');
    expect(html).toContain('Tax year 2026');
  });

  it('carries the SSN exactly once, in the recipient TIN cell, and not in its title', () => {
    const html = build();
    expect(html.split(SSN)).toHaveLength(2);
    expect(html).toContain(`<tr><th>Recipient’s TIN</th><td>${SSN}</td></tr>`);
    const title = /<title>(.*)<\/title>/.exec(html)?.[1];
    expect(title).toBe('Form 1099-NEC');
  });

  it('escapes every typed and recorded field', () => {
    const html = build({
      payerName: 'A & B <Tutors>',
      payerTin: '"><script>alert(1)</script>',
      payerAddress: "1 O'Hare <Way>",
      tutorName: '<img src=x onerror=alert(1)>',
      address: '<b>bold</b>\nline "two"',
    });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>');
    expect(html).toContain('A &amp; B &lt;Tutors&gt;');
    expect(html).toContain('&quot;&gt;&lt;script&gt;');
    expect(html).toContain('1 O&#39;Hare &lt;Way&gt;');
    expect(html).toContain('&lt;b&gt;bold&lt;/b&gt;<br>line &quot;two&quot;');
  });

  it('leaves out an empty address or TIN', () => {
    const html = build({ payerTin: ' ', payerAddress: '', address: '' });
    expect(html).toContain('<tr><th>Payer</th><td>Example Tutoring</td></tr>');
    expect(html).toContain('<tr><th>Recipient</th><td>Alex Chen</td></tr>');
  });

  it('formats the payer address from the organization settings', () => {
    expect(
      formatPayerAddress({
        payer_address_line1: '100 Franklin Street',
        payer_address_line2: null,
        payer_city: 'Anytown',
        payer_state: 'NC',
        payer_postal_code: '27514',
      }),
    ).toBe('100 Franklin Street\nAnytown, NC 27514');
    expect(formatPayerAddress(null)).toBeNull();
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
  });
});
