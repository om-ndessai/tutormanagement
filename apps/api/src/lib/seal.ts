/**
 * Phase 55: seals a secret the Worker must keep but never show -- Apple's
 * refresh token, held only so it can be revoked when the person deletes their
 * account. AES-GCM under a key derived from the session secret for this one
 * purpose; the stored text is `iv.ciphertext`, both base64url.
 */
const PURPOSE = 'aimtrue:apple-revoke-token';

async function keyFor(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${PURPOSE}:${secret}`));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (text: string) =>
  Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (ch) => ch.charCodeAt(0));

export async function seal(plain: string, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyFor(secret), new TextEncoder().encode(plain));
  return `${b64(iv)}.${b64(new Uint8Array(cipher))}`;
}

export async function unseal(sealed: string, secret: string): Promise<string | null> {
  try {
    const [iv, data] = sealed.split('.');
    if (!iv || !data) return null;
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await keyFor(secret), unb64(data));
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}
