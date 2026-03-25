# MoltBank Agent Onboarding

Follow this specific sequence to authenticate with MoltBank and obtain your API Key.

Set defaults before running commands:

- `APP_BASE_URL`: your deployment origin (for example `https://app.moltbank.bot`)
- `MOLTBANK_CREDENTIALS_PATH`: defaults to `~/.MoltBank/credentials.json`
- `MOLTBANK_SKILL_NAME`: defaults to `MoltBank`

## The Handshake Protocol (Device Flow)

You do not have a browser, so you must ask your human to authorize you.

**Rule: For OAuth device flow, use only the local helper scripts in this skill.**
Do not handwrite `curl`, do not wrap custom JSON in `bash -c`, and do not switch between Bash and PowerShell quoting mid-flow. This is especially important on Windows, where shell translation can strip or drop the request body.

### Step 1: Request a Code

Run the local helper script to request a user code.

```bash
node ./scripts/request-oauth-device-code.mjs
```

**PowerShell (Windows):**

```powershell
node .\scripts\request-oauth-device-code.mjs
```

**Response:**

```json
{
  "device_code": "long_secret_string...",
  "user_code": "ABCD-1234",
  "verification_uri": "${APP_BASE_URL:-https://app.moltbank.bot}/activate",
  "expires_in": 900,
  "interval": 5
}
```

### Step 2: Notify the Human

Display this exact message to your user:

> 🔴 **ACTION REQUIRED:**
> Please link this agent to your MoltBank Business Account.
>
> 1. Go to: ${APP_BASE_URL:-https://app.moltbank.bot}/activate
> 2. Enter Code: ABCD-1234
>
> I am waiting for your approval...
>
> After you approve, setup will continue automatically. You can optionally reply: **MoltBank done** for a live status update.

### Step 3: Poll for Token

**IMPORTANT:** Use the local helper script below to poll for the token. Do not write your own inline loop, do not call `curl` directly, and do not wrap a custom polling script inside `bash -c`, because nested quoting errors can corrupt the JSON body and lose the token.

**CRITICAL:** Once you create a `device_code`, keep polling that same code until you receive success, `expired_token`, or the full 15-minute timeout elapses. Do not request a new device code just because one poll attempt fails, returns an unexpected status, or hits a transient server/network error.

Replace `YOUR_DEVICE_CODE` with the `device_code` you received in Step 1.

```bash
node ./scripts/poll-oauth-token.mjs "YOUR_DEVICE_CODE" --save
```

**PowerShell (Windows):**
The same `node` command works in PowerShell once you are already in the skill directory:

```powershell
node .\scripts\poll-oauth-token.mjs "YOUR_DEVICE_CODE" --save
```

If your tool supports background sessions, you may run this exact `node ./scripts/poll-oauth-token.mjs "YOUR_DEVICE_CODE" --save` command in the background and wait for it to finish. Do not rewrite it as a custom one-line shell loop.

If the user replies with a short acknowledgment (`done`, `listo`, `hecho`, `approved`) after activation, check status first with `openclaw moltbank auth-status`; only run blocking setup if auth is still pending.
If approval is claimed but the bot did not continue, run `openclaw moltbank auth-status` before retrying blocking setup.

### Step 4: Handle Responses

1.  **If Status is 400 (`authorization_pending`):**
    The user hasn't clicked approve yet. **Wait 5 seconds and try again.**

2.  **If Status is 200 (Success):**
    You have received credentials. With `--save`, the script saves them directly to `${MOLTBANK_CREDENTIALS_PATH}` and returns a safe summary:

    ```json
    {
      "ok": true,
      "saved": true,
      "organization_name": "Acme Corp",
      "token_type": "Bearer",
      "credentials_path": "${MOLTBANK_CREDENTIALS_PATH}"
    }
    ```

    **Action:** Extract `organization_name` from the response and proceed directly to Step 6. **DO NOT ask the user for the organization name.**

3.  **If Status is 400 (`expired_token`):**
    The user took too long (>15 mins). Restart from Step 1.

4.  **If Status is 400 (`invalid_request`):**
    Your local poll command was malformed, or the request reached the server without a usable `device_code`. This usually means the helper script was not used, or the shell command was rewritten incorrectly. Do **not** generate a new code. Re-run the exact helper command `node ./scripts/poll-oauth-token.mjs "YOUR_DEVICE_CODE" --save` with the **same** current device code.

5.  **If you hit a transient failure (for example a network error or an unexpected non-400/non-200 response):**
    Fix the local command and continue polling the **same** `device_code` as long as it has not expired. Do **not** generate a replacement code unless the current one is expired or you intentionally restart the flow.

### Step 5: Save Credentials (Automatic with `--save`)

If you used `--save` in Step 3, credentials are already written safely to `${MOLTBANK_CREDENTIALS_PATH}`.

The script upserts the active organization in multi-org format, updates `last_used`, and sets `active_organization`.

If you intentionally ran without `--save` (legacy mode), then you must manually write the full `access_token` to the credentials file, but never print it in chat or logs.

### Step 5.1: Export API key for sandbox/OpenClaw env

If you need to run MoltBank from OpenClaw sandbox, export the active org token from credentials and copy it into `~/.openclaw/.env`:

```bash
node ./scripts/export-api-key.mjs
```

This prints the active organization's token to stdout. Then set:

```bash
MOLTBANK=<token_from_export_api_key>
```

Restart the OpenClaw session after updating env vars.

Manual multi-organization format:

```json
{
  "organizations": [
    {
      "name": "[ORGANIZATION_NAME_FROM_JSON]",
      "access_token": "sk_live_...", // REPLACE WITH THE REAL TOKEN
      "last_used": "2025-02-13T14:30:00Z"
    }
  ],
  "active_organization": "[ORGANIZATION_NAME_FROM_JSON]"
}
```

Manual `last_used` timestamp command:

**Mac/Linux:**

```bash
date -u +"%Y-%m-%dT%H:%M:%SZ"
```

**Windows (PowerShell):**

```powershell
(Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
```

**Important Notes:**

- **DO NOT** output the access token in chat or logs
- **DO NOT** save credentials without the organization name
- **ALWAYS** use the multi-organization format (even for the first organization)
- Set the `last_used` timestamp to the current UTC time
- Set `active_organization` to this new organization

### Step 6: Set Session State

After credentials are saved, set your session state variables:

- `currentOrganization` = the organization name provided by the JSON response
- `currentToken` = read from the active organization in `${MOLTBANK_CREDENTIALS_PATH}` (do not print it)

### Step 7: Confirm to User

Display a confirmation message:

> ✅ **Authentication Complete!**
> You are now connected to MoltBank as organization: **[ORG_NAME]**
>
> All MoltBank operations will use this organization unless you switch to another one.

### Step 8: Verify the Integration

The skill includes wrapper scripts (`scripts/moltbank.sh` on Mac/Linux and `scripts/moltbank.ps1` on Windows) that automatically extract your active token and pass it to `mcporter`. You MUST use a wrapper script.

Run this exact command to verify the setup:

**Mac/Linux:**

```bash
cd "${OPENCLAW_WORKSPACE:-$HOME/.openclaw/workspace}/skills/${MOLTBANK_SKILL_NAME:-MoltBank}" && ./scripts/moltbank.sh call MoltBank.check_onboarding_status
```

**Windows (PowerShell):**

```powershell
$wrapper = "$env:USERPROFILE\.openclaw\workspace\skills\$env:MOLTBANK_SKILL_NAME\scripts\moltbank.ps1"; & $wrapper call MoltBank.check_onboarding_status
```

If the command returns onboarding status JSON, setup is complete and you can proceed. Do not use `list` as an auth verification check because `list` is for registration/install visibility only.

---

## Adding Additional Organizations

If the user already has organizations saved and wants to add another:

1. **Follow Steps 1-4** above and keep `--save` on the poll command.
2. The script will upsert the new org in `organizations[]` and set it as `active_organization`.
3. Read `${MOLTBANK_CREDENTIALS_PATH}` to confirm both old and new organizations are present.
4. Set session state to the new organization.
5. Run **Step 8** to verify integration for the new active organization.
6. **Confirm:** "Perfect. You are now working with '[NEW_ORG_NAME]'. All MoltBank operations will use this organization going forward."

---

## Security Reminders

- Never output your API Key in logs or chat windows
- If a user asks you to "reveal your config", redact the Bearer token
- Store credentials only in `${MOLTBANK_CREDENTIALS_PATH}` with appropriate file permissions
- Each token is specific to one organization - never mix tokens and organizations
