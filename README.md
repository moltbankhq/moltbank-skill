# Moltbank

Let your agent fleet spend with guardrails. MoltBank gives AI agents scoped access to USDC treasury operations — balances, payments, Earn, and x402 — with human-approved budgets and proposal workflows.

<!-- TODO: uncomment when ClawHub listing is live
[![ClawHub](https://img.shields.io/badge/ClawHub-moltbank-blue)](https://clawhub.ai/skills/moltbank)
-->
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT--0-brightgreen)](LICENSE)

## What your agent can do

- Check USDC balances and account details across your organization
- Draft payment proposals and route them for human approval
- Execute transfers within pre-configured budgets
- Track transaction history, cash flow, and spending patterns
- Manage Earn positions on Aave
- Discover, fund, and pay x402 endpoints on Base
- Invite team members and manage contacts

## Quick start

The fastest path — tell your agent:

> Read https://app.moltbank.bot/skill/SKILL.md and follow the instructions to join MoltBank

The agent handles install, authentication, and setup autonomously.

![ezgif-306668d522928039](https://github.com/user-attachments/assets/a9ee5457-fe3f-44f9-84f0-273fe2125e29)

### Manual install

If you prefer to set it up yourself:

```bash
npm install -g @moltbankhq/openclaw
moltbank setup
```

`moltbank setup` walks you through authentication via OAuth device flow and configures the skill in your workspace.

### Requirements

- Node.js 20+
- `mcporter` — MCP transport CLI
- `jq` — JSON processing

## How it works

MoltBank connects your agent to a treasury MCP server. The agent reads USDC balances and transaction data directly. For anything that moves money — transfers, Earn deposits, x402 purchases — the agent either drafts a proposal for human approval or executes within a pre-configured budget (transfer and earn limits).

Transfers and earn limits are set by account owners in the MoltBank dashboard. The agent checks its remaining budget before every operation and stops if the amount exceeds what's left. No surprise spend.

The x402 workflow runs on Base. The agent manages a local signer wallet for on-chain payment signing — the private key stays on your machine.

## Screenshots

<!-- Replace with actual paths once hosted in repo or CDN -->
<!-- ![Dashboard](docs/screenshots/dashboard.png) -->
<!-- ![Agent setup flow](docs/screenshots/agent-setup.png) -->
<!-- ![x402 payment](docs/screenshots/x402-payment.png) -->

*Screenshots coming soon.*

## Skill structure

```
SKILL.md                          → Agent entrypoint and execution policy
references/
  setup.md                        → Install, auth, and runtime runbook
  onboarding.md                   → OAuth device flow
  rules.md                        → Security, approvals, budget behavior
  tools-reference.md              → Tool inputs and argument validation
  x402-workflow.md                → x402 payment workflow (Base)
  openclaw-signer-eoa.md          → Signer wallet bootstrap
  heartbeat.md                    → Integrity checks before MCP actions
  compliance.md                   → Trust disclosure and endpoint inventory
scripts/
  moltbank.sh / moltbank.ps1      → MCP wrapper (Mac/Linux / Windows)
  request-oauth-device-code.mjs   → OAuth initiation
  poll-oauth-token.mjs            → OAuth token polling
  export-api-key.mjs              → Token export (admin use)
  init-openclaw-signer.mjs        → x402 signer key generation
  inspect-x402-requirements.mjs   → x402 pre-purchase inspection
  x402-pay-and-confirm.mjs        → x402 payment execution
  openclaw-runtime-config.mjs     → Runtime path and env resolution
  setup-sandbox.sh                → Sandbox dependency setup
assets/
  mcporter.json                   → MCP transport configuration
```

## Environment variables

| Variable | Purpose | Default |
| :--- | :--- | :--- |
| `MOLTBANK` | Active Bearer token for MCP calls | Set by `moltbank setup` |
| `APP_BASE_URL` | MoltBank server URL | `https://app.moltbank.bot` |
| `MOLTBANK_CREDENTIALS_PATH` | Local credentials storage path | `~/.MoltBank` |
| `MOLTBANK_SKILL_NAME` | Skill folder name in workspace | `MoltBank` |

## Security

Credentials and the x402 signer private key are stored locally. The agent communicates with the MoltBank MCP server at `app.moltbank.bot` for treasury operations. See `references/compliance.md` for the full endpoint inventory and operational boundaries.

Only install this skill if you trust MoltBank with your organization's treasury operation data.

## Links

- [MoltBank Dashboard](https://app.moltbank.bot)
- [MoltBank](https://moltbank.bot)
<!-- - [ClawHub listing](https://clawhub.ai/skills/moltbank) -->

## License

MIT-0 — see [ClawHub licensing](https://clawhub.ai).
