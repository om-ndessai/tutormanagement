// Quest Games' one shared look (Phase 46): a code reads best in a fixed-width face, spaced out.
import { Platform } from 'react-native';

export const CODE_FONT = Platform.select({ ios: 'Menlo', default: 'monospace' });
