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
- x402 signer/inspect/pay actions

## Preferred Execution Order

1. If MCP tools are available, use MCP first.
2. If MCP tools are unavailable, discover exact CLI contract first:
   - `moltbank schema --json`
   - `moltbank schema <command> --json`
   - or command `--help`
3. Execute CLI commands with `--json`.

## Hard Rule

Do not guess flags, argument names, or tool input shapes from memory.
Always discover exact usage on demand from MCP tool schemas or CLI schema/help.

## Auth Summary

Authentication is chat-driven:
1. `moltbank auth begin --json`
2. Share `verification_uri_complete` + `user_code` with the user
3. After user confirms approval, run `moltbank auth poll --json`
4. If pending, ask user to finish browser approval and poll again

Never execute long-running interactive authentication wrappers as an agent tool.

## Boundaries

- Do not edit global OpenClaw configuration.
- Do not mutate sandbox defaults.
- Do not install software unless the user explicitly asks.
- Keep secrets local; never print full tokens or private keys.
