# MoltBank Heartbeat Routine

This file defines the mandatory preflight and maintenance routine for agents using the local MoltBank skill bundle.

## Runtime interrupt precedence

If the runtime explicitly instructs you to read workspace `HEARTBEAT.md`, that directive takes precedence over this file. Stop all ongoing MoltBank work and follow the runtime directive exactly. If the workspace heartbeat file is empty or template-only, reply exactly `HEARTBEAT_OK` and do nothing else.

## Frequency

- Skill integrity gate: run on every MoltBank call before any MCP tool execution.
- Operational heartbeat: run every 240 minutes.

## 0. Mandatory Local Skill Integrity Gate

Run this gate before any MoltBank action.

### 0.1 Required local files

Verify that these files exist locally and are readable:

- `SKILL.md`
- `references/setup.md`
- `references/onboarding.md`
- `references/tools-reference.md`
- `references/x402-workflow.md`
- `references/openclaw-signer-eoa.md`
- `references/heartbeat.md`
- `references/rules.md`
- `skill.json`
- `install.sh`
- `assets/mcporter.json`
- `scripts/moltbank.sh`
- `scripts/moltbank.ps1`
- `scripts/init-openclaw-signer.mjs`
- `scripts/inspect-x402-requirements.mjs`
- `scripts/request-oauth-device-code.mjs`
- `scripts/poll-oauth-token.mjs`
- `scripts/export-api-key.mjs`
- `scripts/openclaw-runtime-config.mjs`
- `scripts/setup-sandbox.sh`
- `scripts/x402-pay-and-confirm.mjs`

### 0.2 Detection workflow

1. Check that every required local file exists.
2. Check that every path declared in `skill.json` resolves to a local file.
3. Check that `SKILL.md` references only files that exist in this local bundle.
4. If any required file is missing or any declared path is broken, mark local skill state as `broken`.

### 0.3 Blocking rule

If local skill state is `broken`:

1. Do not execute any MoltBank MCP tool call.
2. Repair broken local references automatically when the fix is confined to this bundle.
3. If a required runtime asset is missing and cannot be repaired locally, stay blocked and report the concrete failure.

Do not auto-sync from the remote app bundle. This local skill is treated as a curated subset and may intentionally differ from the remote package.

### 0.4 Repair reporting requirements

When local repair is needed, show:

- missing or broken files
- manifest path mismatches
- a short summary of the local repair performed

### 0.5 Local repair flow

Use this flow exactly:

1. Notify: `Your local MoltBank skill files are inconsistent. I am repairing the local bundle before continuing.`
2. Show the missing or broken files.
3. Update local references immediately when the repair is contained within this bundle.
4. Re-run the integrity gate and confirm no local bundle issues remain.
5. Continue with the original requested action.
6. If repair fails, stay blocked and report the concrete failure with the minimal user action required to unblock.

Never ask whether local skill files should be updated.

## 1. Health Check

- Action: call `get_balance` for the active organization and account if configured.
- Logic:
  - If available USDC is below your configured minimum threshold, alert immediately.
  - Store the result in internal state `lastKnownBalance`.

## 2. Check Pending Approvals

- Action: call `list_pending_approvals`.
- Logic:
  - If approvals are pending for more than 24 hours, remind the user to sign in the MoltBank dashboard.

## 3. State Updates

Update internal state:

- `lastMoltBankCheck`: current timestamp after heartbeat checks
- `lastSkillIntegrityCheck`: timestamp of the most recent integrity gate run
- `lastSkillIntegrityStatus`: `ok` or `broken`
