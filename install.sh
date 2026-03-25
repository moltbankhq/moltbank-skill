#!/usr/bin/env bash
# Installs/updates the MoltBank OpenClaw plugin from supported sources
# (npm registry package or local path/archive).

set -euo pipefail

trap 'echo "[install.sh] ERROR line ${LINENO}: ${BASH_COMMAND}" >&2' ERR

RAW_BASE_URL="${APP_BASE_URL:-${FONDU_SKILL_BASE_URL:-${FONDU_BASE_URL:-https://app.moltbank.bot}}}"
SKILL_NAME="${MOLTBANK_SKILL_NAME:-${OPENCLAW_SKILL_NAME:-MoltBank}}"
PLUGIN_ID="${MOLTBANK_PLUGIN_ID:-moltbank}"
PLUGIN_SPEC="${MOLTBANK_PLUGIN_SPEC:-${OPENCLAW_PLUGIN_SPEC:-@moltbank/moltbank}}"
PLUGIN_LOCAL_PATH="${MOLTBANK_PLUGIN_LOCAL_PATH:-}"
PLUGIN_INSTALL_MODE="${MOLTBANK_PLUGIN_INSTALL_MODE:-link}" # link|copy
PLUGIN_GIT_URL="${MOLTBANK_PLUGIN_GIT_URL:-https://github.com/CapuzR/moltbank-npm.git}"
PLUGIN_CLONE_DIR="${MOLTBANK_PLUGIN_CLONE_DIR:-./moltbank-npm}"

LAST_INSTALL_OUTPUT=""

log_step() {
  printf '=> %s\n' "$1"
}

log_warn() {
  printf '[WARN] %s\n' "$1"
}

log_error() {
  printf '[ERROR] %s\n' "$1" >&2
}

normalize_base_url() {
  local value="${1:-}"
  value="${value%/}"
  if [ -z "$value" ]; then
    echo "https://app.moltbank.bot"
    return
  fi

  if [[ "$value" != *"://"* ]]; then
    if [[ "$value" == localhost* || "$value" == 127.0.0.1* ]]; then
      value="http://${value}"
    else
      value="https://${value}"
    fi
  fi

  echo "${value%/}"
}

is_already_installed_output() {
  [[ "$LAST_INSTALL_OUTPUT" == *"already installed"* ]] || [[ "$LAST_INSTALL_OUTPUT" == *"already exists"* ]]
}

run_openclaw_plugins_install() {
  set +e
  LAST_INSTALL_OUTPUT="$(openclaw plugins install "$@" 2>&1)"
  local status=$?
  set -e

  if [ -n "$LAST_INSTALL_OUTPUT" ]; then
    printf '%s\n' "$LAST_INSTALL_OUTPUT"
  fi

  return "$status"
}

resolve_local_plugin_path() {
  local candidate

  if [ -n "$PLUGIN_LOCAL_PATH" ] && [ -d "$PLUGIN_LOCAL_PATH" ]; then
    echo "$PLUGIN_LOCAL_PATH"
    return
  fi

  for candidate in ./moltbank-npm ./moltbank-npm-main; do
    if [ -d "$candidate" ]; then
      echo "$candidate"
      return
    fi
  done

  echo ""
}

install_from_local_path() {
  local local_path="$1"

  if [ "$PLUGIN_INSTALL_MODE" = "copy" ]; then
    run_openclaw_plugins_install "$local_path"
    return $?
  fi

  # Default: link mode so updates are just git pull.
  run_openclaw_plugins_install -l "$local_path"
}

install_from_git_clone() {
  local clone_url="$1"
  local clone_dir="$2"

  if ! command -v git >/dev/null 2>&1; then
    log_warn "git is not available; skipping git clone fallback."
    return 1
  fi

  if [ -d "$clone_dir/.git" ]; then
    refresh_local_plugin_repo "$clone_dir"
  elif [ -d "$clone_dir" ]; then
    log_warn "Clone directory exists but is not a git repo: ${clone_dir}. Trying direct local install."
  else
    log_step "Cloning MoltBank plugin repo: ${clone_url} -> ${clone_dir}"
    set +e
    local clone_output
    clone_output="$(git clone "$clone_url" "$clone_dir" 2>&1)"
    local clone_status=$?
    set -e
    if [ "$clone_status" -ne 0 ]; then
      printf '%s\n' "$clone_output"
      log_warn "git clone fallback failed."
      return 1
    fi
  fi

  install_from_local_path "$clone_dir"
}

refresh_local_plugin_repo() {
  local local_path="$1"
  if [ ! -d "$local_path/.git" ]; then
    return 0
  fi
  if ! command -v git >/dev/null 2>&1; then
    return 0
  fi

  set +e
  git -C "$local_path" pull --ff-only >/dev/null 2>&1
  local pull_status=$?
  set -e
  if [ "$pull_status" -ne 0 ]; then
    log_warn "Could not fast-forward local plugin repo at ${local_path}; continuing with current files."
  else
    log_step "Local plugin repo refreshed: ${local_path}"
  fi
}

cleanup_stale_moltbank_load_paths() {
  local config_path="$HOME/.openclaw/openclaw.json"
  if [ ! -f "$config_path" ]; then
    return 0
  fi

  local cleanup_output=""
  set +e
  cleanup_output="$(node - "$config_path" <<'NODE'
const fs = require('fs');
const configPath = process.argv[2];

try {
  const raw = fs.readFileSync(configPath, 'utf8');
  const config = JSON.parse(raw);
  let changed = false;

  const removedPaths = [];
  const paths = config?.plugins?.load?.paths;
  if (Array.isArray(paths)) {
    const kept = [];
    for (const entry of paths) {
      if (typeof entry !== 'string') {
        kept.push(entry);
        continue;
      }

      const normalized = entry.replace(/\\/g, '/').toLowerCase();
      const looksLikeMoltbank = normalized.includes('moltbank');
      if (looksLikeMoltbank && !fs.existsSync(entry)) {
        removedPaths.push(entry);
        changed = true;
        continue;
      }

      kept.push(entry);
    }

    config.plugins = config.plugins && typeof config.plugins === 'object' ? config.plugins : {};
    config.plugins.load = config.plugins.load && typeof config.plugins.load === 'object' ? config.plugins.load : {};
    config.plugins.load.paths = kept;
  }

  const removedEntries = [];
  if (config?.plugins?.entries && typeof config.plugins.entries === 'object') {
    for (const staleId of ['google-gemini-cli-auth']) {
      if (Object.prototype.hasOwnProperty.call(config.plugins.entries, staleId)) {
        delete config.plugins.entries[staleId];
        removedEntries.push(staleId);
        changed = true;
      }
    }
  }

  if (changed) {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
  }

  const messages = [];
  if (removedPaths.length > 0) messages.push('removed_paths:' + removedPaths.join(' | '));
  if (removedEntries.length > 0) messages.push('removed_entries:' + removedEntries.join(' | '));
  if (!changed) messages.push('clean');

  process.stdout.write(messages.join('\n'));
} catch (error) {
  process.stderr.write(String(error));
  process.exit(1);
}
NODE
)"
  local cleanup_status=$?
  set -e

  if [ "$cleanup_status" -ne 0 ]; then
    log_warn "Could not pre-clean stale plugin config: ${cleanup_output}"
    return 0
  fi

  if [[ "$cleanup_output" == *"removed_paths:"* ]]; then
    local removed_paths_line
    removed_paths_line="$(printf '%s\n' "$cleanup_output" | awk -F'removed_paths:' '/removed_paths:/ {print $2; exit}')"
    [ -n "$removed_paths_line" ] && log_warn "Removed stale MoltBank plugin load path(s): ${removed_paths_line}"
  fi

  if [[ "$cleanup_output" == *"removed_entries:"* ]]; then
    local removed_entries_line
    removed_entries_line="$(printf '%s\n' "$cleanup_output" | awk -F'removed_entries:' '/removed_entries:/ {print $2; exit}')"
    [ -n "$removed_entries_line" ] && log_warn "Removed stale plugin config entry: ${removed_entries_line}"
  fi

}

ensure_plugin_allow_entry() {
  local config_path="$HOME/.openclaw/openclaw.json"
  if [ ! -f "$config_path" ]; then
    return 0
  fi

  local update_output=""
  set +e
  update_output="$(node - "$config_path" "$PLUGIN_ID" <<'NODE'
const fs = require('fs');
const configPath = process.argv[2];
const pluginId = process.argv[3] || 'moltbank';

try {
  const raw = fs.readFileSync(configPath, 'utf8');
  const config = JSON.parse(raw);
  config.plugins = config.plugins && typeof config.plugins === 'object' ? config.plugins : {};
  const allow = Array.isArray(config.plugins.allow) ? config.plugins.allow : [];
  if (!allow.includes(pluginId)) {
    allow.push(pluginId);
    config.plugins.allow = allow;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
    process.stdout.write('added:true');
  } else {
    process.stdout.write('already_present:true');
  }
} catch (error) {
  process.stderr.write(String(error));
  process.exit(1);
}
NODE
)"
  local update_status=$?
  set -e

  if [ "$update_status" -ne 0 ]; then
    log_warn "Could not update plugins.allow for ${PLUGIN_ID}: ${update_output}"
    return 0
  fi

  if [[ "$update_output" == *"added:true"* ]]; then
    log_step "plugins.allow updated to include ${PLUGIN_ID}"
  fi
}

ensure_wrapper_permissions() {
  local wrapper_path="${OPENCLAW_WORKSPACE:-$HOME/.openclaw/workspace}/skills/${SKILL_NAME}/scripts/moltbank.sh"
  if [ -f "$wrapper_path" ]; then
    chmod +x "$wrapper_path" 2>/dev/null || true
    log_step "Ensured wrapper executable bit: ${wrapper_path}"
  fi
}

BASE_URL="$(normalize_base_url "$RAW_BASE_URL")"

if ! command -v openclaw >/dev/null 2>&1; then
  log_error "openclaw CLI is required but was not found on PATH."
  log_error "Install OpenClaw first, then re-run this installer."
  exit 1
fi

log_step "Starting MoltBank plugin installation"
log_step "Preferred plugin spec: ${PLUGIN_SPEC}"
log_step "Plugin id: ${PLUGIN_ID}"
log_step "Resolved base URL: ${BASE_URL}"
log_step "Skill name: ${SKILL_NAME}"
log_step "Preflight: cleaning stale MoltBank plugin load paths"
cleanup_stale_moltbank_load_paths

install_source=""
if run_openclaw_plugins_install "${PLUGIN_SPEC}"; then
  install_source="${PLUGIN_SPEC}"
elif is_already_installed_output; then
  log_warn "Plugin appears to be already installed; continuing."
  install_source="${PLUGIN_SPEC}"
else
  local_path="$(resolve_local_plugin_path)"
  if [ -n "$local_path" ]; then
    log_warn "Registry install failed; trying local plugin path: ${local_path}"
    refresh_local_plugin_repo "$local_path"
    if install_from_local_path "$local_path"; then
      install_source="$local_path"
    elif is_already_installed_output; then
      log_warn "Local plugin path appears to already be installed; continuing."
      install_source="$local_path"
    fi
  fi

  if [ -z "$install_source" ]; then
    log_warn "Local path install unavailable or failed; trying git clone fallback."
    if install_from_git_clone "$PLUGIN_GIT_URL" "$PLUGIN_CLONE_DIR"; then
      install_source="$PLUGIN_CLONE_DIR"
    elif is_already_installed_output; then
      log_warn "Git clone fallback appears to already be installed; continuing."
      install_source="$PLUGIN_CLONE_DIR"
    fi
  fi
fi

if [ -z "$install_source" ]; then
  log_error "Failed to install MoltBank plugin from supported sources."
  log_error "OpenClaw only accepts registry packages, local paths, or local archives for plugin install."
  log_error "Try one of these:"
  log_error "  1) openclaw plugins install @moltbank/moltbank"
  log_error "  2) git clone https://github.com/CapuzR/moltbank-npm.git && openclaw plugins install -l ./moltbank-npm"
  exit 1
fi

log_step "Plugin installed from: ${install_source}"

set +e
inspect_output="$(openclaw plugins inspect "${PLUGIN_ID}" 2>&1)"
inspect_status=$?
set -e
if [ "$inspect_status" -ne 0 ]; then
  printf '%s\n' "$inspect_output"
  log_error "Plugin install reported success but inspect failed for '${PLUGIN_ID}'. Aborting before gateway restart."
  exit 1
fi

ensure_plugin_allow_entry

set +e
openclaw config set plugins.enabled true >/dev/null 2>&1
openclaw config set "plugins.entries.${PLUGIN_ID}.enabled" true >/dev/null 2>&1
openclaw config set "plugins.entries.${PLUGIN_ID}.config.appBaseUrl" "${BASE_URL}" >/dev/null 2>&1
openclaw config set "plugins.entries.${PLUGIN_ID}.config.skillName" "${SKILL_NAME}" >/dev/null 2>&1
openclaw plugins enable "${PLUGIN_ID}" >/dev/null 2>&1
set -e

log_step "Restarting OpenClaw gateway"
if ! openclaw gateway restart >/dev/null 2>&1; then
  log_warn "Gateway restart failed. Run manually: openclaw gateway restart"
fi

log_step "Running MoltBank setup (includes onboarding when credentials are missing)"
set +e
openclaw moltbank setup
setup_status=$?
set -e
if [ "$setup_status" -ne 0 ]; then
  log_warn "MoltBank setup did not complete. Run manually: openclaw moltbank setup"
fi

ensure_wrapper_permissions

log_step "MoltBank plugin installation completed."
log_step "Verify: openclaw plugins inspect ${PLUGIN_ID}"
log_step "List: openclaw plugins list"
