// SECURITY MANIFEST:
//   Environment variables accessed: PRIVATE_KEY, X402_JSON_BODY (only)
//   External endpoints called: none (utility module, no network calls)
//   Local files read: none
//   Local files written: none

export function readPrivateKeyFromEnv() {
  return process.env.PRIVATE_KEY;
}

export function readX402JsonBodyFromEnv() {
  return process.env.X402_JSON_BODY;
}
