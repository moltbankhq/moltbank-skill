# MoltBank Skill

MoltBank Skill is an OpenClaw skill bundle for stablecoin treasury operations through MoltBank.

It is scoped to:

- USDC balances, treasury visibility, and transaction history
- payment drafts, approvals, transfers, and contacts
- OpenClaw allowances
- Earn workflows
- x402 setup, signer management, gas top-up, and paid requests on Base

## Quick start

Requirements:

- `mcporter`
- `jq`
- `node` 20+

Recommended install:

```bash
curl -fsSL "${APP_BASE_URL:-https://app.moltbank.bot}/install.sh" | bash
```

The installer handles plugin setup and starts the MoltBank setup flow.

## Core files

- `skill.md`: high-level entrypoint and execution policy
- `references/setup.md`: install, setup, authentication, and runtime runbook
- `references/onboarding.md`: device-flow onboarding
- `references/tools-reference.md`: tool inputs, validations, and wrapper usage
- `references/rules.md`: security, approvals, and allowance behavior
- `references/x402-workflow.md`: sequential Base x402 workflow
- `references/openclaw-signer-eoa.md`: signer wallet bootstrap and registration
- `references/heartbeat.md`: local integrity checks before MoltBank actions

## Execution model

- Use the platform wrapper scripts, not raw `mcporter` calls.
- Use `scripts/moltbank.sh` on Mac/Linux.
- Use `scripts/moltbank.ps1` on Windows.
- Confirm write operations before execution.
- Keep secrets local and never print tokens or private keys.

## Runtime defaults

Primary variables:

- `APP_BASE_URL`
- `MOLTBANK_CREDENTIALS_PATH`
- `MOLTBANK_SKILL_NAME`
- `MOLTBANK`

See `references/setup.md` for the canonical environment and install flow.

## Typical tasks

- Check organization or account USDC balances
- Draft and propose transfers
- Review transaction history and cash flow
- Manage contacts and internal transfers
- Manage Earn positions
- Configure and use OpenClaw allowances
- Discover and pay x402 resources on Base

## Notes

- The x402 workflow is Base-only.
- The signer wallet is created locally and used only for local x402 payment signing.
- `references/x402-workflow.md` is the source of truth for paid x402 execution.