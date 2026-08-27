import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { verifyAssertion } from '../src/auth.js';
import { sha256 } from '../src/crypto.js';
import { fakeConfig, FakeStore } from './helpers.js';

const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicKey = keys.publicKey.export({ type: 'spki', format: 'pem' });
const privateKey = keys.privateKey.export({ type: 'pkcs8', format: 'pem' });
const nextKeys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const nextPublicKey = nextKeys.publicKey.export({ type: 'spki', format: 'pem' });
const nextPrivateKey = nextKeys.privateKey.export({ type: 'pkcs8', format: 'pem' });
const nowMs = Date.UTC(2026, 7, 24, 18, 0, 0);
const body = JSON.stringify({ correlationId: 'correlation-1' });

function token(overrides = {}, bodyValue = body, key = {}) {
  const header = { alg: 'RS256', typ: 'CC-AUTH', kid: key.keyId || 'central-v1' };
  const claims = {
    iss: 'cashcompass-central-app', aud: 'cashcompass-plaid-backend', env: 'SANDBOX',
    sub: 'opaque_user_key_1234567890', action: 'PUBLIC_TOKEN_EXCHANGE',
    bodySha256: sha256(bodyValue), iat: Math.floor(nowMs / 1000) - 5,
    exp: Math.floor(nowMs / 1000) + 55, jti: 'nonce_12345678901234567890', ...overrides
  };
  const unsigned = `${Buffer.from(JSON.stringify(header)).toString('base64url')}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}`;
  return `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), key.privateKey || privateKey).toString('base64url')}`;
}

function verify(value, overrides = {}) {
  return verifyAssertion({
    token: value, rawBody: body, expectedAction: 'PUBLIC_TOKEN_EXCHANGE',
    config: fakeConfig({ assertionPublicKeyPem: publicKey, ...overrides }), nowMs
  });
}

test('accepts a valid short-lived body-bound Sandbox assertion', () => {
  assert.equal(verify(token()).userKey, 'opaque_user_key_1234567890');
});

test('accepts current and next allowlisted keys during a rotation window', () => {
  const config = {
    assertionPublicKeys: {
      'central-v1': publicKey,
      'central-v2': nextPublicKey
    }
  };
  assert.equal(verify(token(), config).userKey, 'opaque_user_key_1234567890');
  assert.equal(verify(token({}, body, {
    keyId: 'central-v2', privateKey: nextPrivateKey
  }), config).userKey, 'opaque_user_key_1234567890');
});

test('rejects unknown and retired key IDs', () => {
  assert.throws(() => verify(token({}, body, {
    keyId: 'unknown-v9', privateKey: nextPrivateKey
  })), error => error.code === 'AUTH_INVALID');
  assert.throws(() => verify(token(), {
    assertionPublicKeys: { 'central-v2': nextPublicKey }
  }), error => error.code === 'AUTH_INVALID');
  assert.throws(() => verify(token({}, body, {
    keyId: 'constructor', privateKey: nextPrivateKey
  })), error => error.code === 'AUTH_INVALID');
});

for (const [name, claims, config, code] of [
  ['expired', { iat: Math.floor(nowMs / 1000) - 100, exp: Math.floor(nowMs / 1000) - 20 }, {}, 'AUTH_EXPIRED'],
  ['wrong audience', { aud: 'other-service' }, {}, 'AUTH_AUDIENCE'],
  ['wrong environment', { env: 'PRODUCTION' }, {}, 'AUTH_ENVIRONMENT'],
  ['wrong action', { action: 'DISCONNECT' }, {}, 'AUTH_ACTION']
]) {
  test(`rejects ${name} assertion`, () => {
    assert.throws(() => verify(token(claims), config), error => error.code === code);
  });
}

test('rejects a tampered request body and signature', () => {
  assert.throws(() => verifyAssertion({ token: token(), rawBody: '{}', expectedAction: 'PUBLIC_TOKEN_EXCHANGE', config: fakeConfig({ assertionPublicKeyPem: publicKey }), nowMs }), error => error.code === 'AUTH_TAMPERED');
  const value = token();
  const parts = value.split('.');
  const tamperedSignature = Buffer.from(parts[2], 'base64url');
  tamperedSignature[0] ^= 1;
  parts[2] = tamperedSignature.toString('base64url');
  assert.throws(() => verify(parts.join('.')), error => error.code === 'AUTH_INVALID');
});

test('nonce store rejects replay for the same protected user', async () => {
  const store = new FakeStore();
  await store.consumeNonce('user-a', 'nonce-a');
  await assert.rejects(store.consumeNonce('user-a', 'nonce-a'), error => error.code === 'AUTH_REPLAY');
  await store.consumeNonce('user-b', 'nonce-a');
});
