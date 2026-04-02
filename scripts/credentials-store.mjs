// SECURITY MANIFEST:
//   Environment variables accessed: none
//   External endpoints called: none (utility module, no network calls)
//   Local files read: caller-provided credentials JSON path
//   Local files written: caller-provided credentials JSON path

import fs from 'fs';
import path from 'path';

function emptyCredentials() {
  return { organizations: [], active_organization: '' };
}

function parseCredentials(raw) {
  const parsed = JSON.parse(raw);
  return parsed && typeof parsed === 'object' ? parsed : emptyCredentials();
}

export function readCredentialsFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return emptyCredentials();
  }

  return parseCredentials(fs.readFileSync(filePath, 'utf8'));
}

export function readCredentialsFileIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return parseCredentials(fs.readFileSync(filePath, 'utf8'));
}

export function writeCredentialsFile(filePath, credentials, options = {}) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const writeOptions = { encoding: 'utf8' };
  if (typeof options.mode === 'number') {
    writeOptions.mode = options.mode;
  }

  fs.writeFileSync(filePath, `${JSON.stringify(credentials, null, 2)}\n`, writeOptions);
}
