// SECURITY MANIFEST:
//   Environment variables accessed: APP_BASE_URL, MOLTBANK_CREDENTIALS_PATH,
//     MOLTBANK_SKILL_NAME, OPENCLAW_WORKSPACE, HOME (only)
//   External endpoints called: none (utility module, no network calls)
//   Local files read: .project.env, ${MOLTBANK_CREDENTIALS_PATH}/credentials.json
//   Local files written: none

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const DEFAULT_APP_BASE_URL = 'https://app.moltbank.bot';
const PROJECT_FALLBACK = 'moltbank';
const SKILL_ENV_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.project.env');

function parseEnvFile(content) {
  const out = {};
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const unquoted =
      (rawValue.startsWith('"') && rawValue.endsWith('"')) || (rawValue.startsWith("'") && rawValue.endsWith("'"))
        ? rawValue.slice(1, -1)
        : rawValue;

    if (key) {
      out[key] = unquoted;
    }
  }
  return out;
}

function loadSkillEnv() {
  try {
    if (!fs.existsSync(SKILL_ENV_FILE)) {
      return {};
    }
    return parseEnvFile(fs.readFileSync(SKILL_ENV_FILE, 'utf8'));
  } catch {
    return {};
  }
}

const skillEnv = loadSkillEnv();

function getConfigValue(name) {
  const fromProcess = process.env[name]?.trim();
  if (fromProcess) {
    return fromProcess;
  }

  const fromSkillEnv = skillEnv[name]?.trim();
  if (fromSkillEnv) {
    return fromSkillEnv;
  }

  return '';
}

function toUrlCandidate(value) {
  if (!value) return '';
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(value)) {
    return value;
  }
  // Local dev: prefer http when targeting localhost/127.0.0.1 without a scheme.
  if (value.startsWith('localhost') || value.startsWith('127.0.0.1')) {
    return `http://${value}`;
  }
  return `https://${value}`;
}

function normalizeBaseUrl(value) {
  const candidate = toUrlCandidate(value).trim();
  if (!candidate) {
    return DEFAULT_APP_BASE_URL;
  }

  try {
    const parsed = new URL(candidate);
    return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '');
  } catch {
    return candidate.replace(/\/+$/, '') || DEFAULT_APP_BASE_URL;
  }
}

function normalizeProjectFlavor(flavor) {
  const lowered = flavor.toLowerCase();
  if (lowered === 'moltbank') return 'moltbank';
  return '';
}

export function resolveAppBaseUrl() {
  const raw =
    getConfigValue('APP_BASE_URL') || getConfigValue('FONDU_SKILL_BASE_URL') || getConfigValue('FONDU_BASE_URL') || DEFAULT_APP_BASE_URL;
  return normalizeBaseUrl(raw);
}

export function resolveProjectFlavor() {
  const explicit = normalizeProjectFlavor(getConfigValue('OPENCLAW_PROJECT_FLAVOR'));
  if (explicit) {
    return explicit;
  }
  return PROJECT_FALLBACK;
}

export function resolveCredentialsDirName() {
  return '.MoltBank';
}

export function resolveDefaultCredentialsPath() {
  return path.join(os.homedir(), resolveCredentialsDirName(), 'credentials.json');
}

export function resolveCredentialsPath() {
  return getConfigValue('MOLTBANK_CREDENTIALS_PATH') || resolveDefaultCredentialsPath();
}

export function resolveDefaultNativeTokenPriceUrl(symbol) {
  return `${resolveAppBaseUrl()}/api/native-token-price?symbol=${encodeURIComponent(symbol)}`;
}

export function resolveDefaultMcpUrl() {
  return `${resolveAppBaseUrl()}/api/mcp`;
}

export function resolveCredentialsPathHint() {
  return `~/${resolveCredentialsDirName()}/credentials.json`;
}
