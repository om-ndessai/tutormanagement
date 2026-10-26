// Phase 55: the buttons shown per `providers`, and the sign-in card's sentence.
import type { AuthProviderInfo } from '@tmi/shared';

import type { ProviderBuild } from '@/lib/provider-sign-in';
import { offersGoogle, signInHow, signInProviders } from './provider-model';

const ALL: AuthProviderInfo[] = [
  { id: 'google', label: 'Google', client_id: 'g.apps' },
  { id: 'microsoft', label: 'Microsoft', client_id: 'ms-client' },
  { id: 'apple', label: 'Apple', client_id: null, services_id: 'com.aimtrue.web' },
  { id: 'facebook', label: 'Facebook', client_id: '1234' },
];
const IOS: ProviderBuild = { platform: 'ios', browser: true, apple: false, facebookAppId: null };
const ids = (list: { id: string }[]) => list.map((p) => p.id);

describe('signInProviders', () => {
  it('offers nothing besides Google from an older Worker (no providers) or a Google-only one', () => {
    expect(signInProviders(undefined, IOS)).toEqual([]);
    expect(signInProviders([], IOS)).toEqual([]);
    expect(signInProviders([ALL[0]!], IOS)).toEqual([]);
  });

  it('offers Microsoft with its client id, through the browser module', () => {
    expect(signInProviders(ALL, IOS)).toEqual([{ id: 'microsoft', label: 'Microsoft', clientId: 'ms-client' }]);
    expect(signInProviders([{ id: 'microsoft', label: 'Microsoft', client_id: null }], IOS)).toEqual([]);
    expect(signInProviders(ALL, { ...IOS, browser: false })).toEqual([]);
  });

  it('offers Facebook only where the build registered that app id’s scheme', () => {
    expect(ids(signInProviders(ALL, { ...IOS, facebookAppId: '1234' }))).toEqual(['microsoft', 'facebook']);
    expect(ids(signInProviders(ALL, { ...IOS, facebookAppId: '9999' }))).toEqual(['microsoft']);
  });

  it('offers Apple on iOS only, with the build’s flag on and the device ready', () => {
    const on = { ...IOS, apple: true };
    expect(ids(signInProviders(ALL, on, true))).toEqual(['microsoft', 'apple']);
    expect(ids(signInProviders(ALL, on, false))).toEqual(['microsoft']);
    expect(ids(signInProviders(ALL, IOS, true))).toEqual(['microsoft']);
    expect(ids(signInProviders(ALL, { ...on, platform: 'android' }, true))).toEqual(['microsoft']);
  });

  it('keeps the server’s order', () => {
    const build = { platform: 'ios', browser: true, apple: true, facebookAppId: '1234' };
    expect(ids(signInProviders(ALL, build, true))).toEqual(['microsoft', 'apple', 'facebook']);
  });
});

describe('offersGoogle and signInHow', () => {
  it('reads no providers as Google alone, and a list without Google as no Google', () => {
    expect(offersGoogle(null)).toBe(true);
    expect(offersGoogle({ providers: [] })).toBe(true);
    expect(offersGoogle({ providers: ALL })).toBe(true);
    expect(offersGoogle({ providers: [ALL[1]!] })).toBe(false);
  });

  it('words the sentence as the web does', () => {
    expect(signInHow(true, [])).toBe('your Google account');
    expect(signInHow(false, [{ label: 'Microsoft' }])).toBe('your Microsoft account');
    expect(signInHow(true, [{ label: 'Microsoft' }, { label: 'Facebook' }])).toBe('Google, Microsoft or Facebook');
  });
});
