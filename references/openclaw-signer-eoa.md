# OpenClaw signer EOA - x402 Base flow

This document defines the signer EOA lifecycle and validation used by the x402 flow.

## Scope

- One EOA signer per organization.
- The signer is used for x402 payments on Base.
- The private key is stored only in `~/.MoltBank/credentials.json` or the configured credentials path.
- The private key is never sent to MoltBank or to any external service.

## 1. Obtain or create the signer EOA

Source: the active organization entry in `credentials.json`.

- If `x402_signer_private_key` already exists, derive the address from it and reuse that wallet. Do not create a new one unless the user explicitly asks to rotate.
- If `x402_signer_private_key` is missing or null, run `node ./scripts/init-openclaw-signer.mjs "<safeAddress>"` from the skill directory.
- Save only the private key in `credentials.json` under the active organization.
- Verify the key was saved correctly by reading it back.
- Do not ask the user to create, paste, or edit the key.

Output of this step: one signer address and the private key available locally in credentials.

## 2. Validate signer address is not the Safe

This validation is mandatory before registering the signer with MoltBank.

- Obtain the Base Safe address for the organization's account with `get_account_details`.
- Compare the signer address from step 1 against the Safe address using a case-insensitive address comparison.
- If the signer address equals the Safe address, stop. Do not register or use that address as the OpenClaw signer.
- If the signer address is different from the Safe address, continue.

This keeps treasury custody and operational signing separate.

## 3. Register only the address with MoltBank

- Call `register_openclaw_x402_wallet` with the signer address when the x402 workflow requires it.
- Send only the address, never the private key.
- MoltBank stores the address for funding and gas checks. The private key remains local only.

## 4. Optional local state tracking

You may track local signer state in `credentials.json` to avoid repeating work:

```json
{
  "organizations": [
    {
      "name": "Acme",
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

- If `x402_wallet.validated` and `x402_wallet.registered` are both true, you may skip validation and registration for later runs.
- If the wallet is new or the flags are missing, re-run validation and registration.

## Summary

| Step | Action |
| :--- | :----- |
| 1 | Load or create the signer EOA from local credentials |
| 2 | Verify signer address is not the Safe |
| 3 | Register the signer address with `register_openclaw_x402_wallet` |
| 4 | Use the same local signer for x402 funding, gas top-up, and paid requests |

## Security

- Private keys are never sent in MCP calls or to MoltBank.
- Only the signer address is registered with MoltBank.
- The signer key is used locally for `x402-pay-and-confirm.mjs` and related x402 flow steps.
