import { createPublicKey } from 'node:crypto';

const REQUIRED = [
  'GOOGLE_CLOUD_PROJECT',
  'FIRESTORE_DATABASE',
  'KMS_CREDENTIAL_KEY',
  'PLAID_CLIENT_ID_SECRET',
  'PLAID_IDENTITY_HMAC_SECRET',
  'CASHCOMPASS_ASSERTION_AUDIENCE',
  'CASHCOMPASS_ASSERTION_ISSUER'
];

function validateKeyId(value) {
  const keyId = String(value || '').trim();
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(keyId)) {
    throw new Error('CashCompass assertion key ID is invalid.');
  }
  if (keyId === '__proto__' || keyId === 'prototype' || keyId === 'constructor') {
    throw new Error('CashCompass assertion key ID is invalid.');
  }
  return keyId;
}

function validatePublicKeyPem(value) {
  const pem = String(value || '').replace(/\\n/g, '\n').trim();
  if (!/^-----BEGIN PUBLIC KEY-----[\s\S]+-----END PUBLIC KEY-----$/.test(pem)) {
    throw new Error('CashCompass assertion public key is invalid.');
  }
  try {
    if (createPublicKey(pem).asymmetricKeyType !== 'rsa') throw new Error('not-rsa');
  } catch (_error) {
    throw new Error('CashCompass assertion public key is invalid.');
  }
  return pem;
}

function loadAssertionPublicKeys(env) {
  const serialized = String(env.CASHCOMPASS_ASSERTION_PUBLIC_KEYS_JSON || '').trim();
  if (!serialized) {
    const keyId = validateKeyId(env.CASHCOMPASS_ASSERTION_KEY_ID || 'cashcompass-central-v1');
    const singleKeyRing = Object.create(null);
    singleKeyRing[keyId] = validatePublicKeyPem(env.CASHCOMPASS_ASSERTION_PUBLIC_KEY_PEM);
    return Object.freeze(singleKeyRing);
  }
  let parsed;
  try {
    parsed = JSON.parse(serialized);
  } catch (_error) {
    throw new Error('CashCompass assertion public-key ring is invalid JSON.');
  }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('CashCompass assertion public-key ring is invalid.');
  }
  const entries = Object.entries(parsed);
  if (entries.length < 1 || entries.length > 3) {
    throw new Error('CashCompass assertion public-key ring must contain one to three keys.');
  }
  const keyRing = Object.create(null);
  for (const [rawKeyId, rawPem] of entries) {
    const keyId = validateKeyId(rawKeyId);
    if (Object.hasOwn(keyRing, keyId)) {
      throw new Error('CashCompass assertion public-key ring contains a duplicate key ID.');
    }
    keyRing[keyId] = validatePublicKeyPem(rawPem);
  }
  return Object.freeze(keyRing);
}

export function loadConfig(env = process.env) {
  const environment = String(env.CASHCOMPASS_ENVIRONMENT || '').trim().toUpperCase();
  const plaidEnvironment = String(env.PLAID_ENVIRONMENT || '').trim().toUpperCase();
  const expectedPlaidEnvironment = environment === 'SANDBOX' ? 'SANDBOX' :
    environment === 'TRIAL' ? 'PRODUCTION' : '';
  if (!expectedPlaidEnvironment || plaidEnvironment !== expectedPlaidEnvironment) {
    throw new Error('Plaid backend requires explicit SANDBOX-to-SANDBOX or TRIAL-to-PRODUCTION configuration.');
  }
  for (const name of REQUIRED) {
    if (!String(env[name] || '').trim()) throw new Error(`Missing required configuration: ${name}`);
  }
  const assertionPublicKeys = loadAssertionPublicKeys(env);
  const plaidSecret = String(env.PLAID_SECRET ||
    (environment === 'SANDBOX' ? env.PLAID_SANDBOX_SECRET : '') || '').trim();
  if (!plaidSecret) throw new Error('Missing required configuration: PLAID_SECRET');
  const providerProfile = String(env.PLAID_PROVIDER_PROFILE || '').trim();
  if (!providerProfile || !providerProfile.includes(environment)) {
    throw new Error('Plaid provider profile must explicitly identify the configured environment.');
  }
  return Object.freeze({
    environment,
    plaidEnvironment,
    projectId: env.GOOGLE_CLOUD_PROJECT,
    firestoreDatabase: env.FIRESTORE_DATABASE,
    kmsCredentialKey: env.KMS_CREDENTIAL_KEY,
    plaidClientIdSecret: env.PLAID_CLIENT_ID_SECRET,
    plaidSecret,
    identityHmacSecret: env.PLAID_IDENTITY_HMAC_SECRET,
    assertionAudience: env.CASHCOMPASS_ASSERTION_AUDIENCE,
    assertionIssuer: env.CASHCOMPASS_ASSERTION_ISSUER,
    assertionPublicKeys,
    providerProfile,
    plaidBaseUrl: plaidEnvironment === 'SANDBOX'
      ? 'https://sandbox.plaid.com' : 'https://production.plaid.com',
    port: Number(env.PORT || 8080),
    maxRequestBytes: 262144,
    assertionMaxLifetimeSeconds: 90,
    clockSkewSeconds: 15
  });
}
