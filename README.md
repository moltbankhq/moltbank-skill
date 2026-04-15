# Moltbank

Moltbank gives agents a safe treasury interface using a canonical local CLI plus an optional local MCP bridge.

[![ClawHub](https://img.shields.io/badge/ClawHub-moltbank-blue)](https://clawhub.ai/skills/moltbank)
[![Node](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT--0-brightgreen)](LICENSE)

## What your agent can do

- Check USDC balances and account details across your organization
- Draft payment proposals and route them for human approval
- List pending approvals
- Discover x402 Bazaar endpoints and run one-shot x402 auto-pay
- Track transaction history, cash flow, and spending patterns
- Call backend MCP tools from CLI with typed JSON output
- Use a local stdio MCP bridge for structured agent tool calls

## Quick start

### OpenClaw

Install the skill:

```bash
openclaw skills install moltbank
```

If the local `moltbank` CLI is missing, install and verify:

```bash
npm install -g @megalinker/mbcli
npm audit signatures
moltbank auth begin --json
moltbank doctor --json
```

### Other agents using skills.sh

Install the skill:

```bash
npx skills add moltbankhq/moltbank-skill
```

Install the CLI and verify:

```bash
npm install -g @megalinker/mbcli
npm audit signatures
moltbank auth begin --json
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

* Node.js >=22.0.0
* `moltbank` CLI available on PATH

## How it works

This skill is intentionally thin:

* The product surface is the local `moltbank` CLI.
* Agents consume Moltbank through MCP tools first (`moltbank mcp stdio`) and CLI second.
* If MCP is unavailable, agents should discover exact command/tool shape via `moltbank tools list --json`, `moltbank schema --json`, and `moltbank schema <command> --json` before execution.
* Authentication is chat-driven via `moltbank auth begin --json` followed by `moltbank auth poll --json` after browser approval.
* Local credentials and signer material stay local.

This design avoids invasive installer behavior and global host mutation.

## Screenshots

<!-- Replace with actual paths once hosted in repo or CDN -->

<!-- ![Dashboard](docs/screenshots/dashboard.png) -->

<!-- ![Agent setup flow](docs/screenshots/agent-setup.png) -->

<!-- ![x402 payment](docs/screenshots/x402-payment.png) -->

*Screenshots coming soon.*

## Skill structure

```
SKILL.md                      → Minimal agent guidance (CLI/MCP-first)
skill.json                    → Skill metadata + local MCP stdio declaration
```

## Local development (linking against an in-repo CLI)

When developing the CLI alongside the skill, render a developer-only `SKILL.local.md` that replaces `npm install -g @megalinker/mbcli@0.1.1` with `npm link` against a local `openclaw-npm` checkout, and swaps the homepage URL to the local HTTPS dev origin:

```bash
cp .env.example .env   # set LOCAL_OPENCLAW_PATH (and optionally LOCAL_HOMEPAGE_URL)
pnpm docs:render:local
```

Outputs:

- `SKILL.local.md` (gitignored) — locally-rendered skill. When the sibling `APP` repo sets `LOCAL_DEV_SKILL_FILE=../moltbank-skill/SKILL.local.md`, the Caddy dev proxy serves it at `https://localtest.app.moltbank.bot/skill.md`.

`SKILL.md` and `README.md` remain tracked and always reflect the `main` / `preview` branch templates. Local render never touches them.

## Environment variables

| Variable                    | Purpose                                                                   | Default                        |
| :-------------------------- | :------------------------------------------------------------------------ | :----------------------------- |
| `MOLTBANK_CUSTOM_API_URL`   | Optional non-production API URL override for explicit preview/dev testing | unset (production URL is used) |
| `MOLTBANK_CREDENTIALS_PATH` | Local credentials file path                                               | `~/.moltbank/credentials.json` |

## Security

Credentials and signer material stay local on the machine. The agent should not mutate global OpenClaw config or sandbox settings as part of normal usage.

The local `moltbank` CLI is the canonical execution surface for this skill. Production is the default target (`https://app.moltbank.bot`). Non-production targets should only be set explicitly with `MOLTBANK_CUSTOM_API_URL`, and the CLI emits a security warning when that override is active.

For manual CLI installation, prefer pinned versions (for example `@megalinker/mbcli@0.1.1`) and verify signatures with `npm audit signatures`.

Before approving browser-based auth or approval flows, verify the domain is `app.moltbank.bot`.

## Links

* [Moltbank Homepage](https://app.moltbank.bot)
* [Moltbank Dashboard](https://app.moltbank.bot)
* [Moltbank](https://moltbank.bot)

<!-- - [ClawHub listing](https://clawhub.ai/skills/moltbank) -->

## License

MIT-0 — see [ClawHub licensing](https://clawhub.ai).
