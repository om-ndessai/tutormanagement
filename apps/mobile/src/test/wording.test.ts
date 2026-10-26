// Phase 52 (docs/mobile/build-log.md entry 63): on screen an organization is a "space". Routes,
// query keys, error codes, testIDs and API paths keep `organization`; the words a person reads do
// not. This scans every source file (not tests) for the word inside string literals, template
// text and JSX text, so a new screen cannot bring it back. Comments are not scanned.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';

const SRC = path.join(__dirname, '..');
const WORD = /\b[Oo]rganizations?\b/;

/** Exact on-screen strings that keep the word on purpose. */
const ALLOWED_TEXT = new Set([
  // The payer on a 1099 is an organization, as on the web.
  'The organization’s EIN',
  // Phase 54 (docs/tutor-spaces-plan.md): "Organization" is the word on screen for the record that
  // runs a space's money (a business in the code) -- the owner's choice, as on the web.
  'Families pay the organization, which pays the tutors and files their 1099s.',
  'The EIN the organization files under. Prefills the payer box — never a Social Security number, which the portal refuses to store.',
  'No organization runs this space’s money: a lesson has one price, the family pays the tutor who taught it, and nobody takes a cut. Tutors record the payments they receive, and each gets a year-end summary of them; the space files no 1099s. To have an organization run it, ask the platform administrator.',
]);

/** Phase 54: the console's Organizations (businesses), where the word is the record itself. */
const ALLOWED_FILES = new Set([
  'features/platform/business-form-sheet.tsx',
  'features/platform/businesses-screen.tsx',
]);
/** Phase 54: the record's name alone, where a file shows it (`<file>:<text>`). */
const ALLOWED_AT = new Set([
  'app/(platform)/platform/(organizations)/_layout.tsx:Organizations',
  'features/platform/organizations-screen.tsx:Organizations',
  'features/platform/organization-form-sheet.tsx:Organization',
]);

/** Props and keys whose strings are never shown as words. */
const NON_TEXT_PROPS = new Set([
  'testID',
  'nativeID',
  'name',
  'href',
  'pathname',
  'queryKey',
  'code',
  'kind',
]);
/** Search keywords: matched against what is typed, never shown, so both words still find it. */
const KEYWORD_PROPS = new Set(['value', 'keywords']);

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'test' ? [] : sourceFiles(full);
    if (
      !/\.tsx?$/.test(entry.name) ||
      /\.test\.tsx?$/.test(entry.name) ||
      /\.generated\.ts$/.test(entry.name)
    )
      return [];
    return [full];
  });
}

/** A token, not a sentence: a key, a route, a code ('organization', 'organization-required', '/organization'). */
function isToken(text: string): boolean {
  return !/\s/.test(text) && !/^[A-Z]/.test(text);
}

/** A literal shown as a child of an element, through a conditional ({n === 1 ? 'space' : 'spaces'}). */
function isJsxChild(node: ts.Node): boolean {
  let current = node.parent;
  while (
    current &&
    (ts.isConditionalExpression(current) ||
      ts.isParenthesizedExpression(current) ||
      ts.isBinaryExpression(current))
  )
    current = current.parent;
  return Boolean(
    current && ts.isJsxExpression(current) && current.parent && !ts.isJsxAttribute(current.parent),
  );
}

function propertyNameOf(node: ts.Node): string | null {
  let current: ts.Node = node;
  // Climb through a template, a conditional or a call inside the value.
  for (let depth = 0; depth < 4 && current.parent; depth++) {
    const parent: ts.Node = current.parent;
    if (ts.isPropertyAssignment(parent) && parent.initializer === current) return parent.name.getText();
    if (ts.isJsxAttribute(parent)) return parent.name.getText();
    if (ts.isJsxExpression(parent) && ts.isJsxAttribute(parent.parent)) return parent.parent.name.getText();
    current = parent;
  }
  return null;
}

function skipped(node: ts.Node): boolean {
  const parent = node.parent;
  if (!parent) return false;
  if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) return true;
  if (ts.isLiteralTypeNode(parent)) return true;
  if (ts.isPropertyAssignment(parent) && parent.name === node) return true;
  if (ts.isCallExpression(parent) && parent.expression.getText() === 'require') return true;
  const prop = propertyNameOf(node);
  if (prop && (NON_TEXT_PROPS.has(prop) || KEYWORD_PROPS.has(prop))) return true;
  return false;
}

export function findOrganizationWords(file: string): string[] {
  const text = fs.readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const hits: string[] = [];
  const check = (node: ts.Node, value: string) => {
    if (
      !WORD.test(value) ||
      (isToken(value) && !isJsxChild(node)) ||
      ALLOWED_TEXT.has(value.trim().replace(/\s+/g, ' ')) ||
      ALLOWED_FILES.has(path.relative(SRC, file)) ||
      ALLOWED_AT.has(`${path.relative(SRC, file)}:${value.trim()}`) ||
      skipped(node)
    )
      return;
    const { line } = source.getLineAndCharacterOfPosition(node.getStart());
    hits.push(`${path.relative(SRC, file)}:${line + 1}: ${value.trim()}`);
  };
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) check(node, node.text);
    else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      const whole = node.parent && ts.isTemplateSpan(node.parent) ? node.parent.parent : node.parent;
      check(whole ?? node, node.text);
    } else if (ts.isJsxText(node)) check(node, node.text);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return hits;
}

describe('the word "space" on screen (Phase 52)', () => {
  it('no source file shows "organization" to a person', () => {
    const hits = sourceFiles(SRC).flatMap(findOrganizationWords);
    expect(hits).toEqual([]);
  });

  it('catches a sentence and lets a route, a key and a keyword through', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wording-'));
    const file = path.join(dir, 'sample.tsx');
    fs.writeFileSync(
      file,
      [
        "const key = ['organization', 'code'];",
        "const route = '/organization';",
        "const action = { value: 'switch space organization' };",
        'const a = <Text testID="organization-stub">Only an administrator can see the organization’s settings.</Text>;',
        "const b = { title: 'Organization' };",
        'const c = `Belongs to ${n} organizations.`;',
        "const d = <Text>{n === 1 ? 'organization' : 'spaces'}</Text>;",
      ].join('\n'),
    );
    const hits = findOrganizationWords(file).map((hit) => hit.replace(/^.*?: /, ''));
    fs.rmSync(dir, { recursive: true });
    expect(hits).toEqual([
      'Only an administrator can see the organization’s settings.',
      'Organization',
      'organizations.',
      'organization',
    ]);
  });
});
