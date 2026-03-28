#!/usr/bin/env node
/**
 * x402 Pay and Confirm - Script to confirm payment with the x402 server.
 *
 * SECURITY MANIFEST:
 *   Environment variables accessed: PRIVATE_KEY, X402_JSON_BODY, MOLTBANK_CREDENTIALS_PATH,
 *     APP_BASE_URL, MOLTBANK_SKILL_NAME, OPENCLAW_WORKSPACE, HOME (only)
 *   External endpoints called: user-specified x402 merchant URL, Base L2 RPC (via viem)
 *   Local files read: ${MOLTBANK_CREDENTIALS_PATH}/credentials.json
 *   Local files written: none
 *
 * Uses @x402/fetch and @x402/evm to: 1) request the URL, 2) receive 402,
 * 3) pay on-chain with the signer, 4) retry with proof and get 200.
 *
 * Output: one JSON line to stdout with
 * { ok, x402Url, method, status, contentType, body, settlementReceipt, paymentTxHash, paidAmountUsdc, receiptLoggingAllowed, receiptLoggingWarning }.
 * The bot should always log the payment result with record_x402_payment_result
 * using the full JSON output from this script. If paymentTxHash is missing,
 * omit it from the tool call and do not substitute the funding hash.
 * This script is for the actual payment step only. It is not a dry-run
 * requirements inspector.
 *
 * Usage:
 *   PRIVATE_KEY=0x... node scripts/x402-pay-and-confirm.mjs <x402Url> [GET|POST] [jsonBody]
 *   PRIVATE_KEY=0x... X402_JSON_BODY='{"text":"hello"}' node scripts/x402-pay-and-confirm.mjs <x402Url> POST
 *
 * Requires: PRIVATE_KEY in env (EOA private key that was already funded via buy_x402_good).
 * Dependencies @x402/fetch, @x402/evm, and viem must be installed (npm install or pnpm install).
 */

import fs from 'fs';
import { resolveCredentialsPath, resolveCredentialsPathHint } from './openclaw-runtime-config.mjs';

const x402Url = process.argv[2];
const method = (process.argv[3] || 'GET').toUpperCase();
const rawRequestBodyArg = process.argv[4];
const extraArgs = process.argv.slice(5);

function log(...args) {
  // Use stderr to avoid contaminating stdout (bot parses JSON from stdout)
  console.error('[x402-pay-and-confirm]', ...args);
}

function output(result) {
  console.log(JSON.stringify(result));
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function parseRequestBody(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function getReceiptLoggingWarning(paymentTxHash) {
  return paymentTxHash
    ? "Call record_x402_payment_result with the full script output and use only this script output's paymentTxHash."
    : 'No paymentTxHash was detected in settlement metadata or the merchant response. Still call record_x402_payment_result with the full script output, but omit paymentTxHash and never substitute fundingTxHash from buy_x402_good or gas top-up.';
}

function extractPaymentTxHash(settlementReceipt, body) {
  const fromReceipt =
    settlementReceipt?.transaction || settlementReceipt?.txHash || settlementReceipt?.transactionHash || settlementReceipt?.hash || null;
  if (typeof fromReceipt === 'string' && /^0x[a-fA-F0-9]{64}$/.test(fromReceipt)) {
    return fromReceipt;
  }

  const fromBody = body?.txHash || body?.transactionHash || body?.hash || null;
  if (typeof fromBody === 'string' && /^0x[a-fA-F0-9]{64}$/.test(fromBody)) {
    return fromBody;
  }

  return null;
}

async function main() {
  if (!x402Url || !x402Url.startsWith('http')) {
    output({
      ok: false,
      error: 'Missing or invalid x402Url. Usage: PRIVATE_KEY=0x... node scripts/x402-pay-and-confirm.mjs <x402Url> [GET|POST] [jsonBody]'
    });
    process.exit(1);
  }

  if (extraArgs.length > 0) {
    output({
      ok: false,
      error: `Unsupported extra arguments: ${extraArgs.join(
        ' '
      )}. This script accepts at most one optional JSON body argument after the method. Use node scripts/inspect-x402-requirements.mjs <x402Url> [GET|POST] to inspect payment requirements first.`
    });
    process.exit(1);
  }

  // Try to get private key from env first, then from credentials file
  let rawKey = process.env.PRIVATE_KEY;

  if (!rawKey) {
    try {
      const credentialsPath = resolveCredentialsPath();

      if (fs.existsSync(credentialsPath)) {
        const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
        const activeOrg = credentials.organizations?.find((org) => org.name === credentials.active_organization);
        rawKey = activeOrg?.x402_signer_private_key;
        log('Using private key from credentials file for organization:', credentials.active_organization);
      }
    } catch (credError) {
      log('Could not read credentials file:', credError.message);
    }
  }

  if (!rawKey) {
    output({
      ok: false,
      error: `PRIVATE_KEY env is required or x402_signer_private_key must be set in ${resolveCredentialsPathHint()} for the active organization. If missing, run node scripts/init-openclaw-signer.mjs <safeAddress> to create it locally for the active organization.`
    });
    process.exit(1);
  }

  const privateKey = rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`;
  const rawRequestBody = rawRequestBodyArg ?? process.env.X402_JSON_BODY;

  if (rawRequestBody != null && (method === 'GET' || method === 'HEAD')) {
    output({
      ok: false,
      error: `${method} requests cannot include a JSON body. Omit the optional jsonBody argument / X402_JSON_BODY value, or use POST.`
    });
    process.exit(1);
  }

  const requestOptions = { method };
  if (rawRequestBody != null) {
    const parsedBody = parseRequestBody(rawRequestBody);

    if (!parsedBody.ok) {
      output({
        ok: false,
        error: `Invalid JSON request body. Pass a valid JSON string as the optional third argument or via X402_JSON_BODY. Parse error: ${parsedBody.error}`
      });
      process.exit(1);
    }

    requestOptions.headers = { 'content-type': 'application/json' };
    requestOptions.body = JSON.stringify(parsedBody.value);
  }

  try {
    const { privateKeyToAccount } = await import('viem/accounts');
    const { x402Client, wrapFetchWithPayment, x402HTTPClient } = await import('@x402/fetch');
    const { registerExactEvmScheme } = await import('@x402/evm/exact/client');

    const signer = privateKeyToAccount(privateKey);
    const client = new x402Client();
    registerExactEvmScheme(client, { signer });

    log(rawRequestBody != null ? `Requesting ${method} ${x402Url} with JSON body` : `Requesting ${method} ${x402Url}`);

    const fetchWithPayment = wrapFetchWithPayment(fetch, client);
    const res = await fetchWithPayment(x402Url, requestOptions);

    const status = res.status;
    let body = null;
    const contentType = res.headers.get('content-type') || '';
    const responseText = await res.text();
    if (responseText) {
      if (contentType.includes('application/json')) {
        body = parseJson(responseText) ?? responseText;
      } else {
        body = responseText;
      }
    }

    const httpClient = new x402HTTPClient(client);
    let settlementReceipt = null;
    try {
      settlementReceipt = httpClient.getPaymentSettleResponse((name) => res.headers.get(name));
    } catch {
      settlementReceipt = null;
    }
    const paymentTxHash = extractPaymentTxHash(settlementReceipt, body);

    if (!res.ok) {
      log('Request failed:', status, body);

      // Detect specific payment failure scenarios
      let errorMessage = '';
      let paymentFailed = false;

      if (status >= 500) {
        paymentFailed = true;
        errorMessage = `PAYMENT_FAILED: Server error (HTTP ${status}). The x402 server encountered an error while processing the payment.`;
      } else if (status === 400) {
        paymentFailed = true;
        errorMessage = `PAYMENT_FAILED: Bad request (HTTP ${status}). The payment request was invalid or the payment proof was rejected.`;
      } else if (status === 402) {
        paymentFailed = true;
        errorMessage =
          'PAYMENT_FAILED: The x402 server still returned 402 after the payment attempt. The payment proof was missing, rejected, or the endpoint requires a different x402 flow.';
      } else {
        errorMessage = `PAYMENT_FAILED: Request failed with HTTP ${status}. The payment step could not be completed successfully.`;
      }

      // Extract additional error details from body if available
      let errorDetails = '';
      if (body) {
        if (typeof body === 'object' && body.error) {
          errorDetails = ` Server error details: ${typeof body.error === 'string' ? body.error : JSON.stringify(body.error)}`;
        } else if (typeof body === 'string' && body.length > 0) {
          errorDetails = ` Server response: ${body.substring(0, 200)}`;
        }
      }

      const loggingHint = paymentTxHash
        ? ` On-chain transaction hash was found (${paymentTxHash}). You should call record_x402_payment_result with the full script output and this paymentTxHash.`
        : ' No on-chain payment transaction hash was found. You should still call record_x402_payment_result with the full script output, but omit paymentTxHash.';

      output({
        ok: false,
        x402Url,
        method,
        status,
        contentType,
        body,
        settlementReceipt: settlementReceipt ?? undefined,
        paymentTxHashPresent: Boolean(paymentTxHash),
        paymentTxHash: paymentTxHash ?? undefined,
        receiptLoggingAllowed: true,
        receiptLoggingWarning: getReceiptLoggingWarning(paymentTxHash),
        paymentFailed: paymentFailed || status === 402,
        error: errorMessage + errorDetails + loggingHint
      });
      process.exit(1);
    }

    log('Success:', status);

    let paidAmountUsdc = null;
    if (body && typeof body === 'object' && body.paidAmountUsdc != null) {
      paidAmountUsdc = body.paidAmountUsdc;
    } else if (settlementReceipt && typeof settlementReceipt === 'object' && settlementReceipt.amount != null) {
      const raw = settlementReceipt.amount;
      if (typeof raw === 'string' && raw.match(/^\d+$/)) {
        paidAmountUsdc = Number(BigInt(raw) / 1_000_000n);
      } else if (typeof raw === 'number') {
        paidAmountUsdc = raw;
      }
    }

    output({
      ok: true,
      x402Url,
      method,
      status,
      contentType,
      body,
      settlementReceipt: settlementReceipt ?? undefined,
      paymentTxHashPresent: Boolean(paymentTxHash),
      paymentTxHash: paymentTxHash ?? undefined,
      receiptLoggingAllowed: true,
      receiptLoggingWarning: getReceiptLoggingWarning(paymentTxHash),
      paidAmountUsdc: paidAmountUsdc ?? undefined
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log('Error:', message);
    const hashMatch = message.match(/0x[a-fA-F0-9]{64}/);
    const paymentTxHash = hashMatch ? hashMatch[0] : null;

    // Detect blockchain/transaction errors
    let errorMessage = '';
    const errorStr = message.toLowerCase();

    if (errorStr.includes('insufficient funds') || errorStr.includes('insufficient balance') || errorStr.includes('balance too low')) {
      errorMessage =
        'PAYMENT_FAILED: Insufficient funds in the signer wallet. The wallet does not have enough USDC to complete the x402 payment.';
    } else if (
      errorStr.includes('transaction') &&
      (errorStr.includes('revert') || errorStr.includes('failed') || errorStr.includes('rejected'))
    ) {
      errorMessage = `PAYMENT_FAILED: The blockchain transaction failed or was reverted. The payment could not be executed on-chain. Error: ${message}.`;
    } else if (errorStr.includes('network') || errorStr.includes('timeout') || errorStr.includes('connection')) {
      errorMessage = `PAYMENT_FAILED: Network error occurred while attempting the payment. The connection to the blockchain or x402 server failed. Error: ${message}.`;
    } else if (errorStr.includes('nonce') || errorStr.includes('replacement')) {
      errorMessage = `PAYMENT_FAILED: Transaction nonce error. The payment transaction could not be submitted. Error: ${message}.`;
    } else {
      errorMessage = `PAYMENT_FAILED: An error occurred during the payment process. The x402 payment step failed and could not be completed. Error: ${message}.`;
    }

    const loggingHint = paymentTxHash
      ? ` On-chain transaction hash was found (${paymentTxHash}). You should call record_x402_payment_result with the full script output and this paymentTxHash.`
      : ' No on-chain payment transaction hash was found. You should still call record_x402_payment_result with the full script output, but omit paymentTxHash.';

    output({
      ok: false,
      x402Url,
      method,
      paymentFailed: true,
      paymentTxHashPresent: Boolean(paymentTxHash),
      paymentTxHash: paymentTxHash ?? undefined,
      receiptLoggingAllowed: true,
      receiptLoggingWarning: getReceiptLoggingWarning(paymentTxHash),
      error: `${errorMessage}${loggingHint}`,
      originalError: message
    });
    process.exit(1);
  }
}

main();
