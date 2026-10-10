// A logo from the photo library to bytes the API accepts: the system picker (no permission prompt:
// it is out of process), then shrunk and re-encoded as PNG or WebP until it fits in 256 KB, then
// read back as bytes and checked. Every temporary file is deleted, whatever happens.
import { MAX_LOGO_BYTES, type LogoContentType, type LogoKind } from '@tmi/shared';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { logoAttempts, logoContentType, logoProblem } from './logo-bytes';

export interface PreparedLogo {
  bytes: ArrayBuffer;
  contentType: LogoContentType;
}

export class LogoError extends Error {}

function discard(uri: string | null | undefined) {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // A temporary file the system has already cleared.
  }
}

/** Picks a picture and prepares it; null when the person cancels the picker. */
export async function pickLogo(kind: LogoKind): Promise<PreparedLogo | null> {
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    allowsEditing: false,
  });
  const asset = picked.canceled ? null : picked.assets[0];
  if (!asset) return null;
  try {
    return await prepareLogo(asset.uri, kind, asset.width, asset.height);
  } finally {
    discard(asset.uri);
  }
}

async function prepareLogo(
  uri: string,
  kind: LogoKind,
  width: number,
  height: number,
): Promise<PreparedLogo> {
  for (const attempt of logoAttempts(kind, width, height)) {
    const context = ImageManipulator.manipulate(uri);
    if (attempt.resize) context.resize(attempt.resize);
    const image = await context.renderAsync();
    const saved = await image.saveAsync({
      format: attempt.format === 'png' ? SaveFormat.PNG : SaveFormat.WEBP,
      ...(attempt.compress === undefined ? {} : { compress: attempt.compress }),
    });
    try {
      const file = new File(saved.uri);
      if ((file.size ?? Infinity) > MAX_LOGO_BYTES) continue;
      const bytes = await file.arrayBuffer();
      const view = new Uint8Array(bytes);
      const problem = logoProblem(view);
      if (problem) throw new LogoError(problem);
      return { bytes, contentType: logoContentType(view)! };
    } finally {
      discard(saved.uri);
    }
  }
  throw new LogoError(
    'That picture is too detailed to fit in 256 KB, even made smaller. Try a simpler image.',
  );
}
