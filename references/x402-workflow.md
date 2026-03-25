## Skill: OpenClaw x402 payment (sequential workflow)

**When to use this skill:** When the user wants to pay for an x402 good (paid API or resource) using MoltBank and OpenClaw, or when the user asks to set up x402 for an organization.

**Scope:** One EOA wallet per organization on **Base** (Base mainnet or Base Sepolia by environment). The wallet's private key is stored only in `${MOLTBANK_CREDENTIALS_PATH}` (or `$env:MOLTBANK_CREDENTIALS_PATH` on Windows). The private key is never sent to MoltBank or to any server; it is used only locally to sign the x402 payment.

`MOLTBANK_CREDENTIALS_PATH` is derived from `APP_BASE_URL` (otherwise `.MoltBank`).
`MOLTBANK_SKILL_NAME` is derived from `APP_BASE_URL` ( otherwise `MoltBank`).

**Rule:** The only way to make x402 payments with MoltBank is through the MCP tools (**register_openclaw_x402_wallet**, **check_openclaw_x402_gas_balance**, **propose_openclaw_x402_gas_topup**, **buy_x402_good**, **record_x402_payment_result**) and, when discovery is needed, **discover_x402_bazaar**. Follow the **sequential** procedure below. Do not suggest any other procedure. **SEQUENTIAL EXECUTION MANDATORY:** each step must complete successfully before the next; **STOP** the entire workflow if any step fails.

**x402Url from the user:** If the user already knows the x402 URL, ask for it before starting the payment workflow. If they want to browse payable endpoints first, call **discover_x402_bazaar** to list Bazaar resources, let them choose one `resource`, and then treat that URL as the `x402Url` for the rest of the workflow. The tool name is shorthand only: the actual wrapper command is `./scripts/moltbank.sh call MoltBank.discover_x402_bazaar ...` on Mac/Linux or `& "$env:USERPROFILE\.openclaw\workspace\skills\$env:MOLTBANK_SKILL_NAME\scripts\moltbank.ps1" call MoltBank.discover_x402_bazaar ...` on Windows. Do not run `./scripts/moltbank.sh discover_x402_bazaar ...`.

---

### Prerequisites check (before Step 1)

Run these checks before each x402 payment flow. Use installed files; do not re-download files on every payment request.

1. Ensure you are in the skill directory: `skills/${MOLTBANK_SKILL_NAME:-MoltBank}` (relative to your OpenClaw workspace).
2. Verify that `scripts/init-openclaw-signer.mjs`, `scripts/inspect-x402-requirements.mjs`, `scripts/x402-pay-and-confirm.mjs`, `scripts/moltbank.sh`, and `assets/mcporter.json` exist.
3. Verify dependencies by running: `node -e "import('@x402/fetch').then(() => process.exit(0)).catch(() => process.exit(1))"`

If any check fails:

1. Run the installation command appropriate for your OS from `skill.md` once.
2. Re-run the checks above.
3. If checks still fail, stop and report the exact error (do not continue to Step 1).

---

### Sequential x402 workflow (9 steps, prefund + gas + receipts)

| Step | Name                          | When                                  | Description                                                                                                                                                                                                                                                                                                        |
| ---- | ----------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | Initialize wallet             | Always                                | Load/create the organization x402 EOA and keep it in credentials.                                                                                                                                                                                                                                                  |
| 2    | Read payment requirements     | Always                                | Run the local inspection helper, normalize either header-based or body-based x402 requirements, extract the required amount, and enforce the sanity limit (>5 USDC requires explicit confirmation).                                                                                                                |
| 3    | Validate wallet ≠ Safe        | Only if wallet is new or unvalidated  | Ensure signer wallet is not any treasury Safe address.                                                                                                                                                                                                                                                             |
| 4    | Register wallet with MoltBank | Only if wallet is new or unregistered | Call **register_openclaw_x402_wallet** once for this signer wallet.                                                                                                                                                                                                                                                |
| 5    | Top up USDC only if needed    | Conditional                           | Check signer wallet USDC on every paid request and every retry before deciding to skip funding. Call **buy_x402_good** only if current balance is insufficient; default to the exact required amount, not a large prefund. After funding, it also auto-attempts the default gas top-up if signer ETH is still low. |
| 6    | Check signer ETH gas          | Always                                | Call **check_openclaw_x402_gas_balance** to verify signer ETH before local payment execution (especially if Step 5 was skipped or auto-top-up could not complete).                                                                                                                                                 |
| 7    | Ask user for gas top-up       | Conditional (`status: "low"`)         | Ask if user wants ETH gas top-up via LI.FI. Suggest default ~1 USDC (configurable), allow lower amount, and warn that future x402 payments may fail when gas runs out.                                                                                                                                             |
| 8    | Execute or propose gas top-up | Conditional                           | Call **propose_openclaw_x402_gas_topup**. If the transfer allowance was created after **register_openclaw_x402_wallet**, it should already cover the LI.FI route and execute instantly. Older allowances still return ordered proposals (optional approval, LI.FI swap, then ETH transfer Safe -> signer).         |
| 9    | Execute + receipt logging     | Always                                | Run the local payment script and then call **record_x402_payment_result** with the full local payment output. Include the payment tx hash when the merchant exposes one, but still log the attempt when it does not.                                                                                               |

**Optimization:** For existing validated/registered wallets, usual path is **1 → 2 → 5 (often skipped after an actual signer USDC check) → 6 → 9**. Never skip Step 5 by assumption.

**Amount from x402 URL:** The payment amount is **never** from user input alone. It must be obtained in **Step 2** from the output of `node ./scripts/inspect-x402-requirements.mjs "<x402Url>" [GET|POST]`. That command is the same on Mac/Linux and Windows PowerShell once you are already in the skill directory. Use the helper's normalized `amountRaw` / `amountUsdc` output, not a guess.

---

### x402 402 response format (Step 2)

For this integration, prefer the local helper script. Once you are already in the skill directory, this exact `node` command is the same on Mac/Linux and Windows PowerShell:

```text
node ./scripts/inspect-x402-requirements.mjs "<x402Url>" [GET|POST]
```

The helper supports both of these formats:

#### Format A: `Payment-Required` header

```http
HTTP/1.1 402 Payment Required
Payment-Required: <base64-encoded-json>
```

`Payment-Required` contains Base64-encoded JSON with payment requirements (including `amount`, `asset`, `payTo`).
The helper decodes the Base64 value and normalizes the selected payment requirement.

#### Format B: x402 v1 JSON body

Some Bazaar resources return `402` with a JSON body instead of the `Payment-Required` header. In that case, the body contains `x402Version: 1` plus an `accepts` array. The helper uses the best matching requirement (prefer `exact`, prefer Base) and reads `amount` or `maxAmountRequired`.

Use the helper's normalized `amountRaw` and `amountUsdc` output for **buy_x402_good** and for the payment plan in Step 9.

---

### Credentials and wallet state (optional)

You may track wallet state in your local credentials file to decide when to run Step 3 and Step 4:

```json
{
  "organizations": [
    {
      "name": "Acme",
      "access_token": "sk_live_...",
      "x402_signer_private_key": "0x...",
      "x402_wallet": {
        "address": "0x...",
        "validated": true,
        "registered": true
      }
    }
  ],
  "active_organization": "Acme"
}
```

- If `x402_wallet.validated` is true and `x402_wallet.registered` is true: skip Step 3 and Step 4.
- If the wallet is new or not validated/registered: run Step 3 (validate ≠ Safe) and Step 4 (register_openclaw_x402_wallet).

---

### Prerequisites

- Authenticated session with MoltBank (credentials and active organization).
- The account must have an approved OpenClaw **transfer** allowance (`propose_openclaw_allowance` with `transferLimitUSDC` > 0).
- On Base, create that allowance only after **register_openclaw_x402_wallet** so the LI.FI gas-top-up route is pre-authorized for the bot's own signer wallet.
- If **buy_x402_good** returns `missing_allowance` or `insufficient_allowance`, **STOP** and guide the user to create or approve an allowance before retrying.

---

### Step 1: Initialize / load x402 wallet

**Always.** Fetch the Safe address first with `get_account_details`, then initialize the signer locally. If account lookup fails, reuse the exact suggested account name returned by the tool and retry. If the tool returns one clear corrected account name, retry automatically once with that exact name instead of asking the user again. Do not ask the user to edit credentials.

**Case A: x402_signer_private_key already exists**

Parse the credentials JSON file and check if the active organization already has a saved `x402_signer_private_key`. If the key exists and the user did not ask to replace it: **reuse** that wallet and continue to Step 2.

**Case B: No key exists (first time x402 for this org)**

If `x402_signer_private_key` is missing or null:

1. Run:

   ```text
   node ./scripts/init-openclaw-signer.mjs "<safeAddress>"
   ```

   This exact `node` command is the same on Mac/Linux and Windows PowerShell once you are already in the skill directory.

2. The script generates the EOA locally, saves `x402_signer_private_key` into the active organization in `credentials.json`, and verifies the write.

3. **DO NOT ask the user to create or paste the key.**

4. **DO NOT send the key to MoltBank.** Only save it locally.

5. Continue to Step 2.

**This key will be used in Steps 4, 5, 6, 8, and 9. It must persist in your credentials file throughout the entire workflow.**

---

### Step 2: Get x402 payment requirements

**Always.** Use the **x402Url** from the user and inspect it before any top-up/payment:

1. Run `node ./scripts/inspect-x402-requirements.mjs "<x402Url>" [GET|POST]`. This exact `node` command is the same on Mac/Linux and Windows PowerShell once you are already in the skill directory.
2. Use the helper output. It normalizes either a `Payment-Required` header or an x402 v1 JSON `402` body with `accepts[]`.
3. Read `amountRaw`, `amountUsdc`, `asset`, and `payTo` from the helper output.
4. **DO NOT** use `x402-pay-and-confirm.mjs` for inspection, and do not invent `--dry-run`.
5. **Sanity limit:** If requested amount is **> 5 USDC**, ask user for explicit confirmation before any `buy_x402_good` call.
6. If the helper fails or no valid payment requirement is returned, **STOP**.

---

### Step 3: Validate wallet ≠ Safe (only if new or unvalidated)

**Only if** the wallet is new or not yet validated. The x402 signer wallet must not equal any Safe/treasury address. If it matches, **STOP**.

---

### Step 4: Register wallet with MoltBank (only if new or unregistered)

Call **register_openclaw_x402_wallet** once per wallet (or when rotated). Send only the address, never the private key.

---

### Step 5: Top up USDC only when needed (prefund mode)

Treat the signer wallet as a petty-cash balance:

1. Read signer wallet USDC balance on-chain.
2. If balance is already enough for this specific request, **skip `buy_x402_good`**.
3. Do not assume prior funding is still available. Re-run this signer USDC check for every retry and every new paid x402 URL. Each successful paid fetch may consume the exact purchase amount.
4. If balance is insufficient and current remaining transfer allowance is not known, call `check_bot_allowances` first.
5. If balance is insufficient, call **buy_x402_good** to top up.
   By default, use the **exact required amount from Step 2**. Do not prefund 10 USDC by default.
6. **buy_x402_good is funding-only.** A `status: "funded"` response means the signer can attempt the local payment next. It does **not** mean the x402 purchase already succeeded.
7. Only add a cushion when the user explicitly asks to prefund more, or when you already know the remaining allowance easily covers it. Never exceed known `remainingUsdc`.
8. If known remaining allowance is below the amount you need, **STOP** and ask whether the user wants to raise allowance via `propose_openclaw_allowance`.
9. After funding, inspect the returned `gasTopUp` field:
   - `not_needed`: signer already had enough ETH
   - `funded`: default gas top-up also completed automatically
   - `proposed`: approval flow is still required before payment
   - `insufficient_allowance`: signer is funded, but there was not enough remaining allowance for the default gas top-up

If **buy_x402_good** itself does not return `status: 'funded'`, **STOP** and resolve allowance/wallet issues first.
If it returns `status: 'funded'` but `gasTopUp.result` is `proposed` or `insufficient_allowance`, do **not** continue to local payment until gas is resolved.

---

### Step 6: Check signer ETH gas balance

Always call **check_openclaw_x402_gas_balance** before local x402 payment:

1. If response is `status: "missing_signer_wallet"`, **STOP** and register wallet first.
2. If response is `status: "ok"`, continue directly to Step 9.
3. If response is `status: "low"`, continue to Step 7.

---

### Step 7: Ask user for signer gas top-up (only when low)

When Step 6 returns `status: "low"`:

1. Ask the user whether they want to top up signer gas.
2. Recommend the suggested default top-up (typically ~1 USDC, configurable).
3. Allow the user to choose a lower amount if they want.
4. If they choose a lower amount, explicitly warn:
   - future x402 payments may fail once signer ETH runs out.

If user declines gas top-up, continue to Step 9 with warning that payment may fail from insufficient gas.

---

### Step 8: Execute or propose gas top-up (only when approved by user)

Call **propose_openclaw_x402_gas_topup** with the selected amount.

Expected behavior:

- If the allowance was created after the signer wallet was registered, it should usually already cover the matching LI.FI route, so the tool executes instantly and sends ETH directly to the signer wallet.
- Otherwise it creates ordered approval proposals:
- optional USDC approval for LI.FI spender (if needed)
- LI.FI swap proposal: USDC -> ETH (Safe)
- ETH transfer proposal: Safe -> signer EOA
- In proposal mode, user must approve and execute proposals in the exact order of the step labels.

After execution, run **check_openclaw_x402_gas_balance** again. If still low, ask user whether to top up more or proceed at risk.

---

### Step 9: Execute payment and log a receipt

Use the **same** signer private key from your credentials file for this organization.

Before script execution, confirm signer wallet still has:

- enough USDC for the required payment amount from Step 2
- non-zero ETH gas for transaction submission

#### 9.1 Execute script

Execute the local payment script from the skill directory, passing the private key via the environment:

If the endpoint requires a JSON POST payload, pass it via `X402_JSON_BODY` (or as the optional third script argument after the method). Do not drop required request bodies.

**Mac/Linux:**

```bash
cd "${OPENCLAW_WORKSPACE:-$HOME/.openclaw/workspace}/skills/${MOLTBANK_SKILL_NAME:-MoltBank}"

# Simple GET
PRIVATE_KEY="0x..." node scripts/x402-pay-and-confirm.mjs "$x402Url" GET

# POST with a required JSON body
PRIVATE_KEY="0x..." X402_JSON_BODY='{"text":"hello world"}' node scripts/x402-pay-and-confirm.mjs "$x402Url" POST
```

**Windows (PowerShell):**

```powershell
cd "$env:USERPROFILE\.openclaw\workspace\skills\$env:MOLTBANK_SKILL_NAME"

# Simple GET
$env:PRIVATE_KEY="0x..."; node scripts/x402-pay-and-confirm.mjs "$x402Url" GET

# POST with a required JSON body
$env:PRIVATE_KEY="0x..."; $env:X402_JSON_BODY='{"text":"hello world"}'; node scripts/x402-pay-and-confirm.mjs "$x402Url" POST
```

#### 9.2 Parse output

The script must return valid JSON and should include:

- `ok` (boolean)
- `status` (HTTP status when available)
- `paymentTxHash` (if on-chain payment hash exists)
- `paidAmountUsdc` (if detectable)
- `body` (merchant payload)
- `settlementReceipt` (if exposed by the x402 client)

If JSON is invalid, **STOP**.

If the script returns `ok: true` / HTTP `200` but `paymentTxHash` is missing, the paid fetch may still have succeeded, but the merchant did not expose settlement metadata. Return the fetched data to the user and still log the payment result so the merchant payload is preserved.

#### 9.3 Call `record_x402_payment_result`

Call `record_x402_payment_result` after the local payment step, even when HTTP status is non-200. Pass the full local payment JSON output when possible. Include `paymentTxHash` only if the local script returned one. Use the appropriate `mcporter` invocation method based on your OS.

Rules:

- `paidAmount` should come from script output (`paidAmountUsdc`) when present.
- If `paidAmountUsdc` is missing, use the exact requested amount from Step 2 for the receipt.
- If `paymentTxHash` is missing, still call `record_x402_payment_result` and omit `paymentTxHash`.
- Never use `buy_x402_good.fundingTxHash` as `paymentTxHash`.
- Never use `buy_x402_good.gasTopUp.fundingTxHash` as `paymentTxHash`.

#### 9.4 Deliver outcome

- Success path: return payload/data.
- Failure path: return error/status.
- In both cases, include tx hash when available so user can reconcile on-chain spend.

---

### Critical stop conditions

**STOP** if:

- Wallet/key loading fails.
- 402 payment requirements cannot be parsed.
- Sanity limit (> 5 USDC) is exceeded without explicit user confirmation.
- Wallet validation or registration fails.
- Top-up is required but `buy_x402_good` fails.
- Signer wallet USDC remains insufficient.
- Signer wallet ETH gas is low and user does not approve top-up (or top-up fails).
- Script output is invalid JSON.

---

### Security

- Never send signer private keys in MCP calls.
- MoltBank receives wallet address registration plus payment audit metadata (`x402Url`, amount, HTTP status, optional `paymentTxHash`, and the stored local payment payload when provided).
