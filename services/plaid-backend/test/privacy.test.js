import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { createSafeLogger } from '../src/logger.js';
import { loadConfig } from '../src/config.js';

const syntheticPublicKey = generateKeyPairSync('rsa', { modulusLength: 2048 })
  .publicKey.export({ type: 'spki', format: 'pem' });

test('structured logger emits allowlisted operational fields only', () => {
  const lines = [];
  const logger = createSafeLogger({ info: value => lines.push(value), error: value => lines.push(value) });
  logger.info({ requestId: 'r1', action: 'EXCHANGE', environment: 'SANDBOX', status: 'OK', accessToken: 'access-private', rawItemId: 'item-private', balance: 999, merchant: 'merchant-private' });
  assert.equal(lines.length, 1);
  assert.deepEqual(JSON.parse(lines[0]), { requestId: 'r1', action: 'EXCHANGE', environment: 'SANDBOX', status: 'OK' });
  assert.equal(lines[0].includes('private'), false);
  assert.equal(lines[0].includes('999'), false);
});

test('configuration accepts only explicit matching Sandbox or Trial', () => {
  const base = {
    GOOGLE_CLOUD_PROJECT: 'project', FIRESTORE_DATABASE: '(default)', KMS_CREDENTIAL_KEY: 'kms',
    PLAID_CLIENT_ID_SECRET: 'client', PLAID_SANDBOX_SECRET: 'secret', PLAID_IDENTITY_HMAC_SECRET: 'identity',
    CASHCOMPASS_ASSERTION_AUDIENCE: 'aud', CASHCOMPASS_ASSERTION_ISSUER: 'iss',
    CASHCOMPASS_ASSERTION_PUBLIC_KEY_PEM: syntheticPublicKey, PLAID_ENVIRONMENT: 'SANDBOX',
    PLAID_PROVIDER_PROFILE: 'PLAID_SANDBOX_V1'
  };
  assert.equal(loadConfig({ ...base, CASHCOMPASS_ENVIRONMENT: 'SANDBOX' }).plaidBaseUrl, 'https://sandbox.plaid.com');
  const trial = loadConfig({ ...base, CASHCOMPASS_ENVIRONMENT: 'TRIAL', PLAID_ENVIRONMENT: 'PRODUCTION',
    PLAID_PROVIDER_PROFILE: 'PLAID_TRIAL_V1', PLAID_SECRET: 'trial-secret-resource' });
  assert.equal(trial.plaidBaseUrl, 'https://production.plaid.com');
  assert.throws(() => loadConfig({ ...base, CASHCOMPASS_ENVIRONMENT: 'TRIAL',
    PLAID_ENVIRONMENT: 'PRODUCTION', PLAID_PROVIDER_PROFILE: 'PLAID_TRIAL_V1' }),
    /PLAID_SECRET/);
  assert.throws(() => loadConfig({ ...base, CASHCOMPASS_ENVIRONMENT: 'PRODUCTION',
    PLAID_ENVIRONMENT: 'PRODUCTION', PLAID_PROVIDER_PROFILE: 'PLAID_PRODUCTION_V1' }), /TRIAL-to-PRODUCTION/i);
  assert.throws(() => loadConfig({ ...base, CASHCOMPASS_ENVIRONMENT: 'SANDBOX', PLAID_ENVIRONMENT: 'PRODUCTION' }), /SANDBOX-to-SANDBOX/i);
  assert.throws(() => loadConfig({ ...base, CASHCOMPASS_ENVIRONMENT: '', PLAID_ENVIRONMENT: '' }), /SANDBOX-to-SANDBOX/i);
});

test('configuration loads an explicit bounded public-key ring without private material', () => {
  const base = {
    GOOGLE_CLOUD_PROJECT: 'project', FIRESTORE_DATABASE: '(default)', KMS_CREDENTIAL_KEY: 'kms',
    PLAID_CLIENT_ID_SECRET: 'client', PLAID_SANDBOX_SECRET: 'secret', PLAID_IDENTITY_HMAC_SECRET: 'identity',
    CASHCOMPASS_ASSERTION_AUDIENCE: 'aud', CASHCOMPASS_ASSERTION_ISSUER: 'iss',
    CASHCOMPASS_ENVIRONMENT: 'SANDBOX', PLAID_ENVIRONMENT: 'SANDBOX',
    PLAID_PROVIDER_PROFILE: 'PLAID_SANDBOX_V1'
  };
  const config = loadConfig({
    ...base,
    CASHCOMPASS_ASSERTION_PUBLIC_KEYS_JSON: JSON.stringify({
      'central-v1': syntheticPublicKey,
      'central-v2': syntheticPublicKey
    })
  });
  assert.deepEqual(Object.keys(config.assertionPublicKeys), ['central-v1', 'central-v2']);
  assert.equal(JSON.stringify(config).includes('PRIVATE KEY'), false);
  assert.throws(() => loadConfig({
    ...base,
    CASHCOMPASS_ASSERTION_PUBLIC_KEYS_JSON: JSON.stringify({
      'central-v1': syntheticPublicKey,
      'central-v2': syntheticPublicKey,
      'central-v3': syntheticPublicKey,
      'central-v4': syntheticPublicKey
    })
  }), /one to three keys/);
  assert.throws(() => loadConfig({
    ...base,
    CASHCOMPASS_ASSERTION_PUBLIC_KEYS_JSON: JSON.stringify({ constructor: syntheticPublicKey })
  }), /key ID is invalid/);
});
