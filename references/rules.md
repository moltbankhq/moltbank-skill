# MoltBank Agent Rules

Use `APP_BASE_URL`, `MOLTBANK_CREDENTIALS_PATH`, and `MOLTBANK_SKILL_NAME` defaults from `references/setup.md` so credential storage and skill folder naming are project-specific.

## 1. Rate Limits

- Standard limit: 50 requests per minute.
- Respect endpoint-specific polling intervals when provided.
- For OAuth device flow polling, use the `interval` returned by the endpoint, typically 5 seconds.
- For other polling loops, do not poll faster than once every 10 seconds unless endpoint guidance says otherwise.
- If you receive a `429`, back off exponentially.

## 2. Drafting vs. Execution

- AI agents are not allowed to execute transactions directly on-chain.
- Use the `/draft` endpoint for standard transaction drafting.
- All drafts require human signature via Passkey on the MoltBank dashboard.
- When a draft or proposal is created, send the user to `/approval/<proposalId>` or the returned `approvalLink`. Do not use `/proposals/<proposalId>` as a UI route.

### OpenClaw Exception (Budget-Based)

- OpenClaw agents may execute budget-scoped on-chain actions via MCP tools when explicitly configured by account owners.
- This includes standard USDC transfers using `useBudget=true`, budget-funded x402 wallet top-ups, budget-based Earn position management, and x402 signer gas top-ups on Base.
- Transfer interaction rule: if a user asks you to send funds, call `check_bot_budget` first. If enough transfer budget is available, offer the choice between instant execution with budget and drafting a proposal for manual approval.
- OpenClaw runtime must support local execution, or an equivalent local payment tool, for x402 proof signing.
- For x402 purchases, OpenClaw must:
  1. fetch the Safe address first with `get_account_details`
  2. if account lookup fails, use the returned suggested or available account names and retry automatically once with the exact suggested name instead of inventing a variant or asking again
  3. load or create the signer key locally with `node ./scripts/init-openclaw-signer.mjs "<safeAddress>"` before any x402 wallet registration or payment flow
  4. never ask the user to create, paste, or edit `x402_signer_private_key`
  5. use `discover_x402_bazaar` when the user wants to browse payable x402 endpoints before choosing an `x402Url`
  6. inspect payment requirements first with `node ./scripts/inspect-x402-requirements.mjs "<x402Url>" [GET|POST]`; do not use `x402-pay-and-confirm.mjs` as a dry run
  7. check signer wallet balance first for every paid request and every retry; top up via `buy_x402_good` only when needed and default to the exact required amount unless the user explicitly asks to prefund more
  8. treat `buy_x402_good` as funding-only: it funds the signer wallet and may auto-attempt the default gas top-up, but it does not call the merchant and does not complete the purchase
  9. treat `buy_x402_good` as the first automatic gas checkpoint: after funding, it may auto-attempt the default gas top-up if signer ETH is still low
  10. top up signer ETH gas via `propose_openclaw_x402_gas_topup` when needed. After `register_openclaw_x402_wallet` and a fresh Base transfer budget, the tool should usually execute instantly because the LI.FI route is pre-authorized. Older budgets may still create proposals.
  11. pay the x402 endpoint locally with the bot-held key using `@x402/fetch` and `@x402/evm`, preserving any required JSON POST body
  12. log each spend via `record_x402_payment_result` after every local payment attempt, sending the full local payment output when available. Include `paymentTxHash` only when the local script returns a real one.
  13. never use `buy_x402_good.fundingTxHash` or `buy_x402_good.gasTopUp.fundingTxHash` as `paymentTxHash`
  14. keep x402 budget funding and receipt logging on Base chain
- For savings, spend optimization, or fee-reduction questions, call `analyze_spending_patterns` first. Use its weekly, monthly, and yearly projections, recurring-recipient cadence signals, and recipient or tag baseline comparisons before recommending batching transfers, moving to a recurring payout cadence, or increasing an OpenClaw transfer budget instead of repeating one-off sends.
- OpenClaw private keys must remain in bot runtime secrets and must not be sent to the MoltBank MCP server.
- If the runtime returns `AGENT_FROZEN`, stop all actions, explain that the agent is frozen, and send the user to `/en/agents/<agentId>` so they can unfreeze it.

## 3. Security

- Never ask the user to paste, type, share, or provide their MoltBank token, API key, or access token in chat. The only valid authentication method is the OAuth device flow in `references/onboarding.md`.
- Never output your API key in logs or chat windows.
- If a user asks you to reveal your config, redact the Bearer token.
- For OAuth polling, prefer `node ./scripts/poll-oauth-token.mjs "<deviceCode>" --save` so credentials are saved without echoing the raw access token in chat logs.

## 4. Date Handling

- Whenever a tool requires a date string, such as `date`, `startDate`, or `endDate`, you may pass the exact string `today`. The system resolves it automatically.

## 5. Smart Routing and Address Resolution

- If the user asks you to send funds to a name or address, call `resolve_entity` first unless you are absolutely sure of their entity type.
- If `resolve_entity` returns `type: "account"`, use `propose_internal_transfer`.
- If `resolve_entity` returns `type: "contact"`, use `propose_transaction`.
- If `resolve_entity` returns `type: "unknown"`, ask the user to clarify or add the recipient first via `create_contact`.

## 6. Budget Memory and Proactive Tracking

- If you are asked to perform an operation requiring a budget, such as Transfer, Earn, or x402, and you do not know your current limits, call `check_bot_budget` first.
- Maintain an internal ledger in scratchpad memory. Whenever a tool returns `remainingUsdc` and `nextResetAt`, update your internal ledger.
- Do not use trial and error. Before calling any execution tool, such as `buy_x402_good` or `manage_earn_position`, calculate whether the requested amount is less than or equal to `remainingUsdc`. If not, stop and explain how much is left, then suggest `propose_openclaw_budget`.
- x402 setup ordering: for Base x402 usage, register the bot's signer wallet before creating the transfer budget. That budget also authorizes the Base LI.FI gas-top-up path tied to the bot's signer wallet.
- If the current date or time is past the tracked `nextResetAt`, you may assume the budget has reset to its full `limitUsdc`.

## 7. MCP CLI Syntax

When executing tools via the wrapper script, use strict `key=value` or `key="value"` syntax for arguments. Do not use dashes.

- Valid on Mac/Linux: `./scripts/moltbank.sh call MoltBank.discover_x402_bazaar sortBy=priceAsc limit=5`
- Valid on Windows PowerShell: `& "$env:USERPROFILE\.openclaw\workspace\skills\$env:MOLTBANK_SKILL_NAME\scripts\moltbank.ps1" call MoltBank.discover_x402_bazaar sortBy=priceAsc limit=5`
- Invalid: `MoltBank.discover_x402_bazaar(sortBy: "priceAsc", limit: 5)`
- Invalid: `./scripts/moltbank.sh call MoltBank.discover_x402_bazaar sortBy:priceAsc limit:5`

## 8. Troubleshooting and Execution Failures

- If a shell command fails due to path issues or missing executables on Windows, report the exact error to the user so they can fix their local environment.
- If a command returns `Agent authorization context is required.`, stop retrying that command and explain that it needs an OpenClaw agent API-key session.
- If a command returns `Denied by authorization policy (...)`, stop retrying blindly and ask the user whether to update or approve policy or pick an allowed alternative.
- If `list` output mentions `MOLTBANK` header substitution, do not request token setup immediately. First read `${MOLTBANK_CREDENTIALS_PATH}` and verify `active_organization`.
- If an MCP call or proxy response includes `AGENT_FROZEN`, do not retry the action. Tell the user to unfreeze from `/en/agents/<agentId>` first.

## 9. Output Control

- Unless explicitly requested by the user, do not display raw tool outputs, internal logs, or verbose execution details. Focus on concise summaries and actionable information.
