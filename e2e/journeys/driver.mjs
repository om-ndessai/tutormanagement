#!/usr/bin/env node
/**
 * The UI journey audit's browser driver (docs/userjourney/README.md).
 *
 * One long-lived headless Chrome per journey, each with its own profile in docs/userjourney/_run/<id>/.
 * An agent sends one action at a time, looks at the result, and decides the next step, as a person
 * would: nothing is replayed, and the tab's sessionStorage (its space) survives between steps.
 *
 * Google's sign-in script is the one stand-in: accounts.google.com/gsi/client is answered with a small
 * script whose button hands the app a `fake:google:<sub>:<email>:1:<name>` token for the journey's
 * persona (the local Worker accepts those outside production), so the app's own code runs from that
 * click on.
 *
 *   node e2e/journeys/driver.mjs <command> <id> [args] [--flags]
 *
 *   persona <id> <email> <name> [sub]   who the stand-in Google button signs in as
 *   goto <id> <path|url>                a path is taken against JOURNEY_BASE (http://localhost:8797)
 *   click <id> <sel> | dblclick | hover | check | uncheck
 *   fill <id> <sel> <text> | type <id> <sel> <text> | select <id> <sel> <value> | press <id> <key>
 *   scroll <id> <sel|pixels> | wait <id> <ms|sel> | back <id> | reload <id> | newtab <id>
 *   viewport <id> phone|desktop | devuser <id> <email>  (devuser: only on a Worker with sign-in off)
 *   shot <id> <step> [--landing] [--full]   assets/cuj-<id>-step-<n>.png (390x844); --landing adds
 *                                           -desktop (1280x800) and -dark (phone, dark mode)
 *   text <id> [--max N] | aria <id> [--max N] | url <id> | errors <id> | clipboard <id> | eval <id> <js>
 *   sheet <id>                          one image of a journey's phone steps: assets/cuj-<id>-sheet.png
 *   status <id> <message...>            appends to _run/status.log
 *   stop <id>
 *
 * Selectors: role:<role>:<name> (name contains; role:<role>:=<name> exact), text:<t>, label:<l>,
 * placeholder:<p>, testid:<id>, title:<t>, alt:<t>, or any Playwright selector. Only VISIBLE matches
 * count (several screens render a phone and a desktop layout, both in the DOM); --nth N picks one.
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const DOCS = path.join(ROOT, 'docs/userjourney');
const ASSETS = path.join(DOCS, 'assets');
const RUN = path.join(DOCS, '_run');
const BASE = (process.env.JOURNEY_BASE ?? 'http://localhost:8797').replace(/\/$/, '');
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };
const ACTION_TIMEOUT = 10_000;
const IDLE_SHUTDOWN_MS = 4 * 60 * 60 * 1000;

// --- arguments ---------------------------------------------------------------

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--') && ['nth', 'max'].includes(key)) {
        flags[key] = next;
        i += 1;
      } else flags[key] = true;
    } else positional.push(arg);
  }
  return { positional, flags };
}

function journeyId(raw) {
  const id = String(raw ?? '').toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(id)) throw new Error(`Give a journey id like j01 (got ${JSON.stringify(raw)}).`);
  return id;
}

const rel = (file) => path.relative(DOCS, file);
const print = (value) => process.stdout.write(`${JSON.stringify(value, null, 1)}\n`);

// --- the Google stand-in -----------------------------------------------------

function gsiStandIn(persona) {
  const logo =
    '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
  return `(() => {
  const persona = ${JSON.stringify(persona ?? null)};
  let callback = null;
  window.google = window.google || {};
  window.google.accounts = window.google.accounts || {};
  window.google.accounts.id = {
    initialize(options) { callback = options && options.callback; },
    renderButton(parent, options) {
      const dark = options && options.theme === 'filled_black';
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('data-journey-stand-in', 'google');
      button.style.cssText = [
        'display:flex', 'align-items:center', 'gap:10px', 'justify-content:center', 'box-sizing:border-box',
        'width:' + ((options && options.width) || 320) + 'px', 'max-width:100%', 'height:40px', 'padding:0 12px',
        'border-radius:20px', 'cursor:pointer', 'font:500 14px/20px Roboto, "Google Sans", Arial, sans-serif',
        dark ? 'background:#131314;color:#e3e3e3;border:1px solid #8e918f' : 'background:#fff;color:#1f1f1f;border:1px solid #747775',
      ].join(';');
      button.innerHTML = ${JSON.stringify(logo)} + '<span>Continue with Google</span>';
      button.addEventListener('click', () => {
        if (!persona) { window.alert('Journey driver: no persona set. Run: driver.mjs persona <id> <email> <name>'); return; }
        const token = ['fake', 'google', persona.sub, persona.email, '1', persona.name].join(':');
        if (callback) callback({ credential: token, select_by: 'btn' });
      });
      parent.appendChild(button);
    },
    disableAutoSelect() {}, prompt() {}, cancel() {},
    revoke(_hint, done) { if (done) done({ successful: true }); },
  };
})();`;
}

// --- the server: one browser, one tab, one action at a time ------------------

function locate(page, selector, flags) {
  const match = /^(role|text|label|placeholder|testid|title|alt):([\s\S]*)$/.exec(selector);
  let locator;
  if (match) {
    const [, kind, rest] = match;
    const named = (value) => (value.startsWith('=') ? { name: value.slice(1), exact: true } : { name: value });
    if (kind === 'role') {
      const at = rest.indexOf(':');
      locator = at < 0 ? page.getByRole(rest) : page.getByRole(rest.slice(0, at), named(rest.slice(at + 1)));
    } else {
      const exact = rest.startsWith('=');
      const value = exact ? rest.slice(1) : rest;
      const by = { text: 'getByText', label: 'getByLabel', placeholder: 'getByPlaceholder', testid: 'getByTestId', title: 'getByTitle', alt: 'getByAltText' }[kind];
      locator = kind === 'testid' ? page.getByTestId(value) : page[by](value, { exact });
    }
  } else locator = page.locator(selector);
  const visible = locator.filter({ visible: true });
  return flags.nth !== undefined ? visible.nth(Number(flags.nth)) : visible.first();
}

async function settle(page) {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 2500 }).catch(() => {});
  await page.waitForTimeout(250);
}

async function summary(page) {
  const url = page.url();
  const seen = await page
    .evaluate(() => {
      const shown = (el) => {
        const box = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      };
      const texts = (query, limit) =>
        [...document.querySelectorAll(query)]
          .filter(shown)
          .map((el) => el.innerText.trim().replace(/\s+/g, ' ').slice(0, 160))
          .filter(Boolean)
          .slice(0, limit);
      const dialogs = [...document.querySelectorAll('[role=dialog],[role=alertdialog]')]
        .filter(shown)
        .map((el) => (el.getAttribute('aria-label') || el.querySelector('h1,h2,h3,[id$="title"]')?.innerText || 'dialog').trim())
        .slice(0, 3);
      return {
        title: document.title,
        headings: texts('h1,h2,h3', 12),
        dialogs,
        alerts: texts('[role=alert],[role=status],[data-sonner-toast]', 6),
      };
    })
    .catch((error) => ({ note: `page not readable: ${error.message.split('\n')[0]}` }));
  return { url: url.startsWith(BASE) ? url.slice(BASE.length) || '/' : url, ...seen };
}

async function serve(id) {
  const dir = path.join(RUN, id);
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(ASSETS, { recursive: true });
  const personaFile = path.join(dir, 'persona.json');
  const state = {
    persona: fs.existsSync(personaFile) ? JSON.parse(fs.readFileSync(personaFile, 'utf8')) : null,
    errors: [],
    errorShots: 0,
  };
  const note = (line) => {
    state.errors.push(`${new Date().toISOString().slice(11, 19)} ${line}`.slice(0, 400));
    if (state.errors.length > 60) state.errors.shift();
  };

  const context = await chromium.launchPersistentContext(path.join(dir, 'profile'), {
    channel: 'chrome',
    headless: true,
    viewport: PHONE,
    deviceScaleFactor: 1,
    colorScheme: 'light',
    locale: 'en-US',
    timezoneId: 'America/New_York',
  });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE }).catch(() => {});
  await context.route('https://accounts.google.com/gsi/client*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: gsiStandIn(state.persona) }),
  );

  let page = context.pages()[0] ?? (await context.newPage());
  const watch = (target) => {
    target.on('console', (message) => {
      if (message.type() === 'error') note(`console: ${message.text()}`);
    });
    target.on('pageerror', (error) => note(`page error: ${error.message}`));
    target.on('response', (response) => {
      const url = response.url();
      if (url.startsWith(BASE) && response.status() >= 400) note(`${response.status()} ${response.request().method()} ${url.slice(BASE.length)}`);
    });
    target.on('dialog', (dialog) => {
      note(`browser dialog: ${dialog.message()}`);
      dialog.dismiss().catch(() => {});
    });
  };
  watch(page);

  const actions = {
    async persona([email, name, sub]) {
      if (!email || !name) throw new Error('persona <id> <email> <name> [sub]');
      state.persona = { email: email.toLowerCase(), name, sub: sub || `ux-${email.toLowerCase().replace(/[^a-z0-9]/g, '-')}` };
      fs.writeFileSync(personaFile, JSON.stringify(state.persona, null, 1));
      return { persona: state.persona, note: 'takes effect on the next page load' };
    },
    async goto([target]) {
      if (!target) throw new Error('goto <id> <path|url>');
      await page.goto(/^https?:/.test(target) ? target : `${BASE}${target.startsWith('/') ? '' : '/'}${target}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
    },
    async click([selector], flags) {
      await locate(page, selector, flags).click({ timeout: ACTION_TIMEOUT });
    },
    async dblclick([selector], flags) {
      await locate(page, selector, flags).dblclick({ timeout: ACTION_TIMEOUT });
    },
    async hover([selector], flags) {
      await locate(page, selector, flags).hover({ timeout: ACTION_TIMEOUT });
    },
    async check([selector], flags) {
      await locate(page, selector, flags).check({ timeout: ACTION_TIMEOUT });
    },
    async uncheck([selector], flags) {
      await locate(page, selector, flags).uncheck({ timeout: ACTION_TIMEOUT });
    },
    async fill([selector, ...text], flags) {
      await locate(page, selector, flags).fill(text.join(' '), { timeout: ACTION_TIMEOUT });
    },
    async type([selector, ...text], flags) {
      await locate(page, selector, flags).pressSequentially(text.join(' '), { delay: 30, timeout: ACTION_TIMEOUT });
    },
    async select([selector, ...words], flags) {
      // A native <select> takes the value; a custom one (a combobox button) is opened and its option clicked.
      const value = words.join(' ');
      const target = locate(page, selector, flags);
      const native = await target.evaluate((el) => el.tagName === 'SELECT', null, { timeout: ACTION_TIMEOUT });
      if (native) await target.selectOption(value, { timeout: ACTION_TIMEOUT });
      else {
        await target.click({ timeout: ACTION_TIMEOUT });
        await page.getByRole('option', { name: value, exact: true }).filter({ visible: true }).first().click({ timeout: ACTION_TIMEOUT });
      }
    },
    async press([key]) {
      await page.keyboard.press(key);
    },
    async scroll([target], flags) {
      if (/^-?\d+$/.test(target ?? '')) await page.mouse.wheel(0, Number(target));
      else await locate(page, target, flags).scrollIntoViewIfNeeded({ timeout: ACTION_TIMEOUT });
    },
    async wait([target], flags) {
      if (/^\d+$/.test(target ?? '')) await page.waitForTimeout(Math.min(Number(target), 60_000));
      else await locate(page, target, flags).waitFor({ state: 'visible', timeout: 20_000 });
    },
    async back() {
      await page.goBack({ waitUntil: 'domcontentloaded' });
    },
    async reload() {
      await page.reload({ waitUntil: 'domcontentloaded' });
    },
    async newtab() {
      // A fresh tab: cookies and localStorage stay, the tab's sessionStorage (its space) does not.
      const next = await context.newPage();
      watch(next);
      await page.close();
      page = next;
      return { note: 'new tab, blank; goto next' };
    },
    async viewport([size]) {
      await page.setViewportSize(size === 'desktop' ? DESKTOP : PHONE);
    },
    async devuser([email]) {
      // Only for a Worker with sign-in OFF (the app part, on :8787): act as a seeded person, as the
      // e2e suite does. Never part of an audited journey.
      await context.setExtraHTTPHeaders(email ? { 'X-Dev-User': email } : {});
      return { devUser: email ?? null, note: 'takes effect on the next request' };
    },
    async shot([step], flags) {
      if (!step) throw new Error('shot <id> <step> [--landing] [--full]');
      const name = /^\d+$/.test(step) ? `cuj-${id}-step-${step}` : `cuj-${id}-${step.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
      await settle(page);
      const files = [];
      const take = async (suffix) => {
        const file = path.join(ASSETS, `${name}${suffix}.png`);
        await page.screenshot({ path: file, fullPage: Boolean(flags.full), animations: 'disabled', caret: 'hide' });
        files.push(`./assets/${path.basename(file)}`);
      };
      await take('');
      if (flags.landing) {
        await page.setViewportSize(DESKTOP);
        await page.waitForTimeout(500);
        await take('-desktop');
        await page.setViewportSize(PHONE);
        await page.emulateMedia({ colorScheme: 'dark' });
        await page.waitForTimeout(700);
        await take('-dark');
        await page.emulateMedia({ colorScheme: 'light' });
        await page.waitForTimeout(400);
      }
      return { files };
    },
    async text(_args, flags) {
      const all = await page.evaluate(() => document.body.innerText);
      const max = Number(flags.max ?? 4000);
      return { text: all.length > max ? `${all.slice(0, max)}\n… (${all.length - max} more characters; --max N)` : all };
    },
    async aria(_args, flags) {
      const tree = await page.locator('body').ariaSnapshot({ timeout: ACTION_TIMEOUT });
      const max = Number(flags.max ?? 7000);
      return { aria: tree.length > max ? `${tree.slice(0, max)}\n… (${tree.length - max} more characters; --max N)` : tree };
    },
    async url() {
      return {};
    },
    async errors() {
      const list = state.errors.slice();
      state.errors.length = 0;
      return { errors: list };
    },
    async clipboard() {
      return { clipboard: await page.evaluate(() => navigator.clipboard.readText()).catch((error) => `(unreadable: ${error.message})`) };
    },
    async eval([...source]) {
      const value = await page.evaluate(source.join(' '));
      return { value };
    },
  };

  let queue = Promise.resolve();
  let idle = setTimeout(() => shutdown(), IDLE_SHUTDOWN_MS);
  const server = http.createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      clearTimeout(idle);
      idle = setTimeout(() => shutdown(), IDLE_SHUTDOWN_MS);
      queue = queue.then(async () => {
        const { cmd, args = [], flags = {} } = body ? JSON.parse(body) : { cmd: 'ping' };
        let reply;
        try {
          if (cmd === 'ping') reply = { ok: true };
          else if (cmd === 'stop') {
            reply = { ok: true, stopped: id };
            setTimeout(() => shutdown(), 50);
          } else {
            const action = actions[cmd];
            if (!action) throw new Error(`Unknown command ${cmd}.`);
            const extra = (await action(args, flags)) ?? {};
            if (!['shot', 'text', 'aria', 'errors', 'clipboard', 'eval', 'persona', 'url', 'newtab', 'devuser'].includes(cmd)) await settle(page);
            reply = { ok: true, ...extra, ...(cmd === 'persona' || cmd === 'newtab' ? {} : await summary(page)) };
          }
        } catch (error) {
          state.errorShots += 1;
          const file = path.join(dir, `error-${state.errorShots}.png`);
          await page.screenshot({ path: file }).catch(() => {});
          reply = {
            ok: false,
            error: String(error.message ?? error).split('\n').slice(0, 6).join('\n'),
            screenshot: file,
            ...(await summary(page)),
          };
        }
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify(reply));
      });
    });
  });

  async function shutdown() {
    server.close();
    fs.rmSync(path.join(dir, 'server.json'), { force: true });
    await context.close().catch(() => {});
    process.exit(0);
  }
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  server.listen(0, '127.0.0.1', () => {
    fs.writeFileSync(path.join(dir, 'server.json'), JSON.stringify({ port: server.address().port, pid: process.pid }));
  });
}

// --- the client ----------------------------------------------------------------

function readServer(id) {
  const file = path.join(RUN, id, 'server.json');
  if (!fs.existsSync(file)) return null;
  const info = JSON.parse(fs.readFileSync(file, 'utf8'));
  try {
    process.kill(info.pid, 0);
    return info;
  } catch {
    fs.rmSync(file, { force: true });
    return null;
  }
}

async function startServer(id) {
  const dir = path.join(RUN, id);
  fs.mkdirSync(dir, { recursive: true });
  const log = fs.openSync(path.join(dir, 'server.log'), 'a');
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '__serve', id], {
    detached: true,
    stdio: ['ignore', log, log],
    env: { ...process.env, JOURNEY_BASE: BASE },
  });
  child.unref();
  for (let i = 0; i < 150; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const info = readServer(id);
    if (info) return info;
  }
  throw new Error(`The browser for ${id} did not start; see ${path.join(dir, 'server.log')}.`);
}

async function send(id, cmd, args, flags) {
  let info = readServer(id);
  if (!info) {
    if (cmd === 'stop') return { ok: true, note: `${id} was not running` };
    info = await startServer(id);
  }
  const response = await fetch(`http://127.0.0.1:${info.port}/`, { method: 'POST', body: JSON.stringify({ cmd, args, flags }) });
  return response.json();
}

// --- commands that need no browser of their own ---------------------------------

async function sheet(id) {
  const pattern = new RegExp(`^cuj-${id}-step-(\\d+)\\.png$`);
  const steps = fs
    .readdirSync(ASSETS)
    .map((file) => [file, pattern.exec(file)])
    .filter(([, match]) => match)
    .map(([file, match]) => ({ file, n: Number(match[1]) }))
    .sort((a, b) => a.n - b.n);
  if (!steps.length) throw new Error(`No phone steps for ${id} in ${ASSETS}.`);
  const cells = steps
    .map(
      ({ file, n }) =>
        `<figure><div class="frame"><img src="data:image/png;base64,${fs.readFileSync(path.join(ASSETS, file)).toString('base64')}"></div><figcaption>Step ${n}</figcaption></figure>`,
    )
    .join('');
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;padding:16px;background:#f4f4f5;font:600 13px system-ui,sans-serif;color:#18181b}
    h1{font-size:15px;margin:0 0 12px}
    .grid{display:grid;grid-template-columns:repeat(6,195px);gap:12px}
    figure{margin:0}.frame{width:195px;height:422px;overflow:hidden;border:1px solid #d4d4d8;border-radius:8px;background:#fff}
    img{width:195px;display:block}figcaption{padding-top:4px}
  </style><h1>${id.toUpperCase()}: ${steps.length} steps, phone width</h1><div class="grid">${cells}</div>`;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 16 * 2 + 6 * 195 + 5 * 12, height: 200 }, deviceScaleFactor: 1 });
  await page.setContent(html);
  const out = path.join(ASSETS, `cuj-${id}-sheet.png`);
  await page.screenshot({ path: out, fullPage: true });
  await browser.close();
  return { ok: true, sheet: `./assets/${path.basename(out)}`, steps: steps.length };
}

function status(id, words) {
  fs.mkdirSync(RUN, { recursive: true });
  const line = `${new Date().toISOString()} ${id.toUpperCase()} ${words.join(' ')}`.trim();
  fs.appendFileSync(path.join(RUN, 'status.log'), `${line}\n`);
  return { ok: true, logged: line };
}

// --- main ------------------------------------------------------------------------

const [cmd, rawId, ...rest] = process.argv.slice(2);
try {
  if (cmd === '__serve') await serve(journeyId(rawId));
  else if (!cmd || cmd === 'help' || cmd === '--help') {
    process.stdout.write(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]);
  } else {
    const id = journeyId(rawId);
    const { positional, flags } = parseArgs(rest);
    let out;
    if (cmd === 'sheet') out = await sheet(id);
    else if (cmd === 'status') out = status(id, positional);
    else out = await send(id, cmd, positional, flags);
    print(out);
    if (out && out.ok === false) process.exitCode = 1;
  }
} catch (error) {
  print({ ok: false, error: String(error.message ?? error) });
  process.exitCode = 1;
}
