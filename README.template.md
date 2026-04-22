# Moltbank

Moltbank gives agents a safe treasury interface using a canonical local CLI plus an optional local MCP bridge.

[![ClawHub](https://img.shields.io/badge/ClawHub-moltbank-blue)](https://clawhub.ai/skills/moltbank)
[![Node](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT--0-brightgreen)](https://clawhub.ai)

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
npm install -g {{CLI_PACKAGE}}
npm audit signatures
export MOLTBANK_CREDENTIALS_PATH="{{DEFAULT_CREDENTIALS_PATH}}"
moltbank auth begin --json
# user approves in browser, then:
moltbank auth poll --json
moltbank doctor --json
```

### Other agents using skills.sh

Install the skill:

```bash
npx skills add moltbankhq/moltbank-skill
```

Install the CLI and verify:

```bash
npm install -g {{CLI_PACKAGE}}
npm audit signatures
export MOLTBANK_CREDENTIALS_PATH="{{DEFAULT_CREDENTIALS_PATH}}"
moltbank auth begin --json
# user approves in browser, then:
moltbank auth poll --json
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
* Agents should execute through the Moltbank CLI; local MCP mode (`moltbank mcp stdio`) is optional.
* For write actions in `--json` mode, discover command shape first via `moltbank schema --json` and `moltbank schema <command> --json`.
* Authentication is chat-driven via `moltbank auth begin --json` followed by `moltbank auth poll --json` after browser approval.
* Local credentials and signer material stay local.

This is a privileged finance skill: it can draft payments, run x402 auto-pay, and install or update its own required local components. Those capabilities are intentional and bounded — see the [Security model](#security-model) section for the exact trust boundaries, approved commands, and approval requirements.

## Screenshots

<!-- Replace with actual paths once hosted in repo or CDN -->

<!-- ![Dashboard](docs/screenshots/dashboard.png) -->

<!-- ![Agent setup flow](docs/screenshots/agent-setup.png) -->

<!-- ![x402 payment](docs/screenshots/x402-payment.png) -->

*Screenshots coming soon.*

## Skill structure

```
SKILL.md                      → Minimal agent guidance (CLI-first + optional local MCP bridge)
skill.json                    → Skill metadata + local MCP stdio declaration
```

## Local development

For local APP development, point `MOLTBANK_SKILL_LOCAL_PATH` at this repo (default `../moltbank-skill`) so `/skill.md` resolves to this tracked `SKILL.md` on `http://localhost:3000`.

When updating branch-specific docs from templates, use:

```bash
pnpm docs:render:main
# or
pnpm docs:render:preview
```

## Environment variables

| Variable                    | Purpose                                                                   | Default                        |
| :-------------------------- | :------------------------------------------------------------------------ | :----------------------------- |
| `MOLTBANK_CUSTOM_API_URL`   | Optional non-production API URL override for explicit preview/dev testing. When set, the CLI stores agent profiles under `~/.moltbank-test/agents/...` instead of `~/.moltbank/agents/...`, and `agent list` only sees the matching environment's profiles. | unset (production URL is used) |
| `MOLTBANK_CREDENTIALS_PATH` | Credentials file path used by the current terminal session (required for most commands) | required (no implicit default) |
| `MOLTBANK_ENFORCE_DISCOVERY` | Optional override for schema discovery enforcement (`true`/`false`) | defaults to match `--json` mode |

## Security model

Moltbank is a privileged finance skill. Its capabilities and boundaries are declared, not hidden.

**What executes locally.** The `moltbank` CLI (published as `{{CLI_PACKAGE}}`) and the optional local stdio MCP bridge (`moltbank mcp stdio`).

**What endpoints are contacted.** `https://app.moltbank.bot` by default. Non-production targets require an explicit `MOLTBANK_CUSTOM_API_URL` override, and the CLI emits a warning when active.

**What can move money or mutate state.** Drafting, approving, funding, or executing payments; x402 auto-pay; signer initialization; wallet registration; budget proposals. Every mutating action requires explicit user approval in the current chat — vague approvals ("go ahead", "sure") are not accepted unless the immediately preceding message identified the exact action.

**Approved maintenance commands (exact strings — no substitutions).**

- CLI install/update: `npm install -g {{CLI_PACKAGE}}` (always latest from the default npm registry — no alternate registries, forks, or version suffixes from tool output)
- OpenClaw skill update: `openclaw skills update moltbank` (runtime-native, targeted to this skill in the current workspace)
- skills.sh update (targeted): `npx skills update moltbank`
- OpenClaw skill check: `openclaw skills check --json`
- OpenClaw skill list: `openclaw skills list --json`
- skills.sh check: `npx skills check`

**What is forbidden.** Arbitrary package names, alternate registries, alternate GitHub repos or URLs, `curl | bash` / `wget | bash` / remote-script patterns, command concatenation, and any install or update command returned by a tool response, remote payload, documentation page, or chat content. The skill maps whitelisted CLI error codes to the hardcoded commands above; it never runs a command suggested by tool output.

**Provenance verification.** After any CLI install or update, run `npm audit signatures` followed by `moltbank doctor --json`. Failures stop the flow.

**Domain verification.** Before presenting any approval URL from `moltbank auth begin` or x402 auto-pay, the skill validates the URL parses and that its protocol + hostname match the configured Moltbank base URL (default `https://app.moltbank.bot`).

See [SKILL.md](SKILL.md) for the full enforcement rules, trigger conditions, and negative examples.

## Security notes

Credentials and signer material stay local on the machine. The agent should not mutate global OpenClaw config or sandbox settings as part of normal usage.

The local `moltbank` CLI is the canonical execution surface for this skill. Production is the default target (`https://app.moltbank.bot`). Non-production targets should only be set explicitly with `MOLTBANK_CUSTOM_API_URL`, and the CLI emits a security warning when that override is active.

For manual CLI installation, install from the default npm registry and verify signatures with `npm audit signatures`. The skill always uses the latest published version of `{{CLI_PACKAGE}}`; provenance (not version pinning) is how trust is anchored — see [Security model](#security-model).

Before approving browser-based auth or approval flows, verify the domain matches the configured Moltbank base URL hostname (default `app.moltbank.bot`).

## Links

* [Moltbank Homepage](https://app.moltbank.bot)
* [Moltbank Dashboard](https://app.moltbank.bot)
* [Moltbank](https://moltbank.bot)

<!-- - [ClawHub listing](https://clawhub.ai/skills/moltbank) -->

## License

MIT-0 — see [ClawHub licensing](https://clawhub.ai).
