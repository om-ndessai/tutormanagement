import { test, expect } from '@playwright/test';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWK } from 'jose';

import { MICROSOFT_CONSUMER_TENANT, verifyMicrosoftIdToken } from '../../apps/api/src/lib/microsoft.js';
import { verifyAppleIdToken, verifyAppleNotification } from '../../apps/api/src/lib/apple.js';
import { verifyFacebookAccessToken, verifyFacebookLimitedToken } from '../../apps/api/src/lib/facebook.js';

/**
 * Phase 55: each provider's verifier against signed test tokens -- a local key
 * pair standing in for the provider's published keys. No browser, no Worker,
 * no network: these are unit tests run by Playwright's runner.
 */
async function keys() {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'test', alg: 'RS256' } as JWK;
  return { privateKey, jwks: createLocalJWKSet({ keys: [jwk] }) };
}

function token(privateKey: CryptoKey, claims: Record<string, unknown>, { issuer, audience }: { issuer: string; audience: string }) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'test' })
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
}

const CLIENT = '11111111-2222-3333-4444-555555555555';
const WORK_TENANT = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

test.describe('sign-in verifiers', () => {
  test('Microsoft: the person is tid:oid, and only a personal or domain-verified address is believed', async () => {
    const { privateKey, jwks } = await keys();
    const ms = (tid: string, claims: Record<string, unknown>, issuerTid = tid) =>
      token(privateKey, { tid, oid: 'oid-1', ...claims }, { issuer: `https://login.microsoftonline.com/${issuerTid}/v2.0`, audience: CLIENT });

    const personal = await verifyMicrosoftIdToken(await ms(MICROSOFT_CONSUMER_TENANT, { email: 'Pat@Outlook.com', name: 'Pat' }), CLIENT, { keys: jwks });
    expect(personal).toMatchObject({ provider: 'microsoft', subject: `${MICROSOFT_CONSUMER_TENANT}:oid-1`, email: 'pat@outlook.com', emailVerified: true });

    // A work tenant's admins can set any address: believed only with xms_edov.
    const work = await verifyMicrosoftIdToken(await ms(WORK_TENANT, { email: 'ceo@bigco.com' }), CLIENT, { keys: jwks });
    expect(work.emailVerified).toBe(false);
    const owned = await verifyMicrosoftIdToken(await ms(WORK_TENANT, { email: 'ceo@bigco.com', xms_edov: true }), CLIENT, { keys: jwks });
    expect(owned.emailVerified).toBe(true);

    // An issuer naming a different tenant than the token's own is refused.
    await expect(verifyMicrosoftIdToken(await ms(WORK_TENANT, {}, MICROSOFT_CONSUMER_TENANT), CLIENT, { keys: jwks })).rejects.toThrow();
    // Another app's token is refused.
    await expect(verifyMicrosoftIdToken(await ms(MICROSOFT_CONSUMER_TENANT, {}), 'someone-else', { keys: jwks })).rejects.toThrow();
    // The nonce of the web flow must match.
    await expect(
      verifyMicrosoftIdToken(await ms(MICROSOFT_CONSUMER_TENANT, { nonce: 'a' }), CLIENT, { keys: jwks, nonce: 'b' }),
    ).rejects.toThrow();
  });

  test('Apple: either audience, a relay address deliverable but never vouched for a match, the name from the client', async () => {
    const { privateKey, jwks } = await keys();
    const apple = (claims: Record<string, unknown>, audience = 'app.aimtrue.web') =>
      token(privateKey, { sub: 'apple-1', ...claims }, { issuer: 'https://appleid.apple.com', audience });

    const web = await verifyAppleIdToken(await apple({ email: 'pat@icloud.com', email_verified: 'true' }), ['app.aimtrue.web', 'com.aimtrue.app'], { keys: jwks, name: 'Pat Lee' });
    expect(web).toMatchObject({ provider: 'apple', subject: 'apple-1', email: 'pat@icloud.com', emailVerified: true, name: 'Pat Lee' });

    const native = await verifyAppleIdToken(await apple({ email: 'x1@privaterelay.appleid.com', is_private_email: 'true' }, 'com.aimtrue.app'), ['app.aimtrue.web', 'com.aimtrue.app'], { keys: jwks });
    expect(native.email).toBe('x1@privaterelay.appleid.com');

    await expect(verifyAppleIdToken(await apple({}, 'com.other.app'), ['app.aimtrue.web'], { keys: jwks })).rejects.toThrow();

    // A server-to-server notice, signed by Apple.
    const notice = await token(privateKey, { events: JSON.stringify({ type: 'consent-revoked', sub: 'apple-1' }) }, { issuer: 'https://appleid.apple.com', audience: 'app.aimtrue.web' });
    expect(await verifyAppleNotification(notice, ['app.aimtrue.web'], jwks)).toEqual({ subject: 'apple-1', type: 'consent-revoked' });
    expect(await verifyAppleNotification('not-a-token', ['app.aimtrue.web'], jwks)).toBeNull();
  });

  test('Facebook: an access token counts only when Graph says it is valid and ours', async () => {
    const graph = (debug: Record<string, unknown>, me: Record<string, unknown>) =>
      (async (input: string | URL | Request) => {
        const url = String(input);
        return new Response(JSON.stringify(url.includes('/debug_token') ? { data: debug } : me));
      }) as typeof fetch;

    const ok = await verifyFacebookAccessToken('t', 'APP', 'SECRET', graph({ is_valid: true, app_id: 'APP', user_id: '42' }, { id: '42', name: 'Pat', email: 'Pat@Example.com' }));
    expect(ok).toMatchObject({ provider: 'facebook', subject: '42', email: 'pat@example.com', emailVerified: true });

    const noEmail = await verifyFacebookAccessToken('t', 'APP', 'SECRET', graph({ is_valid: true, app_id: 'APP', user_id: '42' }, { id: '42' }));
    expect(noEmail).toMatchObject({ email: null, emailVerified: false });

    // A token issued to another app must not sign anybody in.
    await expect(verifyFacebookAccessToken('t', 'APP', 'SECRET', graph({ is_valid: true, app_id: 'OTHER', user_id: '42' }, { id: '42' }))).rejects.toThrow();
    await expect(verifyFacebookAccessToken('t', 'APP', 'SECRET', graph({ is_valid: false, app_id: 'APP', user_id: '42' }, { id: '42' }))).rejects.toThrow();
    // /me must be the same account the token is for.
    await expect(verifyFacebookAccessToken('t', 'APP', 'SECRET', graph({ is_valid: true, app_id: 'APP', user_id: '42' }, { id: '43' }))).rejects.toThrow();

    // iOS Limited Login: an OpenID token from Meta.
    const { privateKey, jwks } = await keys();
    const limited = await token(privateKey, { sub: '42', email: 'pat@example.com' }, { issuer: 'https://www.facebook.com', audience: 'APP' });
    expect(await verifyFacebookLimitedToken(limited, 'APP', { keys: jwks })).toMatchObject({ subject: '42', emailVerified: true });
  });
});
