import { createPublicKey, verify as verifySignature } from 'node:crypto';
import { constantTimeEqual, sha256 } from './crypto.js';
import { fail } from './errors.js';

function decodeJsonSegment(segment) {
  try {
    return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
  } catch (_error) {
    fail(401, 'AUTH_INVALID', 'Invalid assertion encoding.');
  }
}

export function verifyAssertion({ token, rawBody, expectedAction, config, nowMs = Date.now() }) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) fail(401, 'AUTH_REQUIRED', 'Assertion is required.');
  const header = decodeJsonSegment(parts[0]);
  const claims = decodeJsonSegment(parts[1]);
  if (header.alg !== 'RS256' || header.typ !== 'CC-AUTH' ||
      !/^[A-Za-z0-9_-]{8,80}$/.test(String(header.kid || ''))) {
    fail(401, 'AUTH_INVALID', 'Assertion header is invalid.');
  }
  const publicKeyPem = config.assertionPublicKeys &&
    Object.hasOwn(config.assertionPublicKeys, header.kid)
    ? config.assertionPublicKeys[header.kid] : '';
  if (!publicKeyPem) fail(401, 'AUTH_INVALID', 'Assertion key is not allowed.');
  const verified = verifySignature(
    'RSA-SHA256',
    Buffer.from(`${parts[0]}.${parts[1]}`, 'utf8'),
    createPublicKey(publicKeyPem),
    Buffer.from(parts[2], 'base64url')
  );
  if (!verified) fail(401, 'AUTH_INVALID', 'Assertion signature is invalid.');

  const now = Math.floor(nowMs / 1000);
  if (claims.iss !== config.assertionIssuer || claims.aud !== config.assertionAudience) {
    fail(401, 'AUTH_AUDIENCE', 'Assertion issuer or audience is invalid.');
  }
  if (claims.env !== config.environment) {
    fail(401, 'AUTH_ENVIRONMENT', 'Assertion environment is invalid.');
  }
  if (claims.action !== expectedAction) fail(403, 'AUTH_ACTION', 'Assertion action is invalid.');
  if (!claims.sub || !/^[A-Za-z0-9_-]{20,128}$/.test(String(claims.sub))) {
    fail(401, 'AUTH_SUBJECT', 'Assertion subject is invalid.');
  }
  if (!claims.jti || !/^[A-Za-z0-9_-]{20,128}$/.test(String(claims.jti))) {
    fail(401, 'AUTH_NONCE', 'Assertion nonce is invalid.');
  }
  if (!Number.isInteger(claims.iat) || !Number.isInteger(claims.exp) ||
      claims.exp <= claims.iat || claims.exp - claims.iat > config.assertionMaxLifetimeSeconds ||
      claims.iat > now + config.clockSkewSeconds || claims.exp < now - config.clockSkewSeconds) {
    fail(401, 'AUTH_EXPIRED', 'Assertion lifetime is invalid.');
  }
  if (!constantTimeEqual(claims.bodySha256, sha256(rawBody))) {
    fail(401, 'AUTH_TAMPERED', 'Request body does not match assertion.');
  }
  let userEmail = '';
  if (claims.usr !== undefined && claims.usr !== null && claims.usr !== '') {
    userEmail = String(claims.usr).trim().toLowerCase();
    if (userEmail !== claims.usr || userEmail.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) {
      fail(401, 'AUTH_USER', 'Assertion user identity is invalid.');
    }
  }
  return {
    userKey: String(claims.sub),
    legacyUserKey: String(claims.sub),
    userEmail,
    nonce: String(claims.jti),
    expiresAtSeconds: claims.exp
  };
}
