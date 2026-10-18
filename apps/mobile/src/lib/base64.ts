// Bytes as base64, on Hermes: how a file the app shows in a web view (an assessment's PDF, Phase 38)
// crosses into the page through injectJavaScript, without ever being written to the device. Pure;
// no reliance on `btoa`, whose input must be a binary string built one character at a time.

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  let line = '';
  const full = bytes.length - (bytes.length % 3);
  for (let i = 0; i < full; i += 3) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!;
    line +=
      ALPHABET[(n >> 18) & 63]! + ALPHABET[(n >> 12) & 63]! + ALPHABET[(n >> 6) & 63]! + ALPHABET[n & 63]!;
    // Joined in pieces: one string grown a character at a time would copy itself over and over.
    if (line.length >= 8192) {
      chunks.push(line);
      line = '';
    }
  }
  const rest = bytes.length - full;
  if (rest === 1) {
    const n = bytes[full]! << 16;
    line += `${ALPHABET[(n >> 18) & 63]}${ALPHABET[(n >> 12) & 63]}==`;
  } else if (rest === 2) {
    const n = (bytes[full]! << 16) | (bytes[full + 1]! << 8);
    line += `${ALPHABET[(n >> 18) & 63]}${ALPHABET[(n >> 12) & 63]}${ALPHABET[(n >> 6) & 63]}=`;
  }
  chunks.push(line);
  return chunks.join('');
}
