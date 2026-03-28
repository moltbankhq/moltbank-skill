// SECURITY MANIFEST:
//   Environment variables accessed: MOLTBANK_CREDENTIALS_PATH, HOME (only)
//   External endpoints called: none
//   Local files read: ${MOLTBANK_CREDENTIALS_PATH}/credentials.json
//   Local files written: none

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

const defaultCredsPath = path.join(os.homedir(), '.MoltBank', 'credentials.json');
const credsPath = process.env.MOLTBANK_CREDENTIALS_PATH || defaultCredsPath;

if (!fs.existsSync(credsPath)) {
  fail(`credentials.json not found at ${credsPath}`);
}

let raw;
try {
  raw = fs.readFileSync(credsPath, 'utf8');
} catch {
  fail(`failed to read ${credsPath}`);
}

let json;
try {
  json = JSON.parse(raw);
} catch {
  fail('credentials.json is not valid JSON');
}

const activeOrg = json?.active_organization;
if (!activeOrg || activeOrg === 'null') {
  fail('active_organization is missing in credentials.json');
}

const organizations = Array.isArray(json?.organizations) ? json.organizations : [];
const org = organizations.find((o) => o?.name === activeOrg);
const token = org?.access_token;

if (!token || token === 'null') {
  fail(`access_token missing for active_organization '${activeOrg}'`);
}

process.stdout.write(String(token));
process.stdout.write('\n');
