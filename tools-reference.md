## Tool reference (inputs and validations)

Critical execution rule:
Always use the wrapper script to call tools. Never call `mcporter` directly.

Assumes `MOLTBANK_SKILL_NAME` has already been set from `setup.md`.

Mac/Linux:

```bash
cd "${OPENCLAW_WORKSPACE:-$HOME/.openclaw/workspace}/skills/${MOLTBANK_SKILL_NAME:-MoltBank}"
./scripts/moltbank.sh call MoltBank.<tool_name> param1=value1 param2=value2
```

Windows (PowerShell):

```powershell
$wrapper = "$env:USERPROFILE\.openclaw\workspace\skills\$env:MOLTBANK_SKILL_NAME\scripts\moltbank.ps1"
& $wrapper call MoltBank.<tool_name> param1="value1" param2="value2"
```

Use only `key=value` arguments with the wrapper script. Never use function-call syntax or `param:value` syntax.

Canonical example:

Mac/Linux:

```bash
./scripts/moltbank.sh call MoltBank.discover_x402_bazaar sortBy=priceAsc limit=5
```

Windows (PowerShell):

```powershell
$wrapper = "$env:USERPROFILE\.openclaw\workspace\skills\$env:MOLTBANK_SKILL_NAME\scripts\moltbank.ps1"
& $wrapper call MoltBank.discover_x402_bazaar sortBy=priceAsc limit=5
```

Commands like `node ./scripts/init-openclaw-signer.mjs ...`, `node ./scripts/inspect-x402-requirements.mjs ...`, and `node ./scripts/x402-pay-and-confirm.mjs ...` are the same on Mac/Linux and Windows PowerShell once you are already in the skill directory.

---

### Treasury and balances

#### `get_balance`

Description: get USDC balance for one or all accounts in an organization for a specific date.

| Input | Required | Type | Validation / description |
| :---- | :------- | :--- | :----------------------- |
| `organizationName` | Yes | string | Must match the org bound to the token. |
| `date` | Yes | string | `YYYY-MM-DD` format or `today`. |
| `accountName` | No | string | If omitted, returns all accounts. |
| `timezone` | No | string | IANA timezone. If omitted, UTC is used. |

#### `get_account_details`

Description: get details for a specific account, including Safe address, owners, and threshold.

| Input | Required | Type | Validation / description |
| :---- | :------- | :--- | :----------------------- |
| `organizationName` | Yes | string | Name of the organization. |
| `accountName` | Yes | string | Name of the account. |

Behavior:

- If the supplied name is close but not exact, the tool may resolve the closest unique account or return the available account list.
- Reuse the exact returned account name in later calls.
- There is no `list_accounts` tool. If account name is unknown, discover it first with `get_balance` and omit `accountName`.

---

### Payments and transactions

#### `draft_payment`

Description: create a draft payment proposal for human review. Does not send funds immediately.

| Input | Required | Type | Validation / description |
| :---- | :------- | :--- | :----------------------- |
| `organizationName` | Yes | string | Organization to pay from. |
| `accountName` | No | string | Defaults to `Main` if omitted. |
| `recipientIdentity` | Yes | string | Email, wallet address, or contact name. |
| `amount` | Yes | number | Positive USDC amount. |
| `memo` | Yes | string | Invoice number or description. |
| `sourceUrl` | No | string | URL to the source invoice file. |

#### `propose_transaction`

Description: initiate a payment to an external contact. Can be drafted as a proposal or executed instantly with bot allowance.

| Input | Required | Type | Validation / description |
| :---- | :------- | :--- | :----------------------- |
| `organizationName` | Yes | string | Organization. |
| `accountName` | Yes | string | Account name. |
| `contactName` | No | string | Contact name if not using address. |
| `recipientAddress` | No | string | Wallet address if not using contact. |
| `amount` | Yes | number | Positive USDC amount. |
| `notes` | No | string | Optional notes. |
| `useAllowance` | No | boolean | `true` executes instantly using allowance. Defaults to `false`. |

If `useAllowance=false` and a proposal is created, use the returned `approvalLink` or `/approval/<proposalId>`.

#### `propose_internal_transfer`

Description: transfer USDC between two accounts. Can be drafted as a proposal or executed instantly with bot allowance.

| Input | Required | Type | Validation / description |
| :---- | :------- | :--- | :----------------------- |
| `sourceOrganizationName` | Yes | string | Source organization. |
| `sourceAccountName` | Yes | string | Source account. |
| `destinationOrganizationName` | Yes | string | Destination organization. |
| `destinationAccountName` | Yes | string | Destination account. |
| `amount` | Yes | number | Positive USDC amount. |
| `notes` | No | string | Optional notes. |
| `useAllowance` | No | boolean | `true` executes instantly using allowance. Defaults to `false`. |

#### `cancel_proposal`

Description: cancel a pending transaction proposal or draft.

| Input | Required | Type | Validation / description |
| :---- | :------- | :--- | :----------------------- |
| `identifier` | Yes | string | The proposal ID to cancel. |

#### `list_pending_approvals`

Description: list all transaction proposals waiting for human signature. No arguments required.

#### `get_transaction_details`

Description: fetch status and details for a single transaction.

| Input | Required | Type | Validation / description |
| :---- | :------- | :--- | :----------------------- |
| `identifier` | Yes | string | Transaction ID or transaction hash. |

---

### History and reporting

#### `get_transaction_history`

Description: list transactions within a date range.

| Input | Required | Type | Validation / description |
| :---- | :------- | :--- | :----------------------- |
| `organizationName` | Yes | string | Organization. |
| `accountName` | No | string | If omitted, applies to all accounts. |
| `startDate` | Yes | string | Start date or `today`. |
| `endDate` | Yes | string | End date or `today`. |
| `minAmount` | No | number | Optional filter. |
| `maxAmount` | No | number | Optional filter. |
| `keyword` | No | string | Optional search. |

#### `analyze_spending_patterns`

Description: analyze executed outgoing spend over a date range and return rule-based insights.

| Input | Required | Type | Validation / description |
| :---- | :------- | :--- | :----------------------- |
| `organizationName` | Yes | string | Organization. |
| `accountName` | No | string | If omitted, analyzes all accounts in the organization. |
| `startDate` | Yes | string | Start date or `today`. |
| `endDate` | Yes | string | End date or `today`. |
| `microTransactionThresholdUsdc` | No | number | Optional small-transfer threshold. Defaults to `10`. |
| `contactTags` | No | string[] | Optional recipient tags. |
| `contactNames` | No | string[] | Optional specific recipients. |

Behavior:

- Focuses on executed outgoing spend only.
- Excludes inbound receipts and pending proposals.
- Returns weekly, monthly, and yearly projections, recurring-recipient cadence signals, estimated fee overhead, and before or after comparisons when filters are supplied.

#### `list_recent_transactions`

Description: list the most recent transactions.

| Input | Required | Type | Validation / description |
| :---- | :------- | :--- | :----------------------- |
| `organizationName` | Yes | string | Organization. |
| `limit` | Yes | number | Positive integer, max transactions to return. |
| `accountName` | No | string | Filter by account. |
| `contactName` | No | string | Filter by contact. |

#### `find_last_transaction`

Description: find the most recent single transaction with a given contact.

| Input | Required | Type | Validation / description |
| :---- | :------- | :--- | :----------------------- |
| `organizationName` | Yes | string | Organization. |
| `contactName` | Yes | string | Contact name. |
| `direction` | Yes | enum | `sent` or `received`. |

#### `search_transactions`

Description: search crypto payments to or from a specific recipient in a date range.

| Input | Required | Type | Validation / description |
| :---- | :------- | :--- | :----------------------- |
| `organizationName` | Yes | string | Organization. |
| `contactName` | Yes | string | Recipient or sender contact name. |
| `startDate` | Yes | string | Start date or `today`. |
| `endDate` | Yes | string | End date or `today`. |
| `direction` | Yes | enum | `sent` or `received`. |

#### `get_spending_report`

Description: analyze spending, for example top recipients by volume.

| Input | Required | Type | Validation / description |
| :---- | :------- | :--- | :----------------------- |
| `organizationName` | Yes | string | Organization. |
| `startDate` | Yes | string | Start date or `today`. |
| `endDate` | Yes | string | End date or `today`. |
| `limit` | Yes | number | Positive integer. |

#### `get_balance_analytics`

Description: analytical balance metrics for an account over a period.

| Input | Required | Type | Validation / description |
| :---- | :------- | :--- | :----------------------- |
| `organizationName` | Yes | string | Organization. |
| `accountName` | Yes | string | Account. |
| `startDate` | Yes | string | Start date or `today`. |
| `endDate` | Yes | string | End date or `today`. |

#### `get_cash_flow_summary`

Description: total inflows, outflows, and net flow for a period.

| Input | Required | Type | Validation / description |
| :---- | :------- | :--- | :----------------------- |
| `organizationName` | Yes | string | Organization. |
| `accountName` | No | string | If omitted, org-level summary. |
| `startDate` | Yes | string | Start date or `today`. |
| `endDate` | Yes | string | End date or `today`. |

#### `get_financial_trends`

Description: month-over-month financial trends.

| Input | Required | Type | Validation / description |
| :---- | :------- | :--- | :----------------------- |
| `organizationName` | Yes | string | Organization. |
| `metric` | Yes | enum | `outflow`, `inflow`, or `net`. |

---

### Contacts

#### `create_contact`

| Input | Required | Type | Validation / description |
| :---- | :------- | :--- | :----------------------- |
| `organizationName` | Yes | string | Organization. |
| `contactName` | Yes | string | Display name for the contact. |
| `walletAddress` | Yes | string | Wallet address. |

#### `update_contact`

| Input | Required | Type | Validation / description |
| :---- | :------- | :--- | :----------------------- |
| `organizationName` | Yes | string | Organization. |
| `currentContactName` | Yes | string | Current contact name. |
| `newWalletAddress` | No | string | New wallet address. |
| `newContactName` | No | string | New display name. |

#### `delete_contact`

| Input | Required | Type | Validation / description |
| :---- | :------- | :--- | :----------------------- |
| `organizationName` | Yes | string | Organization. |
| `contactName` | Yes | string | Contact name. |

#### `resolve_entity`

Description: resolve a name or wallet address to determine whether it is an internal account or an external contact.

| Input | Required | Type | Validation / description |
| :---- | :------- | :--- | :----------------------- |
| `organizationName` | Yes | string | Organization. |
| `query` | Yes | string | Name, alias, or wallet address to find. |

#### `get_contact_details`

| Input | Required | Type | Validation / description |
| :---- | :------- | :--- | :----------------------- |
| `organizationName` | Yes | string | Organization. |
| `contactName` | Yes | string | Contact name. |

#### `list_contacts`

| Input | Required | Type | Validation / description |
| :---- | :------- | :--- | :----------------------- |
| `organizationName` | Yes | string | Organization. |

---

### Team and onboarding

#### `invite_member`

| Input | Required | Type | Validation / description |
| :---- | :------- | :--- | :----------------------- |
| `organizationName` | Yes | string | Organization. |
| `identifier` | Yes | string | Email address or username of the invitee. |
| `type` | Yes | enum | `email` or `username`. |

### Earn (Aave)

Rule: validations before Aave deposit or withdraw.

- Deposit: call `get_balance` first. If requested amount exceeds account balance, do not call the tool.
- Withdraw: call `get_aave_balance` first. If requested amount exceeds Aave balance, do not call the tool.
- If validation passes, show data for confirmation and then call the tool.

#### `manage_earn_position`

Description: deposit to or withdraw from Aave using bot allowance.

| Input | Required | Type | Validation / description |
| :---- | :------- | :--- | :----------------------- |
| `organizationName` | Yes | string | Organization. |
| `accountName` | Yes | string | Account. |
| `action` | Yes | enum | `deposit` or `withdraw`. |
| `amount` | Yes | number | Positive USDC amount. |

#### `get_aave_balance`

Description: get USDC balance deposited in Aave for an account.

| Input | Required | Type | Validation / description |
| :---- | :------- | :--- | :----------------------- |
| `organizationName` | Yes | string | Organization. |
| `accountName` | Yes | string | Account. |

#### `propose_earn_internal`

Description: create a regular internal proposal for Aave deposit or withdraw.

| Input | Required | Type | Validation / description |
| :---- | :------- | :--- | :----------------------- |
| `organizationName` | Yes | string | Organization. |
| `accountName` | Yes | string | Account. |
| `action` | Yes | enum | `deposit` or `withdraw`. |
| `amount` | Yes | number | Positive USDC amount. |

---

### OpenClaw allowances

#### `propose_openclaw_allowance`

Description: create a proposal to grant this OpenClaw bot allowance on an account. Positive `transferLimitUSDC` can pre-authorize the Base x402 signer gas top-up route after the initial allowance approval.

Critical validation and casing rules:

- At least one of `earnLimitUSDC` or `transferLimitUSDC` must be greater than `0`.
- `period` is required: `Day`, `Week`, or `Month`.
- Use exact field casing: `transferLimitUSDC`.

| Input | Required | Type | Validation / description |
| :---- | :------- | :--- | :----------------------- |
| `organizationName` | Yes | string | Organization. |
| `accountName` | Yes | string | Account. |
| `earnLimitUSDC` | No | number | Non-negative Earn allowance limit. |
| `transferLimitUSDC` | No | number | Non-negative transfer allowance limit. |
| `chain` | No | enum | `base`. Default: `base`. |
| `period` | Yes | enum | `Day`, `Week`, or `Month`. |
| `startsAtUnix` | No | number | Positive Unix timestamp in seconds. |

Behavior:

- On Base, register the bot signer first with `register_openclaw_x402_wallet` before creating a transfer allowance.
- The allowance proposal can bind the Base LI.FI gas-top-up route to that signer wallet.
- The response includes `hasX402Preauthorization` so you can confirm whether the reusable Base gas route was embedded in the allowance proposal.
- The LI.FI gas-top-up action shares the same transfer budget, so x402 gas top-ups consume the existing transfer allowance instead of a separate hidden budget.

Canonical wrapper example (Mac/Linux):

```bash
./scripts/moltbank.sh call MoltBank.propose_openclaw_allowance organizationName="Acme" accountName="Main" chain="base" transferLimitUSDC=20 period="Day"
```

Canonical wrapper example (Windows PowerShell):

```powershell
$wrapper = "$env:USERPROFILE\.openclaw\workspace\skills\$env:MOLTBANK_SKILL_NAME\scripts\moltbank.ps1"
& $wrapper call MoltBank.propose_openclaw_allowance organizationName="Acme" accountName="Main" chain="base" transferLimitUSDC=20 period="Day"
```

---

### OpenClaw x402

#### `discover_x402_bazaar`

Description: browse the public x402 Bazaar catalog from the Coinbase CDP facilitator to discover payable x402 endpoints before choosing an `x402Url`.

| Input | Required | Type | Validation / description |
| :---- | :------- | :--- | :----------------------- |
| `type` | No | string | Protocol type filter. Defaults to `http`. |
| `limit` | No | number | Positive integer, max 100. Defaults to 20. |
| `offset` | No | number | Non-negative pagination offset. |
| `query` | No | string | Optional keyword filter. |
| `network` | No | string | Optional payment network filter, for example `eip155:8453`. |
| `maxPriceUsdc` | No | number | Optional max price filter. |
| `sortBy` | No | enum | `updated`, `priceAsc`, or `relevance`. |

Behavior:

- Returns Bazaar resources, accepts data, metadata, and pagination.
- Discovery is read-only and does not spend allowance.
- Before `buy_x402_good`, run `node ./scripts/inspect-x402-requirements.mjs "<x402Url>" [GET|POST]` to read the exact required amount.

#### `register_openclaw_x402_wallet`

Description: register the OpenClaw bot wallet address for x402 purchases. Only available to OpenClaw agent sessions.

Agent instruction: before calling this tool, fetch the Safe address with `get_account_details` and run `node ./scripts/init-openclaw-signer.mjs "<safeAddress>"`. If the signer key is missing, create it locally. Do not ask the user to edit `credentials.json`.

| Input | Required | Type | Validation / description |
| :---- | :------- | :--- | :----------------------- |
| `walletAddress` | Yes | string | Base wallet address. |

#### `check_openclaw_x402_gas_balance`

Description: check whether the registered x402 signer wallet has enough ETH gas on Base before local x402 payment execution.

| Input | Required | Type | Validation / description |
| :---- | :------- | :--- | :----------------------- |
| `organizationName` | Yes | string | Organization. |
| `accountName` | Yes | string | Account. |
| `lowBalanceThresholdEth` | No | number | Positive ETH threshold for low-gas detection. |
| `suggestedTopUpUsdc` | No | number | Positive USDC suggestion shown when gas is low. |

Behavior:

- Returns `status: "low"` when signer ETH is below the threshold.
- When low, ask the user whether they want to top up gas.
- The user can choose a lower top-up amount, but warn that future x402 payments may fail when gas runs out.

#### `propose_openclaw_x402_gas_topup`

Description: top up signer ETH gas from Safe funds via the Base LI.FI path. New Base transfer allowances normally pre-authorize this route, so the tool should execute instantly after allowance approval. Older allowances may still fall back to ordered approval proposals.

| Input | Required | Type | Validation / description |
| :---- | :------- | :--- | :----------------------- |
| `organizationName` | Yes | string | Organization. |
| `accountName` | Yes | string | Account. |
| `topUpUsdc` | No | number | Positive top-up amount in USDC. Defaults to the configured value, usually around 1. |

Behavior:

- Checks OpenClaw transfer allowance before executing or creating proposals.
- If the allowance was created after the signer wallet was registered, it should usually execute instantly and send ETH to the signer wallet directly.
- Otherwise it may create ordered approval proposals.

#### `buy_x402_good`

Description: use OpenClaw transfer allowance to fund the registered bot x402 wallet on Base. Call this only when the bot wallet balance is insufficient. The amount must come from the x402 payment requirements, not from a guessed user input. After funding, the tool also checks signer gas and attempts the default gas top-up automatically when signer ETH is still low.

| Input | Required | Type | Validation / description |
| :---- | :------- | :--- | :----------------------- |
| `organizationName` | Yes | string | Organization. |
| `accountName` | Yes | string | Account. |
| `x402Url` | Yes | string | Valid URL of the x402 good. |
| `amount` | Yes | number | Positive USDC amount from the x402 requirements. |

Behavior:

- Funding-only step: this tool does not call the x402 merchant endpoint.
- Funds the signer wallet with USDC for the x402 payment.
- A `status: "funded"` response means the signer can attempt the local payment next. It does not mean the purchase already succeeded.
- Re-check signer wallet USDC before every retry or new paid x402 request.
- If signer ETH is already sufficient, `gasTopUp.result` is `not_needed`.
- If signer ETH is low, the tool attempts the default gas top-up immediately.

#### `record_x402_payment_result`

Description: record an immutable x402 payment audit row after the bot pays locally on Base. Use the real payment tx hash from the local script when available, never a funding hash from `buy_x402_good`.

| Input | Required | Type | Validation / description |
| :---- | :------- | :--- | :----------------------- |
| `organizationName` | Yes | string | Organization. |
| `accountName` | Yes | string | Account linked to the bot allowance and wallet. |
| `x402Url` | Yes | string | Valid URL of the x402 good that was paid. |
| `paymentHttpStatus` | No | number | Integer 100 to 599. |
| `paidAmount` | No | number | Positive USDC amount actually paid. |
| `paymentTxHash` | No | string | 0x-prefixed 64-char hex. |
| `fundingProposalId` | No | string | UUID of the funding proposal returned by `buy_x402_good`. |
| `fundingTxHash` | No | string | Funding tx hash for linkage only. |
| `requestMethod` | No | string | HTTP method used by the local payment step. |
| `contentType` | No | string | Merchant response content type if known. |
| `merchantPayload` | No | any | Parsed merchant response body to persist. |
| `settlementReceipt` | No | any | Settlement metadata returned by the x402 client if any. |
| `localPaymentResult` | No | any | Full JSON output from `x402-pay-and-confirm.mjs`. |

Validation:

- If provided, `paymentTxHash` must match `^0x[a-fA-F0-9]{64}$`.
- `paidAmount` must resolve to greater than `0` either directly or from `localPaymentResult.paidAmountUsdc`.
- `paymentTxHash` must come from the local x402 payment script output, not from funding or gas-top-up hashes.

#### `list_x402_payment_receipts`

Description: list recorded x402 payment receipts for an organization.

| Input | Required | Type | Validation / description |
| :---- | :------- | :--- | :----------------------- |
| `organizationName` | Yes | string | Organization. |
| `accountName` | No | string | Optional account filter. |
| `x402Url` | No | string | Optional exact x402 URL filter. |
| `success` | No | boolean | Optional success or failure filter. |
| `limit` | No | number | Positive integer, max 100. Defaults to 25. |

---

### Allowance introspection

#### `check_bot_allowances`

Description: return current remaining bot allowances and reset timestamps for transfer and earn limits.

| Input | Required | Type | Validation / description |
| :---- | :------- | :--- | :----------------------- |
| `organizationName` | Yes | string | Organization. |
| `accountName` | Yes | string | Account. |
| `chain` | No | enum | `base`. Default: `base`. |

Use this before high-cost actions to avoid expected allowance failures.
