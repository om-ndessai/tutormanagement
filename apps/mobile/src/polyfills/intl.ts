// Intl gaps in Hermes, filled before anything else runs (imported first by the root layout).
//
// The shared package formats through Intl: `formatRelativeTime` (audit.ts) uses
// Intl.RelativeTimeFormat, which Hermes does not implement; it depends on PluralRules and
// Locale. Each `polyfill` entry checks for itself and installs only where the engine lacks it;
// English data only, the portal's one language. `zonedClockParts` (DateTimeFormat with a
// timeZone) and `formatCents` (currency) are native on both platforms -- the diagnostics
// screen (src/app/dev/diagnostics.tsx) and its Maestro flow prove it on each.
import '@formatjs/intl-getcanonicallocales/polyfill.js';
import '@formatjs/intl-locale/polyfill.js';
import '@formatjs/intl-pluralrules/polyfill.js';
import '@formatjs/intl-pluralrules/locale-data/en.js';
import '@formatjs/intl-relativetimeformat/polyfill.js';
import '@formatjs/intl-relativetimeformat/locale-data/en.js';
