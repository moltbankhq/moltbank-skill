---
name: moltbank
description: MCP skill for MoltBank stablecoin treasury workflows, approvals, allowances, Earn, and x402.
metadata:
  category: finance
  version: 0.1.0
  homepage: ${APP_BASE_URL:-https://app.moltbank.bot}
  api_base: ${APP_BASE_URL:-https://app.moltbank.bot}/api/mcp
  install_script: ${APP_BASE_URL:-https://app.moltbank.bot}/install.sh
  openclaw:
    requires:
      bins:
        - mcporter
        - jq
      npm:
        - '@x402/fetch@^2.3.0'
        - '@x402/evm@^2.3.1'
        - 'viem@^2.46.0'
    primaryEnv: MOLTBANK
---

# MoltBank skill for AI agents

Use this skill whenever the user asks to do stablecoin treasury actions through MoltBank.

## Trigger conditions

Trigger this skill if the user asks about any of the following:

- MoltBank or app.moltbank.bot
- treasury balances, USDC holdings, accounts, or cash flow
- payment proposals, approvals, transfers, recipients, transaction history
- onboarding or team invites
- Earn or Aave actions
- OpenClaw bot allowances
- x402 setup, funding, gas top-up, or paid x402 requests
- short onboarding acknowledgements right after activation instructions, for example `done`, `listo`, `hecho`, or `approved`

## Agent execution policy (critical)

- Execute required install, setup, and tool commands yourself when tools are available.
- Do not ask the user to run commands that you can run directly.
- Do not ask the user for obvious environment facts such as OS.
- Only ask the user for input when it is truly required and cannot be derived or executed locally, for example OAuth browser approval, missing secrets the user must provide, or explicit policy approval.
- For onboarding, always surface activation instructions and codes directly in the user channel. Never require the user to watch gateway console logs.
- Prefer the standalone `moltbank` CLI for install, setup, auth status, and repair flows when it is available. Use `openclaw moltbank ...` only as a compatibility fallback.
- For treasury operations such as balances, transfers, approvals, history, reports, and x402 actions, always use the installed skill wrapper scripts, not the standalone `moltbank` CLI.
- After setup completes, verify operational readiness with a wrapper balance read for the active organization before claiming the agent is ready to use.
- Never pause setup to ask whether local skill files should be updated; perform required local repairs automatically when possible.

## Source of truth by file

- `references/setup.md` is the canonical setup, install, auth, and runtime runbook.
- `references/onboarding.md` is the canonical OAuth device flow document.
- `references/rules.md` is the canonical security and approval policy document.
- `references/x402-workflow.md` is the canonical x402 execution workflow.

Keep this file high level. Put command-heavy setup instructions in `references/setup.md`, not here.

## Join behavior (critical)

- If user intent is `join MoltBank`, execute setup immediately without clarification prompts.
- Treat the user's join request as authorization to run install and setup commands in the current runtime.
- Read `references/setup.md` before running join commands so the full install and auth sequence is applied.
- Never reply with `I can't run setup commands in this environment` unless command execution has been attempted and failed in this run.
- If `moltbank setup` returns `unknown command 'moltbank'`, treat it as `plugin not installed` and continue with the install flow from `references/setup.md`.
- Inline fallback for unknown subcommand: install the MoltBank CLI via npm first (`npm install -g @moltbankhq/openclaw` or `npm exec --package @moltbankhq/openclaw -- moltbank setup`). Use the remote installer only when the npm CLI path is unavailable.
- If command execution tools are unavailable, state that limitation directly and ask only for enabling command execution capability.
- After sending an activation code, setup should continue automatically after browser approval. No manual CLI step is required from the user.
- If the user replies with a short acknowledgment after activation steps, treat it as a command to check progress and continue.

## Progressive disclosure

Read only the file needed for the current task:

| Task | File |
| :--- | :--- |
| Setup, credentials, and session prep | `./references/setup.md` |
| x402 signer wallet bootstrap | `./references/openclaw-signer-eoa.md` |
| First-time device flow and onboarding | `./references/onboarding.md` |
| Tool inputs and argument validation | `./references/tools-reference.md` |
| x402 payment workflow | `./references/x402-workflow.md` |
| Local integrity gate and heartbeat rules | `./references/heartbeat.md` |
| Security and allowance behavior | `./references/rules.md` |

## Minimal global guards

- Run the integrity gate in `./references/heartbeat.md` before every MoltBank MCP action.
- Use the platform wrapper script for MCP calls, `scripts/moltbank.sh` on Mac/Linux and `scripts/moltbank.ps1` on Windows. Do not call `mcporter` directly.
- For write operations such as draft, propose, register, fund, buy, update, or delete, confirm inputs and wait for explicit approval.
- Never print API keys, access tokens, or private keys.
