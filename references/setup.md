# MoltBank setup guide

This file covers prerequisites, authentication resolution, and safe MCP invocation.
This is the canonical setup runbook. Keep `skill.md` high level and route setup/install/auth details here.

## Runtime defaults

Use these defaults so all commands derive project-specific paths from `APP_BASE_URL`:

**Mac/Linux (Bash):**

```bash
APP_BASE_URL="${APP_BASE_URL:-https://app.moltbank.bot}"
export MOLTBANK_CREDENTIALS_PATH="${MOLTBANK_CREDENTIALS_PATH:-$HOME/.MoltBank/credentials.json}"
export MOLTBANK_SKILL_NAME="${MOLTBANK_SKILL_NAME:-MoltBank}"

```

**Windows (PowerShell):**

```powershell
if (-not $env:APP_BASE_URL) { $env:APP_BASE_URL = "https://app.moltbank.bot" }
$env:MOLTBANK_CREDENTIALS_PATH = "$env:USERPROFILE\.MoltBank\credentials.json"
$env:MOLTBANK_SKILL_NAME = "MoltBank"
```

## System interrupt handling

If the runtime sends an explicit instruction to read workspace `HEARTBEAT.md` (for example `C:/Users/.../.openclaw/workspace/HEARTBEAT.md`), pause all ongoing tasks and execute that instruction first. If the file is empty or template-only, reply exactly `HEARTBEAT_OK` and nothing else.

## Agent autonomy rules (critical)

- Execute setup/install commands directly when command tools are available.
- Do not ask the user to run commands you can run yourself.
- Do not ask the user for obvious environment information like OS; detect it from runtime.
- Only request user action when strictly required (OAuth activation in browser, explicit policy approvals, or user-provided secrets).
- Always send onboarding code/instructions in the user channel output. Never rely on the user watching gateway console logs.
- Prefer the standalone `moltbank` CLI only for install, setup, auth-status, and repair flows. Use `openclaw moltbank ...` only as a compatibility fallback while plugin mode still exists.
- For business operations such as balances, transfers, approvals, history, reports, and x402 actions, always use the skill wrapper scripts. Do not treat the standalone `moltbank` CLI as the treasury operations interface.
- Use `moltbank setup` by default when the CLI is available. Use `moltbank setup` only as a compatibility fallback, and use blocking mode only if explicitly requested.
- In nonblocking mode, keep authentication progressing in the background so onboarding can complete even if a follow-up chat message is delayed.

### Join intent shortcut (mandatory)

If user intent is "join MoltBank", execute setup directly without clarification prompts.

Treat the user's join request as authorization to run install/setup commands in the current runtime.

Required sequence:

1. Run the install script: `curl -fsSL "${APP_BASE_URL:-https://app.moltbank.bot}/install.sh" | bash`
2. **CRITICAL:** You MUST poll the process until it completely finishes and exits. Do not proceed to the next steps while it is still running.
3. The install script automatically restarts the gateway and runs MoltBank setup at the end. **Do NOT** run `openclaw gateway restart` or `moltbank setup` manually.
4. Read the final output of the completed installer to find the OAuth code/URL and relay it to the user in-channel.
5. Only if the installer explicitly fails, use the manual local-link fallback.

Do not ask the user to choose between "setup / onboarding / explain capabilities" for this intent.

### Approval acknowledgment handling (mandatory)

If the agent has just sent activation URL/code and the user replies with a short acknowledgment (for example `done`, `listo`, `hecho`, `approved`, `ya`), treat it as a command to continue onboarding immediately.

Required sequence in that same turn:

1. Run `moltbank status` first. Use `moltbank auth-status` only if the standalone CLI is unavailable.
2. If auth is still pending, run blocking setup to finalize token polling:
   - Preferred: `moltbank setup-blocking`
   - Fallback: `moltbank setup-blocking`
3. Report one of these outcomes in-channel (never stay silent):
   - Auth completed successfully (include active organization name if available).
   - Still pending approval (repeat URL/code and expiration).
   - Code expired/invalid and a new code was issued.
4. If still pending, ask the user to approve in browser; no manual CLI command is required from the user.

### Connector + auth health quick check (mandatory when user says "I already approved")

When a user says they approved but the bot did not continue, run this sequence:

1. `moltbank status`
2. If status shows `pending code` and no credentials, run `moltbank setup-blocking`. Use the `openclaw` form only if the standalone CLI is unavailable.
3. If no new inbound chat events appear in gateway logs after the user's reply, treat it as connector delivery failure (not MoltBank auth logic).
4. Ask the user to send `MoltBank done` again after connector recovery, then re-run blocking setup.

### Command-availability claim rule (mandatory)

Before claiming command execution is unavailable:

1. Attempt command execution in this run (for example `openclaw --version` or another safe local command).
2. If command execution works, continue setup directly and do not ask the user to run setup commands.
3. Only state a command-execution limitation when there is an actual failure signal (missing tool surface, explicit sandbox/permission denial, or command runner unavailable).

Forbidden fallback when step 1 was not attempted:

- "I can't run MoltBank setup commands directly in this environment."
- "Run `moltbank setup` on your machine."

### Unknown subcommand handling (mandatory)

If `moltbank setup` returns `error: unknown command 'moltbank'`, interpret it as "MoltBank plugin not installed in this OpenClaw runtime."

Required recovery sequence in the same run:

1. Run the one-step installer:
   - `curl -fsSL "${APP_BASE_URL:-https://app.moltbank.bot}/install.sh" | bash`
2. **CRITICAL:** Poll the process and wait for it to exit completely.
3. The installer automatically restarts the gateway and runs setup. **Do NOT** run `openclaw gateway restart` or `moltbank setup` yourself.
4. Relay the OAuth code from the installer's output to the user.
5. Only use the manual local-link fallback and manual restarts if the installer script explicitly fails.

Only escalate to the user if these automatic install/recovery attempts fail with concrete errors.

Forbidden early-stop response for this case:

- "The `moltbank` subcommand is unknown, so I can't continue."
- "Please install MoltBank support and tell me when done."

### Local skill path discovery (mandatory)

When resolving local docs (`skill.md`, `references/setup.md`, `references/onboarding.md`), do not assume lowercase paths. The skill directory name is case-sensitive and usually defaults to `MoltBank`.

Required sequence:

1. Derive expected path from env defaults first:
   - `${OPENCLAW_WORKSPACE:-$HOME/.openclaw/workspace}/skills/${MOLTBANK_SKILL_NAME:-MoltBank}`
2. If read fails with `ENOENT`, auto-discover actual path case-insensitively and continue in the same turn:
   - Mac/Linux: `find "${OPENCLAW_WORKSPACE:-$HOME/.openclaw/workspace}/skills" -maxdepth 3 -type f -path "*/references/setup.md" | grep -i "/moltbank/" | head -1`
   - Windows (PowerShell): `Get-ChildItem "$env:USERPROFILE\\.openclaw\\workspace\\skills" -Recurse -Filter setup.md | Where-Object { $_.FullName -match '(?i)\\\\moltbank\\\\references\\\\setup\.md$' } | Select-Object -First 1 -ExpandProperty FullName`
3. If local docs are still missing, run install/recovery flow immediately, then retry local reads.
4. Never stop with "can't find references/setup.md". Never ask "If you want, I can keep going..."; continue automatically and report concrete progress.

### URL handling for `https://app.moltbank.bot/skill.md`

When the user references this URL, use local installed skill docs as operational truth first:

- `skill.md`
- `references/setup.md`
- `references/onboarding.md`

Do not depend on truncated/untrusted remote fetch content to decide whether to execute setup.
If local docs are missing or stale, sync/update them automatically and continue without asking for confirmation.
If command tools are unavailable in the current runtime, state that limitation directly and request command execution capability; do not switch to open-ended clarification prompts.

## 1. Prerequisites

Required tools:

- `mcporter`
- `jq`
- `node` 20+

If the plugin is not installed yet, use one of these supported methods:

Recommended (one-step installer; includes stale-path cleanup + setup):
_(Agent instruction: This script automatically restarts the gateway and runs setup. You must poll it until it completely exits. Do not run manual restarts or setup commands afterwards.)_

```bash
curl -fsSL "${APP_BASE_URL:-https://app.moltbank.bot}/install.sh" | bash
```

Option A (standalone CLI, preferred when you do not want the plugin):

```bash
npm install -g @moltbankhq/openclaw
moltbank setup
```

Or without a global install:

```bash
npx @moltbankhq/openclaw setup
```

Option B (local linked plugin, recommended while iterating on plugin mode):

```bash
git clone https://github.com/moltbankhq/openclaw-plugin.git
openclaw plugins install -l ./openclaw-plugin
openclaw plugins enable moltbank
openclaw config set plugins.entries.moltbank.config.appBaseUrl "${APP_BASE_URL:-https://app.moltbank.bot}"
openclaw config set plugins.entries.moltbank.config.skillName "${MOLTBANK_SKILL_NAME:-MoltBank}"
openclaw gateway restart
moltbank setup
```

Option C (registry plugin package, compatibility mode):

```bash
openclaw plugins install @moltbankhq/openclaw
openclaw plugins enable moltbank
openclaw config set plugins.entries.moltbank.config.appBaseUrl "${APP_BASE_URL:-https://app.moltbank.bot}"
openclaw config set plugins.entries.moltbank.config.skillName "${MOLTBANK_SKILL_NAME:-MoltBank}"
openclaw gateway restart
moltbank setup
```

Do not use `github:<user>/<repo>` as the install spec; OpenClaw rejects that input format.

## 2. Validate credentials

### Sandbox fast path (check this first)

Before reading any file or asking the user anything, check if the sandbox environment variables are set:

```bash
[ -n "${MOLTBANK:-}" ] && [ -n "${ACTIVE_ORG_OVERRIDE:-}" ] && echo "sandbox ready"
```

**If `MOLTBANK` and `ACTIVE_ORG_OVERRIDE` are both set → sandbox mode is active.**

- The OpenClaw plugin has already authenticated and injected all required variables.
- Set session state immediately:
  - `currentOrganization` = value of `ACTIVE_ORG_OVERRIDE`
  - `currentToken` = value of `MOLTBANK`
- If `SIGNER` is also set, the EOA signer private key is available for x402 flows.
- **Skip all credential file checks, onboarding prompts, and auth flows entirely.**
- Proceed directly to tool execution.

---

Credential validation is mode-dependent:

If host `credentials.json` already has `active_organization`, treat onboarding as already complete and skip any `/activate` prompt.

- **Host mode:** `${MOLTBANK_CREDENTIALS_PATH}` (or `$env:MOLTBANK_CREDENTIALS_PATH` on Windows) exists and contains `active_organization`.
- **Sandbox mode:** `MOLTBANK` env var is set (single-org mode).

If host credentials are missing, check `MOLTBANK` before sending users to onboarding.

**NEVER ask the user for their MOLTBANK token.** The token is obtained ONLY via the OAuth device flow in `references/onboarding.md`. If credentials are missing, initiate that flow — do NOT ask the user to paste, type, or share any token, API key, or access token in chat.

**ABSOLUTE SECURITY RULE: NEVER ask the user to paste, type, or share their MOLTBANK token, API key, or access token in chat — under any circumstance.** The token is obtained ONLY via the OAuth device flow in `references/onboarding.md`. If credentials are missing, run `node ./scripts/request-oauth-device-code.mjs` from the skill directory and guide the user through the device flow.

**Hard rule (do not guess):** Before telling the user to "connect account", "set up MoltBank API key", or run onboarding, you MUST verify credentials using wrapper logic (host file OR sandbox env var).

**New Verification Rule:** I MUST always exhaustively verify credentials in the system path (host mode) AND in environment variables (sandbox mode). ONLY if BOTH verifications fail, should I proceed with the OAuth flow.

When checking `credentials.json`, never print the full file in chat logs. Query only the minimum fields needed for flow control (for example `active_organization`) and always redact token values.

Do not infer missing MoltBank credentials from unrelated errors (for example: missing `BRAVE_API_KEY`, missing local script path, network/search tool failures, or 401s from third-party APIs).

If `credentials.json` exists and `active_organization` is present, treat the user as already authenticated for MoltBank and continue (host mode).

If `credentials.json` is not available but `MOLTBANK` is present, treat the user as authenticated in sandbox mode and continue.

**Missing credentials — response by mode:**

- **Sandbox mode** (`MOLTBANK` is NOT set in env): The plugin did not inject credentials correctly. Tell the user: _"MoltBank credentials are not available in this environment. Please ask your administrator to verify the plugin configuration."_ Do NOT start onboarding. Do NOT ask for a token. Stop here.
- **Host mode** (`credentials.json` does NOT exist): Start the OAuth device flow immediately — run `node ./scripts/request-oauth-device-code.mjs` from the skill directory and guide the user through the device activation steps. Do NOT ask the user for a token.

**Mac/Linux quick check:**

```bash
test -f "${MOLTBANK_CREDENTIALS_PATH}" && jq -r '.active_organization // ""' "${MOLTBANK_CREDENTIALS_PATH}"
```

**Windows (PowerShell) quick check:**

```powershell
if (Test-Path "$env:MOLTBANK_CREDENTIALS_PATH") { (Get-Content "$env:MOLTBANK_CREDENTIALS_PATH" -Raw | ConvertFrom-Json).active_organization }
```

**Sandbox quick check (Mac/Linux or PowerShell):**

```bash
[ -n "${MOLTBANK:-}" ] && [ -n "${ACTIVE_ORG_OVERRIDE:-}" ] && echo "sandbox ready — org: $ACTIVE_ORG_OVERRIDE"
```

If `openclaw gateway restart` fails in environments without `systemd` (for example `Failed to connect to bus`), continue with:

```bash
moltbank setup
```

Do not require the user to watch gateway console logs. Surface onboarding instructions from command output in the user channel.

## 3. Verify mcporter registration

**Mac/Linux:**

```bash
cd "${OPENCLAW_WORKSPACE:-$HOME/.openclaw/workspace}/skills/${MOLTBANK_SKILL_NAME:-MoltBank}"
./scripts/moltbank.sh list MoltBank
```

**Windows (PowerShell):**

```powershell
$wrapper = "$env:USERPROFILE\.openclaw\workspace\skills\$env:MOLTBANK_SKILL_NAME\scripts\moltbank.ps1"
& $wrapper list MoltBank
```

Interpretation rules:

- If `MoltBank` is not listed, treat as a config issue and stop.
- If `MoltBank` is listed but tools show auth/policy errors, treat that as an authentication/authorization state, **not** an installation failure.
- Do not force onboarding when host credentials are missing until you also checked `MOLTBANK` for sandbox mode.
- If the client suggests "run mcporter auth MoltBank", ignore that. MoltBank auth is done via the OAuth device flow in `references/onboarding.md`, not via `mcporter auth`.

## 3.2 Post-setup readiness verification (mandatory)

Do this before claiming the agent is ready to use MoltBank.

- Setup is not complete just because auth succeeded or `moltbank list MoltBank` works.
- A real authenticated wrapper call must succeed.
- The canonical readiness check is a balance read for the active organization.

**Mac/Linux:**

```bash
cd "${OPENCLAW_WORKSPACE:-$HOME/.openclaw/workspace}/skills/${MOLTBANK_SKILL_NAME:-MoltBank}"
./scripts/moltbank.sh call MoltBank.get_balance organizationName="<active_org>" date="today"
```

**Windows (PowerShell):**

```powershell
$wrapper = "$env:USERPROFILE\.openclaw\workspace\skills\$env:MOLTBANK_SKILL_NAME\scripts\moltbank.ps1"
& $wrapper call MoltBank.get_balance organizationName="<active_org>" date="today"
```

Interpretation rules:

- If this succeeds, the agent is operational.
- If auth is linked but this fails, treat setup as incomplete and report the exact verification failure.
- Do not claim readiness based only on CLI install success, mcporter registration, or auth-status output.

## 3.1 First account discovery (required before `get_account_details`)

Do this right after install/setup if you need an account-scoped tool:

- There is no `list_accounts` tool.
- Do not call `get_account_details` without both `organizationName` and `accountName`.
- Discover account names first with `get_balance` and reuse the exact returned account `name` (for example `Main`).

**Mac/Linux:**

```bash
cd "${OPENCLAW_WORKSPACE:-$HOME/.openclaw/workspace}/skills/${MOLTBANK_SKILL_NAME:-MoltBank}"
./scripts/moltbank.sh call MoltBank.get_balance organizationName="<org>" date="today"
```

**Windows (PowerShell):**

```powershell
$wrapper = "$env:USERPROFILE\.openclaw\workspace\skills\$env:MOLTBANK_SKILL_NAME\scripts\moltbank.ps1"
& $wrapper call MoltBank.get_balance organizationName="<org>" date="today"
```

## 4. Tool Execution

You MUST ALWAYS use the wrapper script for all mcporter operations. This ensures the API token is resolved securely and the local MCP server configuration is loaded. NEVER call `mcporter` directly.

**Working directory — CRITICAL for all platforms:**

All `node ./scripts/...` commands require the skill directory as the working directory so Node.js can resolve local modules (`./openclaw-runtime-config.mjs`, `node_modules/`, etc.). Running them from any other directory will cause `Cannot find module` errors even if the files exist.

**Sandbox (Docker):** Always prefix with `cd`:

```bash
cd /workspace/skills/MoltBank && <your command>
```

**Mac/Linux (host):** Always `cd` first:

```bash
cd "${OPENCLAW_WORKSPACE:-$HOME/.openclaw/workspace}/skills/${MOLTBANK_SKILL_NAME:-MoltBank}"
node ./scripts/request-oauth-device-code.mjs
```

**Windows (host) — working directory:** Before running ANY `node ./scripts/...` command, always `cd` to the skill directory first:

```powershell
cd "$env:USERPROFILE\.openclaw\workspace\skills\$env:MOLTBANK_SKILL_NAME"
node ./scripts/request-oauth-device-code.mjs
```

Never run `node ./scripts/...` from `C:\Users\...` or any other directory on Windows — the relative import `./openclaw-runtime-config.mjs` will fail with `Cannot find module`.

On Windows, use the PowerShell wrapper with an absolute path so the call does not depend on current working directory:

Do not execute `moltbank.ps1` via `bash -lc`; run it directly in PowerShell so arguments are preserved. The wrapper now normalizes credential paths for Git Bash/WSL when needed.

**Mac/Linux:**

```bash
cd "${OPENCLAW_WORKSPACE:-$HOME/.openclaw/workspace}/skills/${MOLTBANK_SKILL_NAME:-MoltBank}"
./scripts/moltbank.sh call MoltBank.get_balance organizationName="Acme" date="2026-02-25"
```

**Windows (PowerShell):**

```powershell
$wrapper = "$env:USERPROFILE\.openclaw\workspace\skills\$env:MOLTBANK_SKILL_NAME\scripts\moltbank.ps1"
& $wrapper call MoltBank.get_balance organizationName="Acme" date="2026-02-25"
```

## 5. Required operating rules

- For each write operation, confirm inputs and wait for explicit user approval.
- If a tool returns `missing_allowance`/`insufficient_allowance`, do not retry blindly; guide user to the relevant proposal tool.
- Never output API keys or private keys.
- Commands like `node ./scripts/init-openclaw-signer.mjs ...` and `node ./scripts/inspect-x402-requirements.mjs ...` are the same on Mac/Linux and Windows PowerShell once you are already in the skill directory.
- For x402 signer bootstrap, use `node ./scripts/init-openclaw-signer.mjs "<safeAddress>"`. Never ask the user to edit `credentials.json` for `x402_signer_private_key`.
- **Sandbox mode x402:** If `SIGNER` is set in the environment, `init-openclaw-signer.mjs` uses it directly (no `credentials.json` needed). The script returns `sandboxMode: true` and the `signerAddress`. Use `PRIVATE_KEY=$SIGNER` when calling `x402-pay-and-confirm.mjs`:
  ```bash
  cd /workspace/skills/MoltBank && PRIVATE_KEY=$SIGNER node scripts/x402-pay-and-confirm.mjs "$x402Url" GET
  ```
  Never run `init-openclaw-signer.mjs` with a `safeAddress` arg in sandbox — the key is already available via `$SIGNER`.
