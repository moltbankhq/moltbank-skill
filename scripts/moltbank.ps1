# SECURITY MANIFEST:
#   Environment variables accessed: MOLTBANK, MOLTBANK_CREDENTIALS_PATH, MOLTBANK_SKILL_NAME,
#     APP_BASE_URL, OPENCLAW_WORKSPACE, USERPROFILE (only)
#   External endpoints called: none (delegates to bash wrapper / mcporter)
#   Local files read: scripts/moltbank.sh
#   Local files written: none

[CmdletBinding()]
param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$RemainingArgs
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$skillDir = Split-Path -Parent $scriptDir
$bashWrapper = Join-Path $scriptDir "moltbank.sh"

if (-not (Test-Path -LiteralPath $bashWrapper)) {
  Write-Error "Error: '$bashWrapper' not found. Reinstall the MoltBank skill."
  exit 1
}

if (-not (Get-Command bash -ErrorAction SilentlyContinue)) {
  Write-Error "Error: bash is not installed or not on PATH. Install Git Bash or WSL."
  exit 1
}

if (-not $env:APP_BASE_URL) {
  $env:APP_BASE_URL = "https://app.moltbank.bot"
}

if (-not $env:MOLTBANK_SKILL_NAME) {
  $env:MOLTBANK_SKILL_NAME = "MoltBank"
}

# --- Credential Resolution (detect-and-fallback) ---
$CredsFile = if ($env:MOLTBANK_CREDENTIALS_PATH) {
  $env:MOLTBANK_CREDENTIALS_PATH
} else {
  "$env:USERPROFILE\.MoltBank\credentials.json"
}

if (Test-Path -LiteralPath $CredsFile) {
  $MoltbankMode = "host"
} elseif ($env:MOLTBANK) {
  $MoltbankMode = "sandbox"
} else {
  Write-Error "MoltBank credentials not found."
  Write-Error ""
  Write-Error "Option A (recommended): Run OAuth onboarding on your host machine."
  Write-Error "Option B (sandbox): Re-run 'moltbank setup' and verify the MoltBank OpenClaw plugin configuration."
  exit 1
}
# --- End Credential Resolution ---

# Ensure bash receives the resolved path even when its HOME differs (Git Bash/WSL).
$env:MOLTBANK_CREDENTIALS_PATH = $CredsFile

Push-Location $skillDir
try {
  & bash "./scripts/moltbank.sh" @RemainingArgs
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
