#!/usr/bin/env node
/**
 * One word per thing on screen (Phase 59, docs/spaces-plan.md S1; Phase 78, docs/journey-fixes-plan.md).
 *
 * The code keeps its names -- `organization` (the table, `OrgId`, `X-Organization`, `/organization`),
 * `sessions` (the table, `/api/sessions`, `tmi_session`), `users` (`user_id`, `useUsers`, `X-Dev-User`),
 * `quest_games`, the API's `beta` fields, audit KEYS such as `session.recorded` and API error CODES --
 * and that stays. What a person READS uses the glossary's word (packages/shared/src/words.ts):
 *
 *   organization / organisation  ->  space
 *   session(s)                    ->  lesson(s)  (the sign-in sense too: "You were signed out")
 *   user(s)                       ->  person / people
 *   Quest game(s)                 ->  the quest in words (`gameWords`: "Grade 7 Quick 5"), or "quest"
 *   Beta                          ->  nothing: checked questions are served like any other
 *
 * Each rule fails when its word comes back into text somebody reads:
 *   - JSX text;
 *   - a string or template in a JSX attribute, or as a JSX child;
 *   - a string given to label, title, placeholder, message, description (and the like),
 *     to a toast, an Alert, an ApiError or a Zod message;
 *   - a value of AUDIT_ACTIONS or of any `*_LABEL(S)` / `*_DESCRIPTION(S)` table;
 *   - any other string that reads as prose (it has a space in it and is not SQL, a log line, or a
 *     Worker's internal `new Error(...)`, which production answers as "Something went wrong").
 * A `ui-words:` comment on the line above (or the same line) marks a deliberate exception, such
 * as a proper name or the platform console's own Beta labels. Run by `npm run typecheck`. A
 * heuristic, like check-org-scope.mjs: it makes the easy mistake fail loudly.
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

/**
 * The rules. `word` finds the word in a string; `token`, when set, is the same word as one
 * whitespace-free token, so that names in code (`o.organization_id`, `/api/sessions`,
 * `X-Dev-User`) can be told from the word; `code` lists whole tokens that are names, not words.
 * `anywhere`: a one-word string that starts with a capital ("Sessions", "Users", "Beta") is a
 * label wherever it is -- a menu item's `badge`, a heading passed to a PDF writer -- not only
 * where the context says it is shown.
 */
const RULES = [
  {
    id: 'space',
    word: /organi[sz]ation/i,
    token: /\S*organi[sz]ation\S*/gi,
    code: /^X-Organization$/i,
    use: 'say "space" (docs/spaces-plan.md, S1)',
  },
  {
    id: 'lesson',
    word: /\bsessions?\b/i,
    token: /\S*\bsessions?\b\S*/gi,
    code: /^$/,
    anywhere: true,
    use: 'say "lesson" / "lessons" (and "You were signed out", never "session expired")',
  },
  {
    id: 'people',
    word: /\busers?\b/i,
    token: /\S*\busers?\b\S*/gi,
    code: /^(X-Dev-User|User-Agent)$/i,
    anywhere: true,
    use: 'say "person" / "people"',
  },
  {
    id: 'quest',
    word: /\bquest games?\b/i,
    token: null,
    code: null,
    use: 'say the quest in words (`gameWords`: "Grade 7 Quick 5"), or "quest"',
  },
  {
    id: 'beta',
    word: /\bbeta\b/i,
    token: /\S*\bbeta\b\S*/gi,
    code: /^$/,
    anywhere: true,
    use: 'drop it: checked questions are served like any other (Phase 78)',
  },
];
const ANY_WORD = new RegExp(RULES.map((rule) => rule.word.source).join('|'), 'i');

const SQL = /\b(SELECT|FROM|WHERE|JOIN|INSERT|UPDATE|DELETE|CREATE|ALTER)\b/;
/** A token, not a sentence: `organization.created`, `/organization`, `session_recorded`. */
const CODE = /^[a-z0-9_.:/?=&#-]*$/;

/** Whether some mention is the rule's word rather than a name in code. */
function mentionsTheWord(rule, text) {
  if (!rule.word.test(text)) return false;
  if (!rule.token) return true;
  for (const [token] of text.matchAll(rule.token)) {
    const bare = token.replace(/^[("'‘“]+|[.,;:!?)’'"”]+$/g, '');
    if (/[_./=]/.test(bare) || rule.code.test(bare)) continue;
    return true;
  }
  return false;
}

const UI_KEYS = new Set([
  'label', 'title', 'placeholder', 'message', 'description', 'hint', 'subtitle', 'heading',
  'body', 'text', 'empty', 'emptyText', 'help', 'helper', 'summary', 'tooltip', 'keywords',
  'cta', 'caption', 'detail', 'prompt', 'question', 'answer', 'aria-label', 'accessibilityLabel', 'badge',
]);
const NON_UI_ATTRS = /^(className|key|to|href|id|htmlFor|type|name|value|src|testID|data-.*|role|form|method|action)$/;
const ZOD_METHODS = new Set(['min', 'max', 'length', 'regex', 'refine', 'superRefine', 'nonempty', 'email', 'uuid', 'url', 'int', 'positive', 'nonnegative', 'startsWith', 'endsWith', 'includes']);
const UI_CALLEES = new Set(['toast', 'alert', 'setError', 'setMessage', 'confirm']);
const TABLE_NAME = /(^AUDIT_ACTIONS$|_LABELS?$|_DESCRIPTIONS?$|_MESSAGES?$|_HINTS?$|_COPY$)/;
/** A Worker or a console log line: read by whoever runs the platform, never shown. */
const LOG_CALLEE = /^console\.(log|info|warn|error|debug)$/;

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

/** Whether a string is a log line's, from its ancestors. */
function inLogCall(ancestors) {
  return ancestors.some(
    (node) => (node.type === 'CallExpression' || node.type === 'OptionalCallExpression') && LOG_CALLEE.test(calleeName(node.callee) ?? ''),
  );
}

/**
 * Whether a string is a Worker's internal error (`throw new Error('Insert into users returned no row.')`): the
 * error handler answers "Something went wrong" in production, so nobody reads it. In the clients an Error's
 * message can reach a toast, so there it is still checked.
 */
function inWorkerError(file, ancestors) {
  return (
    file.includes('/apps/api/src/') &&
    ancestors.some((node) => node.type === 'NewExpression' && node.callee.type === 'Identifier' && node.callee.name === 'Error')
  );
}

/** Whether a string is part of a type (`type Kind = 'Session'`), which nobody reads. */
function inType(ancestors) {
  return ancestors.some((node) => /^TS/.test(node.type) && !/^TS(AsExpression|SatisfiesExpression|NonNullExpression)$/.test(node.type));
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
  if (!ANY_WORD.test(source)) return [];
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

    const rules = text !== null && ANY_WORD.test(text) ? RULES.filter((rule) => mentionsTheWord(rule, text)) : [];
    if (rules.length > 0) {
      const top = ancestors[ancestors.length - 1];
      const isImport = top && (top.type === 'ImportDeclaration' || top.type === 'ExportAllDeclaration' || top.type === 'ExportNamedDeclaration' || top.type === 'ImportExpression' || (top.type === 'CallExpression' && top.callee.type === 'Import'));
      const trimmed = text.trim();
      const line = node.loc.start.line;
      let bad = false;
      if (node.type === 'JSXText') bad = true;
      else if (isImport || SQL.test(text) || inLogCall(ancestors) || inWorkerError(file, ancestors)) bad = false;
      else if (CODE.test(trimmed)) bad = false;
      else if (/\s/.test(trimmed)) bad = true; // prose, wherever it is
      // one word: only where it is shown -- or, capitalised, wherever it is (outside a type)
      else bad = inUiContext(ancestors) || (/^[A-Z]/.test(trimmed) && rules.some((rule) => rule.anywhere) && !inType(ancestors));
      if (bad && !exempt.has(line)) {
        for (const rule of rules) {
          problems.push({ rule, at: `${relative(REPO, file)}:${line}`, text: JSON.stringify(trimmed.slice(0, 90)) });
        }
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
  console.error('ui-words: a word on screen that the glossary replaces (packages/shared/src/words.ts).');
  console.error('  Reword it, or mark a deliberate exception with a `ui-words:` comment above it.');
  for (const problem of problems) {
    console.error(`  ${problem.at}  ${problem.text}  -- ${problem.rule.use}`);
  }
  process.exit(1);
}
console.log('ui-words: every screen says space, lesson, person, quest, and no Beta.');
