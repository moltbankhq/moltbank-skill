#!/usr/bin/env node
// SECURITY MANIFEST:
//   Environment variables accessed: APP_BASE_URL, MOLTBANK_SKILL_NAME, OPENCLAW_WORKSPACE, HOME (only)
//   External endpoints called: ${APP_BASE_URL}/api/auth/device/code (only)
//   Local files read: none
//   Local files written: none

import { resolveAppBaseUrl } from './openclaw-runtime-config.mjs';

const baseUrl = resolveAppBaseUrl();

function fail(message, extra = {}) {
  console.error(JSON.stringify({ ok: false, error: message, ...extra }));
  process.exit(1);
}

let response;
try {
  response = await fetch(`${baseUrl}/api/oauth/device/code`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: '{}'
  });
} catch (error) {
  fail('Network error while requesting OAuth device code.', {
    details: error instanceof Error ? error.message : String(error)
  });
}

const raw = await response.text();
let payload = null;

if (raw.trim()) {
  try {
    payload = JSON.parse(raw);
  } catch {
    fail('OAuth device code endpoint returned non-JSON output.', {
      status: response.status,
      raw
    });
  }
}

if (!response.ok) {
  fail('OAuth device code request failed.', {
    status: response.status,
    payload: payload ?? raw
  });
}

if (
  !payload ||
  typeof payload.device_code !== 'string' ||
  typeof payload.user_code !== 'string' ||
  typeof payload.verification_uri !== 'string'
) {
  fail('OAuth device code response is missing required fields.', {
    status: response.status,
    payload
  });
}

console.log(JSON.stringify(payload));
