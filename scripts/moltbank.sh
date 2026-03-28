#!/usr/bin/env bash

# SECURITY MANIFEST:
#   Environment variables accessed: MOLTBANK, MOLTBANK_CREDENTIALS_PATH, MOLTBANK_SKILL_NAME,
#     APP_BASE_URL, OPENCLAW_WORKSPACE, HOME (only)
#   External endpoints called: none (delegates to mcporter)
#   Local files read: ${MOLTBANK_CREDENTIALS_PATH}/credentials.json
#   Local files written: none

# Wrapper for mcporter that resolves MOLTBANK from active organization.

set -euo pipefail

# Ensure we run from the skill root directory so mcporter finds assets/mcporter.json
cd "$(dirname "$0")/.."

SKILL_DIR="$(pwd)"
SKILL_ENV_FILE="${SKILL_DIR}/.project.env"
MCPORTER_CONFIG_PATH="${SKILL_DIR}/assets/mcporter.json"

if [ -f "$SKILL_ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$SKILL_ENV_FILE"
  set +a
fi

normalize_base_url() {
  local raw="${1:-}"
  raw="${raw%/}"
  if [ -z "$raw" ]; then
    echo "https://app.moltbank.bot"
    return
  fi

  if [[ "$raw" != *"://"* ]]; then
    # Local dev: prefer http when targeting localhost/127.0.0.1 without a scheme.
    if [[ "$raw" == localhost* || "$raw" == 127.0.0.1* ]]; then
      raw="http://${raw}"
    else
      raw="https://${raw}"
    fi
  fi
  echo "${raw%/}"
}

resolve_project_flavor() {
  # Single flavor: always moltbank
  echo "moltbank"
}

resolve_default_credentials_path() {
  echo "$HOME/.MoltBank/credentials.json"
}

resolve_default_skill_name() {
  echo "MoltBank"
}

normalize_credentials_path() {
  local raw="${1:-}"
  local slashified drive rest candidate

  if [ -z "$raw" ]; then
    echo "$raw"
    return
  fi

  if [ -f "$raw" ]; then
    echo "$raw"
    return
  fi

  slashified="${raw//\\//}"

  if [[ "$slashified" =~ ^([A-Za-z]):/(.*)$ ]]; then
    drive="${BASH_REMATCH[1],,}"
    rest="${BASH_REMATCH[2]}"
    for candidate in "/mnt/$drive/$rest" "/$drive/$rest"; do
      if [ -f "$candidate" ]; then
        echo "$candidate"
        return
      fi
    done
  fi

  if [[ "$slashified" =~ ^([A-Za-z]):(.*)$ ]]; then
    drive="${BASH_REMATCH[1],,}"
    rest="${BASH_REMATCH[2]}"
    rest="${rest#/}"
    for candidate in "/mnt/$drive/$rest" "/$drive/$rest"; do
      if [ -f "$candidate" ]; then
        echo "$candidate"
        return
      fi
    done
  fi

  echo "$raw"
}

path_hint() {
  local value="$1"
  if [[ "$value" == "$HOME/"* ]]; then
    echo "~/${value#"$HOME/"}"
    return
  fi
  echo "$value"
}

APP_BASE_URL_RESOLVED="$(normalize_base_url "${APP_BASE_URL:-${FONDU_BASE_URL:-${FONDU_SKILL_BASE_URL:-}}}")"
PROJECT_FLAVOR="$(resolve_project_flavor "$APP_BASE_URL_RESOLVED")"
DEFAULT_CREDENTIALS_PATH="$(resolve_default_credentials_path "$PROJECT_FLAVOR")"
CREDENTIALS_PATH="$(normalize_credentials_path "${MOLTBANK_CREDENTIALS_PATH:-$DEFAULT_CREDENTIALS_PATH}")"
CREDENTIALS_PATH_HINT="$(path_hint "$CREDENTIALS_PATH")"
DEFAULT_SKILL_NAME="$(resolve_default_skill_name "$PROJECT_FLAVOR")"
SKILL_NAME="${MOLTBANK_SKILL_NAME:-${OPENCLAW_SKILL_NAME:-$DEFAULT_SKILL_NAME}}"

export APP_BASE_URL="${APP_BASE_URL:-$APP_BASE_URL_RESOLVED}"
export OPENCLAW_PROJECT_FLAVOR="${OPENCLAW_PROJECT_FLAVOR:-$PROJECT_FLAVOR}"
export MOLTBANK_CREDENTIALS_PATH="$CREDENTIALS_PATH"
export MOLTBANK_SKILL_NAME="$SKILL_NAME"

# --- Credential Resolution (detect-and-fallback) ---
#
# Host:   credentials.json exists at CREDENTIALS_PATH → multi-org, jq resolves token.
# Sandbox: plugin usually injects MOLTBANK_CREDENTIALS_PATH to a workspace-mounted,
#          skill-local credentials file. Wrapper resolves token/private key from that file.
# Legacy sandbox: no file, but MOLTBANK is set → single org; mcporter substitutes
#                Authorization: Bearer ${MOLTBANK} (same effect as AUTH_HEADER in spec).
# Neither: no file, no env var → real MCP calls fail with setup instructions below.
#          Exception: `mcporter list` is allowed with a placeholder token (install check).
#
# CREDENTIALS_PATH already honors MOLTBANK_CREDENTIALS_PATH and .project.env above.
if [ -f "$CREDENTIALS_PATH" ]; then
  MOLTBANK_MODE="host"
elif [ -n "${MOLTBANK:-}" ]; then
  MOLTBANK_MODE="sandbox"
else
  MOLTBANK_MODE="none"
fi
# --- End Credential Resolution ---

sandbox_disallow_org_override() {
  return 0
}

ensure_mcporter_config_url() {
  local config_file="assets/mcporter.json"
  local expected_url="${APP_BASE_URL}/api/mcp"
  local tmp_file

  if [ ! -f "$config_file" ]; then
    return
  fi

  if ! command -v jq >/dev/null 2>&1; then
    return
  fi

  tmp_file="$(mktemp "${config_file}.XXXXXX")"
  if jq --arg url "$expected_url" '.mcpServers.MoltBank.url = $url' "$config_file" > "$tmp_file"; then
    mv "$tmp_file" "$config_file"
  else
    rm -f "$tmp_file"
  fi
}

ensure_mcporter_config_url

usage() {
  cat <<'USAGE'
Usage:
  ./scripts/moltbank.sh <mcporter-subcommand> [args...]

Examples:
  ./scripts/moltbank.sh list MoltBank
  ./scripts/moltbank.sh call MoltBank.get_balance organizationName="Acme" date="2026-02-25"
USAGE
}

emit_known_error_guidance() {
  local output="$1"

  if [[ "$output" == *"Failed to resolve header 'Authorization'"* && "$output" == *"MOLTBANK"* ]]; then
    echo "AGENT INSTRUCTION: MoltBank auth failed. The wrapper uses ${CREDENTIALS_PATH_HINT} (host) when present; otherwise verify the plugin-managed sandbox credentials path and rerun setup." >&2
  fi

  if [[ "$output" == *"Agent authorization context is required."* ]]; then
    echo "AGENT INSTRUCTION: Stop retrying this action. It requires an OpenClaw agent API-key context, not a plain user token." >&2
  fi

  if [[ "$output" == *"Denied by authorization policy ("* ]]; then
    echo "AGENT INSTRUCTION: Stop retrying blindly. Explain the policy denial and ask the user to update/approve authorization policy." >&2
  fi
}

run_mcporter() {
  local output
  local status

  set +e
  output="$(mcporter --config "$MCPORTER_CONFIG_PATH" "$@" 2>&1)"
  status=$?
  set -e

  if [ -n "$output" ]; then
    printf '%s\n' "$output"
  fi
  emit_known_error_guidance "$output"
  return $status
}

resolve_active_org_from_credentials() {
  jq -r '.active_organization // empty' "$CREDENTIALS_PATH" 2>/dev/null || true
}

resolve_api_key_for_org() {
  local org="$1"
  jq -r --arg org "$org" 'first(.organizations[]? | select(.name == $org) | .access_token) // empty' "$CREDENTIALS_PATH" 2>/dev/null || true
}

emit_device_flow_prompt() {
  local verification_uri="$1"
  local user_code="$2"
  local device_code="$3"
  local expires_at="${4:-0}"
  local now minutes_left

  now="$(date +%s)"

  echo "[moltbank] ACTION REQUIRED: link this agent to your MoltBank account" >&2
  echo "[moltbank] 1) Open: ${verification_uri}" >&2
  echo "[moltbank] 2) Enter code: ${user_code}" >&2

  if [ "$expires_at" -gt "$now" ] 2>/dev/null; then
    minutes_left="$(( (expires_at - now + 59) / 60 ))"
    if [ "$minutes_left" -lt 1 ]; then
      minutes_left=1
    fi
    echo "[moltbank] 3) Code expires in ~${minutes_left} min" >&2
  fi

  echo "[moltbank] 4) After approval, rerun your MoltBank command." >&2
  echo "AGENT INSTRUCTION: Tell the user to open ${verification_uri} and enter code ${user_code}. Then rerun the same request." >&2
  echo "AGENT INSTRUCTION: If the code expires, rerun the same MoltBank command to generate a new code." >&2
}

show_pending_device_flow_prompt_if_available() {
  local pending_path="${SKILL_DIR}/.oauth_device_code.json"
  local parsed device_code user_code verification_uri expires_at

  if [ ! -f "$pending_path" ]; then
    return 1
  fi

  parsed="$(node -e '
const fs = require("fs");
const p = process.argv[1];
try {
  const now = Math.floor(Date.now() / 1000);
  const payload = JSON.parse(fs.readFileSync(p, "utf8"));
  const deviceCode = typeof payload.device_code === "string" ? payload.device_code : "";
  const userCode = typeof payload.user_code === "string" ? payload.user_code : "";
  const verificationUri = typeof payload.verification_uri === "string" ? payload.verification_uri : "";
  const expiresAt = Number.isFinite(payload.expires_at) ? Math.floor(payload.expires_at) : 0;
  if (!deviceCode || !userCode || !verificationUri || expiresAt <= now + 5) process.exit(1);
  process.stdout.write([deviceCode, userCode, verificationUri, String(expiresAt)].join("\t"));
} catch {
  process.exit(1);
}
' "$pending_path" 2>/dev/null || true)"

  if [ -z "$parsed" ]; then
    rm -f "$pending_path" 2>/dev/null || true
    return 1
  fi

  IFS=$'\t' read -r device_code user_code verification_uri expires_at <<< "$parsed"
  emit_device_flow_prompt "$verification_uri" "$user_code" "$device_code" "$expires_at"
  return 0
}

request_device_flow_prompt() {
  local oauth_output oauth_status parsed device_code user_code verification_uri expires_in expires_at pending_path

  if ! command -v node >/dev/null 2>&1; then
    return 1
  fi

  if [ ! -f "./scripts/request-oauth-device-code.mjs" ]; then
    return 1
  fi

  set +e
  oauth_output="$(APP_BASE_URL="$APP_BASE_URL" MOLTBANK_CREDENTIALS_PATH="$CREDENTIALS_PATH" node "./scripts/request-oauth-device-code.mjs" 2>&1)"
  oauth_status=$?
  set -e

  if [ "$oauth_status" -ne 0 ]; then
    echo "[moltbank] could not request OAuth device code automatically." >&2
    if [ -n "$oauth_output" ]; then
      echo "$oauth_output" >&2
    fi
    return 1
  fi

  parsed="$(printf '%s' "$oauth_output" | node -e '
const fs = require("fs");
const raw = fs.readFileSync(0, "utf8");
try {
  const payload = JSON.parse(raw.trim());
  const deviceCode = typeof payload.device_code === "string" ? payload.device_code : "";
  const userCode = typeof payload.user_code === "string" ? payload.user_code : "";
  const verificationUri = typeof payload.verification_uri === "string" ? payload.verification_uri : "";
  const expiresInRaw = payload.expires_in;
  const expiresInNumber = typeof expiresInRaw === "number" ? expiresInRaw : Number(expiresInRaw ?? 900);
  const safeExpiresIn = Number.isFinite(expiresInNumber) && expiresInNumber > 0 ? Math.floor(expiresInNumber) : 900;
  if (!deviceCode || !userCode || !verificationUri) process.exit(1);
  process.stdout.write([deviceCode, userCode, verificationUri, String(safeExpiresIn)].join("\t"));
} catch {
  process.exit(1);
}
' 2>/dev/null || true)"

  if [ -z "$parsed" ]; then
    return 1
  fi

  IFS=$'\t' read -r device_code user_code verification_uri expires_in <<< "$parsed"
  expires_at="$(( $(date +%s) + expires_in ))"
  pending_path="${SKILL_DIR}/.oauth_device_code.json"

  node -e '
const fs = require("fs");
const [path, deviceCode, userCode, verificationUri, expiresAtRaw] = process.argv.slice(1);
const expiresAt = Number.parseInt(expiresAtRaw, 10);
const payload = {
  device_code: deviceCode,
  user_code: userCode,
  verification_uri: verificationUri,
  expires_at: Number.isFinite(expiresAt) ? expiresAt : 0
};
fs.writeFileSync(path, JSON.stringify(payload, null, 2) + "\n", "utf8");
' "$pending_path" "$device_code" "$user_code" "$verification_uri" "$expires_at" >/dev/null 2>&1 || true

  emit_device_flow_prompt "$verification_uri" "$user_code" "$device_code" "$expires_at"
  return 0
}

if [ "$#" -eq 0 ]; then
  usage
  exit 1
fi

if ! command -v mcporter >/dev/null 2>&1; then
  echo "Error: mcporter is not installed or not on PATH." >&2
  echo "AGENT INSTRUCTION: Tell the user to install mcporter via OpenClaw settings." >&2
  exit 1
fi

# `mcporter list` is used for install checks and should not fail due to missing env substitution.
if [ "$1" = "list" ]; then
  if command -v jq >/dev/null 2>&1 && [ -f "$CREDENTIALS_PATH" ]; then
    list_active_org="$(resolve_active_org_from_credentials)"
    if [ -n "$list_active_org" ] && [ "$list_active_org" != "null" ]; then
      list_api_key="$(resolve_api_key_for_org "$list_active_org")"
      if [ -n "$list_api_key" ] && [ "$list_api_key" != "null" ]; then
        export MOLTBANK="$list_api_key"
      fi
    fi
  fi

  # Keep list usable before onboarding by satisfying mcporter header substitution.
  if [ -z "${MOLTBANK:-}" ]; then
    export MOLTBANK="__MOLTBANK_PLACEHOLDER__"
  fi

  run_mcporter "$@"
  exit $?
fi

# Sandbox mode: bearer token is already MOLTBANK (mcporter reads assets/mcporter.json headers).
if [ "$MOLTBANK_MODE" = "sandbox" ]; then
  sandbox_disallow_org_override "$@"
  run_mcporter "$@"
  exit $?
fi

# Neither mode: credentials.json missing and MOLTBANK not set.
if [ "$MOLTBANK_MODE" = "none" ]; then
  if show_pending_device_flow_prompt_if_available; then
    exit 1
  fi

  if request_device_flow_prompt; then
    exit 1
  fi

  echo "ERROR: MoltBank credentials not found." >&2
  echo "" >&2
  echo "Option A (recommended): Run the OAuth onboarding flow on your host machine:" >&2
  echo "  cd $(dirname "$0")/.." >&2
  echo "  node ./scripts/request-oauth-device-code.mjs" >&2
  echo "  node ./scripts/poll-oauth-token.mjs \"<deviceCode>\" --save" >&2
  echo "" >&2
  echo "Option B (sandbox/Docker): Verify the plugin-managed sandbox credentials path:" >&2
  echo "  Re-run: moltbank setup" >&2
  echo "  If it still fails, ask your administrator to verify the MoltBank OpenClaw plugin configuration." >&2
  exit 1
fi

# Host mode: use credentials.json + active_organization to resolve MOLTBANK.
if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required to resolve MOLTBANK from ${CREDENTIALS_PATH_HINT}." >&2
  exit 1
fi

if [ ! -f "$CREDENTIALS_PATH" ]; then
  echo "Error: credentials file not found at ${CREDENTIALS_PATH}." >&2
  echo "AGENT INSTRUCTION: The user is not authenticated. You MUST read references/onboarding.md right now to initiate the OAuth device flow." >&2
  exit 1
fi

# Extract active organization safely (preventing set -e from killing the script early)
active_org="${ACTIVE_ORG_OVERRIDE:-}"
if [ -z "$active_org" ]; then
  active_org="$(resolve_active_org_from_credentials)"
fi

if [ -z "$active_org" ] || [ "$active_org" = "null" ]; then
  echo "Error: active_organization is missing in ${CREDENTIALS_PATH_HINT}." >&2
  echo "AGENT INSTRUCTION: You MUST read references/setup.md to help the user configure their active organization." >&2
  exit 1
fi

# Extract the actual token for the active organization
api_key="$(resolve_api_key_for_org "$active_org")"

if [ -z "$api_key" ] || [ "$api_key" = "null" ]; then
  echo "Error: no access_token found for active organization '${active_org}'." >&2
  echo "AGENT INSTRUCTION: The token is missing or corrupted. You MUST read references/onboarding.md to re-authenticate the user." >&2
  exit 1
fi

# Execute mcporter with the token injected
export MOLTBANK="$api_key"
run_mcporter "$@"
exit $?
