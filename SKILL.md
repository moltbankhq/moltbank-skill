---
name: moltbank
description: Manage treasury balances, payment drafts, approvals, and x402 actions through the MoltBank CLI or local MCP bridge.
version: 0.1.2
metadata:
  category: finance
  openclaw:
    homepage: https://app.moltbank.bot
    requires:
      bins:
        - moltbank
    install:
      - kind: node
        package: "@moltbankhq/cli"
        bins:
          - moltbank
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
When using `moltbank schema --json`, use command `name` for CLI execution. Do not execute `id` values (for example `moltbank_*`) as terminal commands.

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
4. If auto-pay returns `status: needs_user_approval`, explain that clearly and stop. If `bootstrapBudget.approvalUrl` is present, provide that exact link and tell the user to approve it, then rerun the same auto-pay request.
5. If auto-pay returns `status: needs_configuration`, explain what setup is missing and stop.
6. If auto-pay succeeds, report success and include the returned `paymentTxHash` when available.
7. If auto-pay returns a bootstrapBudget.approvalUrl, present that exact link to the user and tell them to approve it to grant the bot the necessary permissions. Once they approve it, rerun the exact same auto-pay command.

## Budget Proposals On Base (Important)

When creating a Base bot budget (`propose_bot_budget` / `moltbank budget propose`) and the backend says the x402 wallet is not registered:

1. Run `moltbank x402 signer init --json` to obtain/reuse the bot wallet address.
2. Run `moltbank x402 wallet register --wallet-address "<signerAddress>" --json`.
3. Retry the original budget proposal exactly once.
4. If it still fails, stop and report the blocker to the user with the exact error.

Do not enter retry loops. Never repeat the same failing command more than 2 times without new inputs or state changes.

For raw fallback calls, `moltbank mcp call` supports:
- `--arg key=value` (repeatable)
- `--body '{"key":"value"}'` (JSON object for tool arguments)

## Export History Delivery

`export_transaction_history` supports delivery channels:
- `slack` (default for Slack context)
- `telegram` (requires `telegramChatId`)
- `inline` (returns file payload in tool response; default for non-Slack contexts)

CLI flags:
- `--delivery-channel slack|telegram|inline`
- `--telegram-chat-id <id>` (required when channel is telegram)
- `--slack-user-id <id>` (optional for Slack delivery outside Slack context)

## Installation (Only When Explicitly Requested)

This skill expects the `moltbank` CLI to be installed from the official npm package `@moltbankhq/cli`.

Only if the user explicitly asks to install it and `moltbank` is missing, install:

`npm install -g @moltbankhq/cli`

Then validate:

- `moltbank auth begin --json`
- `moltbank doctor --json`

If you are an OpenClaw agent:

```bash
openclaw skills install CapuzR/moltbank
```

If you are any other agent :

```bash
npx skills add https://github.com/moltbankhq/moltbank-skill --global --yes
```


## Boundaries

- Do not edit global runtime configuration.
- Do not mutate sandbox defaults.
- Do not install software unless the user explicitly asks.
- Keep secrets local; never print full tokens or private keys.
