#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { resolveAppBaseUrl, resolveCredentialsPath } from './openclaw-runtime-config.mjs';

const rawArgs = process.argv.slice(2);
const positionalArgs = [];
let saveCredentials = true;
let emitRawToken = false;
let credentialsPathOverride = null;

for (let i = 0; i < rawArgs.length; i += 1) {
  const arg = rawArgs[i];
  if (arg === '--save' || arg === '--write-credentials') {
    saveCredentials = true;
    continue;
  }
  if (arg === '--no-save') {
    saveCredentials = false;
    continue;
  }
  if (arg === '--emit-token') {
    saveCredentials = false;
    emitRawToken = true;
    continue;
  }
  if (arg === '--credentials-path') {
    const next = rawArgs[i + 1]?.trim();
    if (!next) fail('--credentials-path requires a value.');
    credentialsPathOverride = next;
    i += 1;
    continue;
  }
  positionalArgs.push(arg);
}

const deviceCode = positionalArgs[0]?.trim();
const timeoutSecondsInput = positionalArgs[1]?.trim();
const intervalSecondsInput = positionalArgs[2]?.trim();
const baseUrl = resolveAppBaseUrl();
const defaultCredentialsPath = resolveCredentialsPath();
const credentialsPath = credentialsPathOverride || defaultCredentialsPath;

function fail(message, extra = {}) {
  console.error(JSON.stringify({ ok: false, error: message, ...extra }));
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function loadCredentials(filePath) {
  if (!fs.existsSync(filePath)) {
    return { organizations: [], active_organization: '' };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : { organizations: [], active_organization: '' };
  } catch (error) {
    fail('Could not parse credentials.json while saving OAuth token.', {
      credentialsPath: filePath,
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

function saveTokenToCredentials(payload) {
  if (!payload || typeof payload.access_token !== 'string' || !payload.access_token.trim()) {
    fail('OAuth token response did not include a usable access token.');
  }
  if (!payload.organization_name || typeof payload.organization_name !== 'string') {
    fail('OAuth token response did not include organization_name.');
  }

  const organizationName = payload.organization_name.trim();
  const accessToken = payload.access_token.trim();
  const timestamp = nowIso();
  const credentials = loadCredentials(credentialsPath);

  if (!Array.isArray(credentials.organizations)) {
    credentials.organizations = [];
  }

  const existingIndex = credentials.organizations.findIndex((org) => org?.name === organizationName);
  const existingOrg = existingIndex >= 0 && credentials.organizations[existingIndex] ? credentials.organizations[existingIndex] : {};
  const nextOrg = {
    ...existingOrg,
    name: organizationName,
    access_token: accessToken,
    last_used: timestamp
  };

  if (existingIndex >= 0) {
    credentials.organizations[existingIndex] = nextOrg;
  } else {
    credentials.organizations.push(nextOrg);
  }

  credentials.active_organization = organizationName;

  fs.mkdirSync(path.dirname(credentialsPath), { recursive: true });
  fs.writeFileSync(credentialsPath, `${JSON.stringify(credentials, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });

  return {
    organizationName,
    credentialsPath
  };
}

if (!deviceCode || !/^[a-fA-F0-9]{64}$/.test(deviceCode)) {
  fail('deviceCode must be the 64-character hex device_code returned by /api/oauth/device/code.');
}

const timeoutSeconds = timeoutSecondsInput ? Number(timeoutSecondsInput) : 900;
if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
  fail('timeoutSeconds must be a positive number.');
}

const intervalSeconds = intervalSecondsInput ? Number(intervalSecondsInput) : 5;
if (!Number.isFinite(intervalSeconds) || intervalSeconds <= 0) {
  fail('intervalSeconds must be a positive number.');
}

const deadline = Date.now() + timeoutSeconds * 1000;

while (Date.now() < deadline) {
  let response;
  try {
    response = await fetch(`${baseUrl}/api/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ device_code: deviceCode })
    });
  } catch {
    await sleep(intervalSeconds * 1000);
    continue;
  }

  const raw = await response.text();
  let payload = null;
  if (raw.trim()) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = null;
    }
  }

  if (response.ok) {
    if (!payload || typeof payload.access_token !== 'string') {
      fail('OAuth token response did not include an access token.', {
        status: response.status,
        raw
      });
    }

    if (saveCredentials) {
      const saved = saveTokenToCredentials(payload);
      console.log(
        JSON.stringify({
          ok: true,
          saved: true,
          organization_name: saved.organizationName,
          token_type: typeof payload.token_type === 'string' ? payload.token_type : 'Bearer',
          credentials_path: saved.credentialsPath
        })
      );
      process.exit(0);
    }

    if (emitRawToken) {
      console.log(JSON.stringify(payload));
      process.exit(0);
    }

    const redactedPayload = {
      ...payload,
      access_token: '[REDACTED]'
    };
    console.log(JSON.stringify(redactedPayload));
    process.exit(0);
  }

  const errorCode = payload && typeof payload.error === 'string' ? payload.error : null;

  if (response.status === 400) {
    if (errorCode === 'authorization_pending') {
      await sleep(intervalSeconds * 1000);
      continue;
    }

    if (errorCode === 'expired_token') {
      fail('Token expired. Restart from Step 1.', {
        status: response.status,
        payload
      });
    }

    fail('OAuth token polling failed.', {
      status: response.status,
      payload: payload ?? raw
    });
  }

  await sleep(intervalSeconds * 1000);
}

fail('Timed out waiting for OAuth approval. Restart only if the device code has actually expired.');
