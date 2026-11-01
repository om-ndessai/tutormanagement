#!/usr/bin/env node
/**
 * One word on screen: space (Phase 59, docs/spaces-plan.md, S1).
 *
 * The code says `organization` (the table, `OrgId`, `X-Organization`, `/organization`,
 * audit keys such as `organization.created`), and that stays. What a person READS says
 * "space". This guard fails when "organization" or "organisation" comes back into text
 * somebody reads:
 *   - JSX text;
 *   - a string or template in a JSX attribute, or as a JSX child;
 *   - a string given to label, title, placeholder, message, description (and the like),
 *     to a toast, an Alert, an ApiError or a Zod message;
 *   - a value of AUDIT_ACTIONS or of any `*_LABEL(S)` / `*_DESCRIPTION(S)` table;
 *   - any other string that reads as prose (it has a space in it and is not SQL).
 * A `ui-words:` comment on the line above (or the same line) marks a deliberate exception,
 * such as a proper name. Run by `npm run typecheck`. A heuristic, like check-org-scope.mjs:
 * it makes the easy mistake fail loudly.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative } from 'node:path';

const require = createRequire(import.meta.url);
let parse;
try {
  ({ parse } = require('@babel/parser'));
} catch {
  console.error('ui-words: @babel/parser is missing; run npm install at the repo root.');
  process.exit(1);
}

const REPO = new URL('..', import.meta.url).pathname;
// The app (apps/mobile/src) joined with the app half of Phase 59.
const ROOTS = ['apps/web/src', 'apps/mobile/src', 'apps/api/src', 'packages/shared/src'];
const WORD = /organi[sz]ation/i;
const SQL = /\b(SELECT|FROM|WHERE|JOIN|INSERT|UPDATE|DELETE|CREATE|ALTER)\b/;
/** A token, not a sentence: `organization.created`, `/organization`, `organization_required`. */
const CODE = /^[a-z0-9_.:/?=&#-]*$/;

/** Whether some mention is a word rather than a name in code (`o.organization_id`, `X-Organization`). */
function mentionsTheWord(text) {
  for (const [token] of text.matchAll(/\S*organi[sz]ation\S*/gi)) {
    const bare = token.replace(/^[("'‘“]+|[.,;:!?)’'"”]+$/g, '');
    if (/[_./=]/.test(bare) || /^X-Organization$/i.test(bare)) continue;
    return true;
  }
  return false;
}

const UI_KEYS = new Set([
  'label', 'title', 'placeholder', 'message', 'description', 'hint', 'subtitle', 'heading',
  'body', 'text', 'empty', 'emptyText', 'help', 'helper', 'summary', 'tooltip', 'keywords',
  'cta', 'caption', 'detail', 'prompt', 'question', 'answer', 'aria-label', 'accessibilityLabel',
]);
const NON_UI_ATTRS = /^(className|key|to|href|id|htmlFor|type|name|value|src|testID|data-.*|role|form|method|action)$/;
const ZOD_METHODS = new Set(['min', 'max', 'length', 'regex', 'refine', 'superRefine', 'nonempty', 'email', 'uuid', 'url', 'int', 'positive', 'nonnegative', 'startsWith', 'endsWith', 'includes']);
const UI_CALLEES = new Set(['toast', 'alert', 'setError', 'setMessage', 'confirm']);
const TABLE_NAME = /(^AUDIT_ACTIONS$|_LABELS?$|_DESCRIPTIONS?$|_MESSAGES?$|_HINTS?$|_COPY$)/;

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === 'node_modules' || name === 'dist') return [];
    if (statSync(path).isDirectory()) return files(path);
    return /\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts') && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

function keyName(node) {
  if (!node) return null;
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'StringLiteral') return node.value;
  return null;
}

function calleeName(callee) {
  if (!callee) return null;
  if (callee.type === 'Identifier') return callee.name;
  if (callee.type === 'MemberExpression') {
    const object = calleeName(callee.object);
    const property = keyName(callee.property);
    return `${object ?? ''}.${property ?? ''}`;
  }
  return null;
}

/** Whether a string sits where a person reads it, from its ancestors (nearest last). */
function inUiContext(ancestors) {
  for (let i = ancestors.length - 1; i >= 0; i -= 1) {
    const node = ancestors[i];
    const parent = ancestors[i - 1];
    switch (node.type) {
      case 'JSXAttribute': {
        const name = node.name.type === 'JSXNamespacedName' ? node.name.name.name : node.name.name;
        return !NON_UI_ATTRS.test(name);
      }
      case 'JSXExpressionContainer':
        if (parent && (parent.type === 'JSXElement' || parent.type === 'JSXFragment')) return true;
        break;
      case 'ObjectProperty':
        if (UI_KEYS.has(keyName(node.key))) return true;
        break;
      case 'CallExpression':
      case 'NewExpression': {
        const name = calleeName(node.callee) ?? '';
        const [object, property] = name.split('.');
        if (UI_CALLEES.has(name) || object === 'toast' || name === 'Alert.alert') return true;
        if (object === 'ApiError' || name === 'ApiError') return true;
        if (property && ZOD_METHODS.has(property)) return true;
        break;
      }
      case 'VariableDeclarator':
        return node.id.type === 'Identifier' && TABLE_NAME.test(node.id.name);
      case 'ImportDeclaration':
      case 'ExportNamedDeclaration':
      case 'ExportAllDeclaration':
      case 'TSLiteralType':
        return false;
      default:
        break;
    }
  }
  return false;
}

function check(file) {
  const source = readFileSync(file, 'utf8');
  if (!WORD.test(source)) return [];
  const ast = parse(source, {
    sourceType: 'module',
    plugins: ['typescript', ...(file.endsWith('.tsx') ? ['jsx'] : [])],
    errorRecovery: true,
  });
  const exempt = new Set();
  for (const comment of ast.comments ?? []) {
    if (comment.value.includes('ui-words:')) {
      for (let line = comment.loc.start.line; line <= comment.loc.end.line + 1; line += 1) exempt.add(line);
    }
  }
  const problems = [];
  const ancestors = [];

  const visit = (node) => {
    if (!node || typeof node.type !== 'string') return;
    let text = null;
    if (node.type === 'JSXText') text = node.value;
    else if (node.type === 'StringLiteral') text = node.value;
    else if (node.type === 'TemplateElement') text = node.value.cooked ?? node.value.raw;

    if (text !== null && WORD.test(text) && mentionsTheWord(text)) {
      const top = ancestors[ancestors.length - 1];
      const isImport = top && (top.type === 'ImportDeclaration' || top.type === 'ExportAllDeclaration' || top.type === 'ExportNamedDeclaration' || top.type === 'ImportExpression' || (top.type === 'CallExpression' && top.callee.type === 'Import'));
      const trimmed = text.trim();
      const line = node.loc.start.line;
      let bad = false;
      if (node.type === 'JSXText') bad = true;
      else if (isImport || SQL.test(text)) bad = false;
      else if (CODE.test(trimmed)) bad = false;
      else if (/\s/.test(trimmed)) bad = true; // prose, wherever it is
      else bad = inUiContext(ancestors); // one word: only where it is shown
      if (bad && !exempt.has(line)) {
        problems.push(`${relative(REPO, file)}:${line}  ${JSON.stringify(trimmed.slice(0, 90))}`);
      }
    }

    ancestors.push(node);
    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'start' || key === 'end' || key.endsWith('Comments')) continue;
      const value = node[key];
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object' && typeof value.type === 'string') visit(value);
    }
    ancestors.pop();
  };
  visit(ast.program);
  return problems;
}

const problems = ROOTS.flatMap((root) => files(join(REPO, root))).flatMap(check);
if (problems.length > 0) {
  console.error('ui-words: "organization" on screen -- people read "space" (docs/spaces-plan.md, S1).');
  console.error('  Reword it, or mark a deliberate exception with a `ui-words:` comment above it.');
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
console.log('ui-words: no screen says "organization".');
