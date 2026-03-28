#!/usr/bin/env node
// SECURITY MANIFEST:
//   Environment variables accessed: MOLTBANK_CREDENTIALS_PATH, APP_BASE_URL,
//     MOLTBANK_SKILL_NAME, OPENCLAW_WORKSPACE, HOME (only)
//   External endpoints called: none
//   Local files read: ${MOLTBANK_CREDENTIALS_PATH}/credentials.json
//   Local files written: ${MOLTBANK_CREDENTIALS_PATH}/credentials.json (signer key storage)

import fs from 'fs';

import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { resolveCredentialsPath, resolveCredentialsPathHint } from './openclaw-runtime-config.mjs';

function fail(message, extra = {}) {
  console.log(JSON.stringify({ ok: false, error: message, ...extra }));
  process.exit(1);
}

const credentialsPath = resolveCredentialsPath();
const credentialsPathHint = resolveCredentialsPathHint();

if (!fs.existsSync(credentialsPath)) {
  fail(`Missing ${credentialsPathHint}. Complete onboarding first.`, { credentialsPath });
}

let credentials;
try {
  credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
} catch (error) {
  fail(`Could not parse ${credentialsPathHint}.`, {
    credentialsPath,
    details: error instanceof Error ? error.message : String(error)
  });
}

const activeOrganizationName = credentials?.active_organization;
if (!activeOrganizationName || typeof activeOrganizationName !== 'string') {
  fail('credentials.json is missing active_organization.', { credentialsPath });
}

if (!Array.isArray(credentials.organizations)) {
  fail('credentials.json is missing organizations[].', { credentialsPath, activeOrganization: activeOrganizationName });
}

const org = credentials.organizations.find((item) => item?.name === activeOrganizationName);
if (!org) {
  fail('Active organization was not found in credentials.json.', {
    credentialsPath,
    activeOrganization: activeOrganizationName
  });
}

let rawPrivateKey = typeof org.x402_signer_private_key === 'string' ? org.x402_signer_private_key.trim() : '';
let created = false;

if (!rawPrivateKey) {
  rawPrivateKey = generatePrivateKey();
  org.x402_signer_private_key = rawPrivateKey;
  created = true;
}

const privateKey = rawPrivateKey.startsWith('0x') ? rawPrivateKey : `0x${rawPrivateKey}`;
let account;
try {
  account = privateKeyToAccount(privateKey);
} catch (error) {
  fail('x402_signer_private_key is invalid for the active organization.', {
    activeOrganization: activeOrganizationName,
    details: error instanceof Error ? error.message : String(error)
  });
}

const signerAddress = account.address;

if (!org.x402_wallet || typeof org.x402_wallet !== 'object') {
  org.x402_wallet = {};
}

org.x402_wallet.address = signerAddress;

try {
  fs.writeFileSync(credentialsPath, `${JSON.stringify(credentials, null, 2)}\n`, 'utf8');
} catch (error) {
  fail(`Could not write ${credentialsPathHint}.`, {
    credentialsPath,
    details: error instanceof Error ? error.message : String(error)
  });
}

console.log(
  JSON.stringify({
    ok: true,
    activeOrganization: activeOrganizationName,
    signerAddress,
    created,
    reused: !created,
    credentialsPath
  })
);
