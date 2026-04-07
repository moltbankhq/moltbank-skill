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

Use MoltBank for:
- authentication pairing
- treasury balance reads
- pending approval reads
- payment drafting
- x402 discovery and one-shot auto-pay actions

## Preferred Execution Order

1. If MCP tools are available, use MCP first.
2. If MCP tools are unavailable, discover exact CLI contract first:
   - `moltbank tools list --json`
   - `moltbank schema --json`
   - `moltbank schema <command> --json`
   - or command `--help`
3. Execute CLI commands with `--json`.

## Hard Rule

Do not guess flags, argument names, or tool input shapes from memory.
Always discover exact usage on demand from MCP tool schemas or CLI schema/help.

When the user asks "what tools/functions can I use", run `moltbank tools list --json` and answer from that output.

# Authentication (Chat-Driven Flow)

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

## x402 Payments

When the user asks to buy or use an x402-protected endpoint:

1. If the exact x402 URL is known, use `moltbank_x402_auto_pay`.
2. If the URL is not known, use `moltbank_discover_x402_bazaar` first, then use `moltbank_x402_auto_pay`.
3. Do not manually orchestrate signer init, wallet registration, inspect, treasury funding, payment execution, or receipt logging. `moltbank_x402_auto_pay` handles those steps.
4. If auto-pay returns `status: needs_user_approval`, explain that clearly and stop.
5. If auto-pay returns `status: needs_configuration`, explain what setup is missing and stop.
6. If auto-pay succeeds, report success and include the returned `paymentTxHash` when available.

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
