# Moltbank

Moltbank gives AI agents a safe treasury interface through a local CLI and
a security-first operating model for installed Moltbank Mods.

[![ClawHub](https://img.shields.io/badge/ClawHub-moltbank-blue)](https://clawhub.ai/skills/moltbank)
[![Node](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT--0-brightgreen)](https://clawhub.ai)

## What This Skill Covers

- Using the local `moltbank` CLI safely with JSON output and schema discovery.
- Keeping agent credentials isolated per session.
- Handling per-agent OAuth scope consent.
- Understanding, installing, updating, removing, and running Moltbank Mods.
- Reading each mod's own `SKILL.md` for domain-specific behavior without
  letting mod Markdown override the root security policy.
- Applying prompt-injection and supply-chain hygiene to mod docs, manifests,
  packages, links, and badges.

The root skill intentionally does not document every mod's workflow. Mods
ship their own `SKILL.md`; the root skill explains how agents should inspect
and trust-bound those mod-specific instructions.

## Quick Start

### OpenClaw

Install the skill:

```bash
openclaw skills install moltbank
```

If the local `moltbank` CLI is missing, install and verify:

```bash
npm install -g @megalinker/mbcli
npm audit signatures
moltbank --version
moltbank doctor --json
```

### Other Skills.sh-Compatible Runtimes

Install the skill:

```bash
npx skills add moltbankhq/moltbank-skill
```

If the local `moltbank` CLI is missing, install and verify:

```bash
npm install -g @megalinker/mbcli
npm audit signatures
moltbank --version
moltbank doctor --json
```

### Authentication

Agents should not assume a default profile. Start by listing profiles and
asking the user which one to use:

```bash
moltbank agent list --json
```

For a new profile:

```bash
moltbank auth begin --name "<Agent Display Name>" --json
# user approves in browser, then:
moltbank auth poll --session-id "<id>" --json
```

Keep `MOLTBANK_CREDENTIALS_PATH` fixed to the selected profile for the
whole session.

## Working With Mods

List installed mods:

```bash
moltbank mod list --json
moltbank mod list --skill-format
```

Inspect a mod:

```bash
moltbank mod info <name> --json
moltbank mod info <name> --include-skill --json
moltbank mod doctor <name> --json
```

Install, update, or remove only after explicit user approval:

```bash
moltbank schema mod-install --json
moltbank mod install <name> --json

moltbank schema mod-update --json
moltbank mod update <name> --json

moltbank schema mod-remove --json
moltbank mod remove <name> --json
moltbank mod remove <name> --purge --json
```

Community and URL installs require an explicit trust acknowledgement from
the user:

```bash
moltbank mod install --from <https-url> --acknowledge-community --json
```

The root skill tells agents to inspect a mod's tier, risk level,
permissions, network domains, env passthrough, package/source, capabilities,
and mod-specific `SKILL.md` before running it.

## Security Model

Moltbank is a privileged finance skill. It can help agents read treasury
state, draft financial actions, use x402 payments, and run installed mods.
Those actions are bounded by the local CLI, explicit user approval, OAuth
scope grants, audit intents, and mod runtime trust gates.

Important boundaries:

- No arbitrary install/update/shell commands.
- No `curl | bash`, alternate registries, copied README commands, or direct
  mod binary execution.
- No mutating financial action without explicit user approval.
- No credential path changes unless the human user asks.
- No secrets in chat output.
- No automatic upload of private manifests, packages, screenshots, or code
  to external scanners.

ClawHub listings, Snyk reports, Socket.dev analysis, VirusTotal results, npm
metadata, GitHub badges, and similar signals can help a human review a mod,
but they do not override Moltbank's manifest, signature, tier, permission,
revocation, and user-approval gates.

See [SKILL.md](SKILL.md) for the full operating rules.

## Local Development

For local APP development, point `MOLTBANK_SKILL_LOCAL_PATH` at this repo
(default `../moltbank-skill`) so `/skill.md` resolves to this tracked
`SKILL.md` on `https://preview.app.moltbank.bot`.

Render branch-specific docs from templates:

```bash
pnpm docs:render:main
pnpm docs:render:preview
pnpm docs:render:local
```

Validate all managed renders:

```bash
pnpm docs:validate-all
```

## Environment Variables

| Variable | Purpose | Default |
| :--- | :--- | :--- |
| `MOLTBANK_CUSTOM_API_URL` | Explicit preview/dev API URL override. Non-production profiles live under `~/.moltbank-test`. | unset |
| `MOLTBANK_CREDENTIALS_PATH` | Credentials file for the current session. | required |
| `MOLTBANK_ENFORCE_DISCOVERY` | Optional schema discovery enforcement override. | CLI default |

## Requirements

- Node.js >=22.0.0
- `moltbank` CLI on PATH

## Links

- [Moltbank App](https://app.moltbank.bot)
- [Moltbank](https://moltbank.bot)
- [ClawHub](https://clawhub.ai)

## License

MIT-0
