#!/usr/bin/env node
/**
 * SECURITY MANIFEST:
 *   Environment variables accessed: MOLTBANK_CREDENTIALS_PATH, APP_BASE_URL,
 *     MOLTBANK_SKILL_NAME, OPENCLAW_WORKSPACE, HOME (only)
 *   External endpoints called: user-specified x402 URL (HEAD/GET/POST to inspect 402 response)
 *   Local files read: ${MOLTBANK_CREDENTIALS_PATH}/credentials.json
 *   Local files written: none
 *
 * Inspect x402 payment requirements without attempting payment.
 *
 * Supports both:
 * 1) Payment-Required header responses
 * 2) x402 v1 JSON 402 bodies with an accepts[] array
 *
 * Output: one JSON line to stdout with normalized fields
 * { ok, status, format, amountRaw, amountUsdc, asset, payTo, scheme, network, ... }.
 */

const x402Url = process.argv[2];
const method = (process.argv[3] || 'GET').toUpperCase();
const extraArgs = process.argv.slice(4);

function log(...args) {
  console.error('[inspect-x402-requirements]', ...args);
}

function output(result) {
  console.log(JSON.stringify(result));
}

function isRawAmount(value) {
  return typeof value === 'string' && /^\d+$/.test(value);
}

function formatRawUsdc(raw) {
  if (!isRawAmount(raw)) return null;

  const amount = BigInt(raw);
  const whole = amount / 1_000_000n;
  const fraction = (amount % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '');

  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function decodePaymentRequiredHeader(headerValue) {
  const fromBase64 = parseJson(Buffer.from(headerValue, 'base64').toString('utf8'));
  if (fromBase64 && typeof fromBase64 === 'object') return fromBase64;

  const direct = parseJson(headerValue);
  if (direct && typeof direct === 'object') return direct;

  return null;
}

function getRequirementAmount(requirement) {
  if (!requirement || typeof requirement !== 'object') return null;
  if (isRawAmount(requirement.amount)) return requirement.amount;
  if (isRawAmount(requirement.maxAmountRequired)) return requirement.maxAmountRequired;
  return null;
}

function getRequirementScore(requirement) {
  if (!requirement || typeof requirement !== 'object') return 0;

  let score = 0;
  const scheme = typeof requirement.scheme === 'string' ? requirement.scheme.toLowerCase() : '';
  const network = typeof requirement.network === 'string' ? requirement.network.toLowerCase() : '';

  if (scheme === 'exact') score += 100;
  if (network === 'base' || network === 'eip155:8453') score += 10;

  return score;
}

function pickRequirement(accepts) {
  if (!Array.isArray(accepts)) return null;

  const candidates = accepts
    .map((requirement) => ({
      requirement,
      amountRaw: getRequirementAmount(requirement)
    }))
    .filter((candidate) => candidate.amountRaw);

  if (candidates.length === 0) return null;

  candidates.sort((left, right) => {
    const scoreDelta = getRequirementScore(right.requirement) - getRequirementScore(left.requirement);
    if (scoreDelta !== 0) return scoreDelta;

    const leftAmount = BigInt(left.amountRaw);
    const rightAmount = BigInt(right.amountRaw);
    if (leftAmount !== rightAmount) return leftAmount < rightAmount ? -1 : 1;

    return 0;
  });

  return candidates[0].requirement;
}

function buildNormalizedResult({ format, paymentRequired, responseBody }) {
  const accepts = Array.isArray(paymentRequired?.accepts) ? paymentRequired.accepts : [];
  const selected = pickRequirement(accepts);
  const amountRaw = getRequirementAmount(selected) || getRequirementAmount(paymentRequired);

  return {
    ok: Boolean(amountRaw),
    format,
    x402Version:
      typeof paymentRequired?.x402Version === 'number'
        ? paymentRequired.x402Version
        : typeof responseBody?.x402Version === 'number'
          ? responseBody.x402Version
          : null,
    amountRaw: amountRaw || null,
    amountUsdc: amountRaw ? formatRawUsdc(amountRaw) : null,
    asset: selected?.asset || paymentRequired?.asset || null,
    payTo: selected?.payTo || paymentRequired?.payTo || null,
    scheme: selected?.scheme || null,
    network: selected?.network || null,
    accepts,
    paymentRequired: paymentRequired || null
  };
}

async function main() {
  if (!x402Url || !x402Url.startsWith('http')) {
    output({
      ok: false,
      error: 'Missing or invalid x402Url. Usage: node scripts/inspect-x402-requirements.mjs <x402Url> [GET|POST]'
    });
    process.exit(1);
  }

  if (extraArgs.length > 0) {
    output({
      ok: false,
      error: `Unsupported extra arguments: ${extraArgs.join(' ')}. Usage: node scripts/inspect-x402-requirements.mjs <x402Url> [GET|POST]`
    });
    process.exit(1);
  }

  try {
    log('Requesting', method, x402Url);

    const response = await fetch(x402Url, {
      method,
      headers: {
        Accept: 'application/json, text/plain;q=0.9, */*;q=0.8'
      }
    });

    const status = response.status;
    const contentType = response.headers.get('content-type') || '';
    const responseText = await response.text();
    const responseBody = responseText ? (parseJson(responseText) ?? responseText) : null;
    const paymentRequiredHeader = response.headers.get('payment-required');

    let normalized = null;
    let error = null;

    if (paymentRequiredHeader) {
      const paymentRequired = decodePaymentRequiredHeader(paymentRequiredHeader);
      if (paymentRequired) {
        normalized = buildNormalizedResult({
          format: 'payment-required-header',
          paymentRequired,
          responseBody
        });
      } else {
        error = 'Payment-Required header was present but could not be decoded.';
      }
    } else if (
      status === 402 &&
      responseBody &&
      typeof responseBody === 'object' &&
      responseBody.x402Version === 1 &&
      Array.isArray(responseBody.accepts)
    ) {
      normalized = buildNormalizedResult({
        format: 'x402-v1-body',
        paymentRequired: responseBody,
        responseBody
      });
    } else {
      error = 'No x402 payment requirements were found in the response.';
    }

    const result = {
      ok: normalized?.ok ?? false,
      status,
      method,
      x402Url,
      contentType,
      headersPresent: {
        paymentRequired: Boolean(paymentRequiredHeader),
        paymentResponse: Boolean(response.headers.get('payment-response')),
        xPaymentResponse: Boolean(response.headers.get('x-payment-response'))
      },
      ...(normalized ?? {
        format: null,
        x402Version: null,
        amountRaw: null,
        amountUsdc: null,
        asset: null,
        payTo: null,
        scheme: null,
        network: null,
        accepts: [],
        paymentRequired: null
      }),
      responseBody: status === 402 ? responseBody : typeof responseBody === 'string' ? responseBody.slice(0, 300) : responseBody,
      ...(error ? { error } : {})
    };

    output(result);

    if (!result.ok) {
      process.exit(1);
    }
  } catch (err) {
    output({
      ok: false,
      error: err instanceof Error ? err.message : String(err)
    });
    process.exit(1);
  }
}

main();
