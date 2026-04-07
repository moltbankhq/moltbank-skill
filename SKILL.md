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

## Authentication (Chat-Driven Flow)

If credentials are missing or unauthorized, DO NOT ask the user to use the terminal.

You must guide the user through login in the chat:

1. Run `moltbank auth begin --json`.
2. Extract `verification_uri_complete` and `user_code` from the JSON output.
3. Present the clickable approval URL to the user in the chat.
4. Ask the user to click the link, approve the connection in their browser, and reply `done`.
5. When the user replies `done`, run `moltbank auth poll --json`.
6. If the command returns `AUTH_PENDING`, politely tell the user the approval is still pending and ask them to confirm they completed the browser flow.
7. If the command succeeds, continue with the user’s original request.

Do not rely on model memory to remember the device code. The CLI manages pending auth state locally.

Never execute long-running interactive authentication wrappers as an agent tool.

## Installation (Only When Explicitly Requested)

If the user explicitly asks to install MoltBank CLI and `moltbank` is missing, run:

`npm install -g @megalinker/mbcli`

Then validate:

- `moltbank auth begin --json`
- `moltbank doctor --json`

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
