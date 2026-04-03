# MoltBank

MoltBank gives agents a safe treasury interface using a canonical local CLI plus an optional local MCP bridge.

<!-- TODO: uncomment when ClawHub listing is live
[![ClawHub](https://img.shields.io/badge/ClawHub-moltbank-blue)](https://clawhub.ai/skills/moltbank)
-->
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT--0-brightgreen)](LICENSE)

## What your agent can do

- Check USDC balances and account details across your organization
- Draft payment proposals and route them for human approval
- List pending approvals
- Track transaction history, cash flow, and spending patterns
- Call backend MCP tools from CLI with typed JSON output
- Use a local stdio MCP bridge for structured agent tool calls

## Quick start

Install the CLI and run explicit human auth:

```bash
npm install -g @moltbankhq/openclaw
moltbank auth login
moltbank doctor --json
```

Then use either:

```bash
moltbank balance --org "Acme" --json
```

or local MCP mode:

```bash
moltbank mcp stdio
```

### Requirements

- Node.js 22+
- `moltbank` CLI available on PATH

## How it works

This skill is intentionally thin:

- The product surface is the local `moltbank` CLI.
- Agents consume MoltBank through `--json` CLI commands or `moltbank mcp stdio`.
- Authentication is an explicit user action via `moltbank auth login`.
- Local credentials and signer material stay local.

This design avoids invasive installer behavior and global host mutation.

## Screenshots

<!-- Replace with actual paths once hosted in repo or CDN -->
<!-- ![Dashboard](docs/screenshots/dashboard.png) -->
<!-- ![Agent setup flow](docs/screenshots/agent-setup.png) -->
<!-- ![x402 payment](docs/screenshots/x402-payment.png) -->

_Screenshots coming soon._

## Skill structure

```
SKILL.md                      → Minimal agent guidance (CLI/MCP-first)
scripts/                      → Local helper scripts used by the skill
```

## Environment variables

| Variable | Purpose | Default |
| :--- | :--- | :--- |
| `APP_BASE_URL` | MoltBank server URL | `https://app.moltbank.bot` |
| `MOLTBANK_CREDENTIALS_PATH` | Local credentials file path | `~/.MoltBank/credentials.json` |

## Security

Credentials and signer material stay local on the machine. The agent should not mutate global OpenClaw config or sandbox settings as part of normal usage.

## Links

- [MoltBank Dashboard](https://app.moltbank.bot)
- [MoltBank](https://moltbank.bot)
<!-- - [ClawHub listing](https://clawhub.ai/skills/moltbank) -->

## License

MIT-0 — see [ClawHub licensing](https://clawhub.ai).
