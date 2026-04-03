---
name: moltbank
description: Manage treasury balances, payment drafts, approvals, and x402 actions through the MoltBank CLI or local MCP bridge.
homepage: https://app.moltbank.bot
metadata:
  category: finance
  version: 2.0.0
  openclaw:
    requires:
      bins: ["moltbank"]
---

# MoltBank Skill For AI Agents

Use MoltBank when the user asks to inspect balances, list approvals, draft treasury payments, or interact with x402 endpoints.

## Preferred Execution Order

1. If a local MoltBank MCP server is already configured, use its tools.
2. Otherwise use the MoltBank CLI with `--json`.

## CLI Examples

- `moltbank balance --org "Organization Name" --json`
- `moltbank approvals list --json`
- `moltbank mcp call --tool propose_transaction --arg organizationName="Org Name" --arg accountName="Main" --arg amount=500 --json`
- `moltbank x402 signer init --json`
- `moltbank x402 inspect --url "https://api.example.com/protected" --json`
- `moltbank x402 pay --url "https://api.example.com/protected" --method GET --json`

## Authentication

If credentials are missing or unauthorized, ask the user to run:

`moltbank auth login`

Do not run hidden onboarding or background polling jobs.

## Boundaries

- Do not edit global OpenClaw configuration.
- Do not mutate sandbox defaults.
- Do not install software unless the user explicitly asks.
- Keep secrets local; never print full tokens or private keys.

## Write Operations

Before write operations (payment drafts, approvals, execution), confirm key inputs:
- organization
- account
- recipient
- amount
- chain (if applicable)
