// What a logo upload may send, checked on the phone before it goes: PNG or WebP by the bytes
// themselves (never SVG, which can carry script), at most MAX_LOGO_BYTES. The server checks the
// same again (its sniffImage); this only saves a refused upload.
import { MAX_LOGO_BYTES, type LogoContentType, type LogoKind } from '@tmi/shared';

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** The image type the bytes say they are, or null for anything but PNG and WebP. */
export function logoContentType(bytes: Uint8Array): LogoContentType | null {
  if (bytes.length >= PNG.length && PNG.every((byte, index) => bytes[index] === byte)) return 'image/png';
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  return null;
}

/** Whether the bytes may be uploaded as a logo: the right type and small enough. */
export function logoProblem(bytes: Uint8Array): string | null {
  if (bytes.length === 0) return 'Choose an image.';
  if (bytes.length > MAX_LOGO_BYTES) return 'A logo may be at most 256 KB.';
  if (!logoContentType(bytes)) return 'Upload a PNG or WebP image. SVG and other formats are not accepted.';
  return null;
}

/** The longest side each kind is kept to: the mark is small and square-ish, the full logo wider. */
export const LOGO_MAX_SIDE: Record<LogoKind, number> = { mark: 512, full: 1024 };

export interface LogoAttempt {
  format: 'png' | 'webp';
  /** 0-1, WebP only. */
  compress?: number;
  /** The size to shrink to, or null to keep the picture's own (it is already small enough). */
  resize: { width: number } | { height: number } | null;
}

function shrinkTo(width: number, height: number, side: number): LogoAttempt['resize'] {
  if (width <= side && height <= side) return null;
  return width >= height ? { width: side } : { height: side };
}

/**
 * The encodings to try, in order, until one fits in MAX_LOGO_BYTES: lossless PNG at the kind's
 * size, then WebP, then smaller WebP at half the size. Pictures are shrunk, never enlarged.
 */
export function logoAttempts(kind: LogoKind, width: number, height: number): LogoAttempt[] {
  const side = LOGO_MAX_SIDE[kind];
  return [
    { format: 'png', resize: shrinkTo(width, height, side) },
    { format: 'webp', compress: 0.85, resize: shrinkTo(width, height, side) },
    { format: 'webp', compress: 0.7, resize: shrinkTo(width, height, side / 2) },
  ];
}
