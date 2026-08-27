import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export function sha256(value) {
  return createHash('sha256').update(String(value), 'utf8').digest('hex');
}

export function protectedKey(secret, environment, namespace, rawValue) {
  return createHmac('sha256', secret)
    .update(`CASHCOMPASS|${environment}|${namespace}|V1|${String(rawValue)}`, 'utf8')
    .digest('hex');
}

export function constantTimeEqual(left, right) {
  const a = Buffer.from(String(left), 'utf8');
  const b = Buffer.from(String(right), 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function encodeCredentialBlob(value) {
  return Buffer.from(JSON.stringify({ version: 1, ...value }), 'utf8');
}

export function decodeCredentialBlob(buffer) {
  const parsed = JSON.parse(Buffer.from(buffer).toString('utf8'));
  if (!parsed || parsed.version !== 1 || !parsed.accessToken || !parsed.itemId) {
    throw new Error('Credential envelope is invalid.');
  }
  return parsed;
}
