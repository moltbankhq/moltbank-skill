# MoltBank compliance and trust disclosure

This document covers external endpoints, security boundaries, model invocation behavior, and operational tips for the MoltBank skill. It is the source of truth for ClawHub compliance review.

## External endpoints (runtime)

| Endpoint | Data sent | Purpose |
| :--- | :--- | :--- |
| `${APP_BASE_URL}/api/mcp` | Bearer token, tool call payloads (account names, amounts, addresses) | Treasury operations via MCP |
| `${APP_BASE_URL}/api/oauth/device/code` | Client ID | OAuth device flow initiation |
| `${APP_BASE_URL}/api/oauth/token` | Device code | OAuth token polling |
| x402 merchant URLs (user-specified) | HTTP request; on-chain payment signed locally | Paid x402 endpoint consumption |
| x402 merchant URLs (via inspector) | HTTP HEAD/GET to read 402 requirements | Pre-purchase requirement inspection |
| Base L2 RPC (via viem) | Signed transactions | On-chain USDC transfers and gas top-ups |

During install and plugin setup, the installer also fetches the skill bundle from `${APP_BASE_URL}` and updates `~/.openclaw/openclaw.json`.

## Security and privacy

By using this skill, treasury operation requests and metadata are sent to the MoltBank MCP server at `app.moltbank.bot`. Only install this skill if you trust MoltBank (Fondu Inc.) with your organization's treasury operation data.

Credentials and the x402 signer private key are stored locally in `${MOLTBANK_CREDENTIALS_PATH}`. The default operational flow does not print tokens to chat or logs. Explicit helpers (`export-api-key.mjs`, `--emit-token` flag on the OAuth poller) exist for admin use and output the active token to stdout when invoked directly.

The installer and plugin read and write `~/.openclaw/openclaw.json` in addition to the skill directory and credentials path.

### Operational boundaries

- Does not execute on-chain transactions without user approval, except for budget-scoped operations explicitly configured by account owners.
- Does not send credentials to the MCP server or third parties during normal treasury operations. Admin export helpers exist for local diagnostic use.
- Does not make network requests outside the endpoints listed above during runtime operations.

## Model invocation note

This skill may be invoked autonomously when the agent detects matching trigger conditions. This is standard OpenClaw behavior. To prevent autonomous invocation, disable the plugin via `openclaw config set plugins.entries.moltbank.enabled false` or remove the skill from your workspace.

## Tips

- Run `moltbank status` before debugging auth issues — it checks credentials, token validity, and active organization in one shot.
- Use `discover_x402_bazaar` when the user wants to browse available x402 endpoints before choosing a URL. If the user already has a specific x402 URL, use it directly.
- When the agent reports `AGENT_FROZEN`, do not retry — send the user to the dashboard to unfreeze.
- For transfers, call `check_bot_budget` first. If enough transfer budget is available, offer the choice between instant execution with budget and drafting a proposal for manual approval.
- If `mcporter` returns connection errors, check that the MCP server URL resolves correctly — sandbox and production URLs differ.
- The x402 signer wallet is local-only. Fund it with small amounts for individual purchases rather than pre-loading large balances.
- Use `analyze_spending_patterns` before recommending batching or budget changes — it provides data-backed projections the agent can reference.