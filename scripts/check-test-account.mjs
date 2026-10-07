#!/usr/bin/env node
/**
 * Refuses unless the test Worker deploys into a DIFFERENT Cloudflare account
 * from production.
 *
 * D1's free-tier limits are per account. When tutoring-test-db lived beside
 * tutoring-db, one end-to-end run read about 2.3 million rows, three runs used
 * up the account's 5 million for the day, and production stopped answering
 * real users (2026-10-06). The test side therefore lives in the TEST account,
 * and this check -- run first by scripts/e2e.sh, before anything is built,
 * deployed or wiped -- keeps it there.
 *
 * Reads apps/api/wrangler.jsonc with wrangler's own config reader, so it sees
 * exactly what a deploy would, and there is no second copy to drift.
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const path = fileURLToPath(new URL('../apps/api/wrangler.jsonc', import.meta.url));
// wrangler is a dependency of the API workspace, so resolve it from there.
const require = createRequire(path);
const { experimental_readRawConfig } = require('wrangler');

let config;
try {
  config = experimental_readRawConfig({ config: path }).rawConfig;
} catch {
  config = null;
}
if (!config) {
  console.error(`Refusing to run: could not read ${path}.`);
  process.exit(1);
}

const production = config.account_id;
const test = config.env?.['tutoring-test']?.account_id;

if (!production || !test) {
  console.error(
    'Refusing to run: wrangler.jsonc must name the production account (top-level account_id) ' +
      'and the TEST account (env["tutoring-test"].account_id).',
  );
  process.exit(1);
}
if (production === test) {
  console.error(
    'Refusing to run: tutoring-test is configured for the PRODUCTION account. Its database ' +
      "would spend production's daily D1 quota. Point it at the TEST account.",
  );
  process.exit(1);
}

console.log(`    test account ${test} (production is ${production})`);
