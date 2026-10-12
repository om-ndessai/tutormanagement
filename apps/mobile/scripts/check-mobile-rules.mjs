// The app's textual rules, checked on every typecheck (see apps/mobile/CLAUDE.md):
//   - no organization's name in code: the brand is data (`useBrand().short`);
//   - no colour literal outside src/theme: colours come from the palette tokens;
//   - no printToFileAsync anywhere: it would write the 1099 (and its SSN) to disk;
//   - formatCents only where money may render (SessionMoney and the finance components);
//   - dictation (P3): only src/lib/speech*.ts imports expo-speech-recognition; no recording
//     options, persisted audio or audio source anywhere; no console in dictation code (a transcript
//     is never logged); and no DictationField in a finance, tax or person form.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'src');

const ORG_NAMES = /Chapel Hill|Riverside Tutoring|Mathematics Institute|Triangle Math/i;
const HEX = /['"`]#[0-9a-fA-F]{3,8}['"`]|rgba?\(/;
// Files allowed to format money. Everything else renders it through these.
const MONEY_FILES = [
  /^src\/features\/teaching\/session-money\.tsx$/,
  // The developer diagnostics screen proves formatCents on Hermes.
  /^src\/app\/dev\/diagnostics\.tsx$/,
  /^src\/features\/(dashboard|payments|teaching|users)\/.*(finance|money|payment|billing|balance|1099|rate|payout|earn).*\.tsx?$/i,
];

// Dictation never reaches money, tax or a person's record (the 1099 sheet above all).
const NO_DICTATION_FILES = [
  /^src\/features\/(payments|platform|organizations|onboarding)\//,
  /^src\/features\/users\/person-form/,
  /(finance|money|payment|billing|balance|1099|tax|payout|earn|rate|ssn)/i,
  /^src\/app\/\(org\)\/(form-1099|payment-form|person-form|billing|organization)\.tsx$/,
];
const SPEECH_IMPORT =
  /from\s+['"]expo-speech-recognition['"]|require\(\s*['"]expo-speech-recognition['"]\s*\)|import\(\s*['"]expo-speech-recognition['"]\s*\)/;
const DICTATION_CODE = /^src\/(lib\/speech[^/]*|features\/dictation\/.*)\.tsx?$/;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const problems = [];
for (const file of walk(SRC)) {
  if (!/\.(ts|tsx)$/.test(file)) continue;
  const rel = relative(root, file);
  const text = readFileSync(file, 'utf8');
  const isTest = /\.test\.tsx?$/.test(rel) || rel.startsWith('src/test/');
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    const at = `${rel}:${i + 1}`;
    if (!isTest && !rel.startsWith('src/dev/') && ORG_NAMES.test(line)) {
      problems.push(`${at}  an organization's name in code: use useBrand().short`);
    }
    if (!rel.startsWith('src/theme/') && !isTest && HEX.test(line) && !line.includes('rules-allow-colour')) {
      problems.push(`${at}  a colour literal: use useAppTheme().tokens`);
    }
    if (/printToFileAsync/.test(line) && !rel.endsWith('check-mobile-rules.mjs')) {
      problems.push(`${at}  printToFileAsync writes the 1099 to disk: use Print.printAsync({ html })`);
    }
    if (!isTest && SPEECH_IMPORT.test(line) && !/^src\/lib\/speech[^/]*\.ts$/.test(rel)) {
      problems.push(`${at}  expo-speech-recognition outside src/lib/speech.ts: dictate through speech.ts`);
    }
    if (!isTest && /recordingOptions|audioSource|persist:\s*true/.test(line)) {
      problems.push(
        `${at}  dictation never records, keeps or reads audio: no recording options or audio source`,
      );
    }
    if (!isTest && DICTATION_CODE.test(rel) && /\bconsole\./.test(line)) {
      problems.push(`${at}  no console in dictation code: a transcript is never logged`);
    }
    if (!isTest && /\bDictationField\b/.test(line) && NO_DICTATION_FILES.some((re) => re.test(rel))) {
      problems.push(`${at}  no dictation in a finance, tax or person form`);
    }
    if (!isTest && /\bformatCents\(/.test(line) && !MONEY_FILES.some((re) => re.test(rel))) {
      problems.push(`${at}  formatCents outside the money components: render through SessionMoney`);
    }
  });
}

if (problems.length) {
  console.error(`check-mobile-rules: ${problems.length} problem(s)\n` + problems.join('\n'));
  process.exit(1);
}
console.log('check-mobile-rules: ok');
