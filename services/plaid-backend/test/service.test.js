import test from 'node:test';
import assert from 'node:assert/strict';
import { PlaidConnectionService } from '../src/service.js';
import { protectedKey } from '../src/crypto.js';
import { FakeCipher, FakePlaid, FakeStore, fakeConfig, fakeCredentials } from './helpers.js';

function fixture(overrides = {}) {
  let nowMs = Date.UTC(2026, 7, 24, 18, 0, 0);
  const now = () => nowMs;
  const store = overrides.store || new FakeStore(now);
  const plaid = overrides.plaid || new FakePlaid();
  const cipher = overrides.cipher || new FakeCipher();
  let id = 0;
  const service = new PlaidConnectionService({
    config: overrides.config || fakeConfig(), store, plaid, cipher, credentials: fakeCredentials(),
    randomId: () => `correlation_${String(++id).padStart(20, '0')}`, now
  });
  return { service, store, plaid, cipher, now,
    advance: milliseconds => { nowMs += milliseconds; } };
}

async function connected() {
  const f = fixture();
  const link = await f.service.createLinkToken('opaque-user-a');
  const dto = await f.service.exchange('opaque-user-a', { correlationId: link.correlationId,
    publicToken: 'public-token-private', institutionId: 'raw-institution-id' });
  return { ...f, link, dto };
}

test('creates a multi-account Sandbox link session with liabilities separately consented', async () => {
  const plaid = new FakePlaid();
  plaid.createLinkToken = async () => ({ link_token: 'link-sandbox-token',
    expiration: new Date(Date.UTC(2026, 7, 24, 22, 0, 0)).toISOString() });
  const { service, store, now } = fixture({ plaid });
  const result = await service.createLinkToken('opaque-user-a');
  assert.equal(result.environment, 'SANDBOX');
  assert.equal(result.linkToken, 'link-sandbox-token');
  assert.equal(store.sessions.get(`opaque-user-a|${result.correlationId}`).status, 'PENDING');
  assert.deepEqual(store.sessions.get(`opaque-user-a|${result.correlationId}`).products, ['assets']);
  assert.deepEqual(store.sessions.get(`opaque-user-a|${result.correlationId}`).additionalConsentedProducts,
    ['liabilities']);
  assert.equal(Date.parse(result.expiresAt) - now(), 4 * 60 * 60 * 1000);
});

test('new Link remains exchangeable after the removed 15-minute local cutoff', async () => {
  const plaid = new FakePlaid();
  plaid.createLinkToken = async () => ({ link_token: 'link-sandbox-token',
    expiration: new Date(Date.UTC(2026, 7, 24, 22, 0, 0)).toISOString() });
  const { service, advance } = fixture({ plaid });
  const link = await service.createLinkToken('opaque-user-a');
  advance(31 * 60 * 1000);
  const result = await service.exchange('opaque-user-a', {
    correlationId: link.correlationId, publicToken: 'public', institutionId: 'raw-institution-id'
  });
  assert.equal(result.lifecycleStatus, 'ACTIVE');
});

test('invalid provider Link expiration fails closed without a local session', async () => {
  const plaid = new FakePlaid();
  plaid.createLinkToken = async () => ({ link_token: 'link-sandbox-token', expiration: '' });
  const { service, store } = fixture({ plaid });
  await assert.rejects(service.createLinkToken('opaque-user-a'),
    error => error.code === 'PROVIDER_RESPONSE_INVALID');
  assert.equal(store.sessions.size, 0);
});

test('Update Mode applies its separate 30-minute maximum', async () => {
  const plaid = new FakePlaid();
  plaid.createUpdateLinkToken = async () => ({ link_token: 'link-update-token',
    expiration: new Date(Date.UTC(2026, 7, 24, 22, 0, 0)).toISOString() });
  const { service, store, dto, now } = await (async () => {
    const connectedFixture = fixture({ plaid });
    const link = await connectedFixture.service.createLinkToken('opaque-user-a');
    const connection = await connectedFixture.service.exchange('opaque-user-a', {
      correlationId: link.correlationId, publicToken: 'public', institutionId: 'raw-institution-id'
    });
    return { ...connectedFixture, dto: connection };
  })();
  store.connections.get(`opaque-user-a|${dto.protectedConnectionKey}`).lifecycleStatus = 'REAUTH_REQUIRED';
  const update = await service.createUpdateLinkToken('opaque-user-a', {
    protectedConnectionKey: dto.protectedConnectionKey
  });
  assert.equal(Date.parse(update.expiresAt) - now(), 30 * 60 * 1000);
});

test('create mode uses a shorter connection-intent lock than the provider link session', async () => {
  const plaid = new FakePlaid();
  plaid.createLinkToken = async () => ({ link_token: 'link-sandbox-token',
    expiration: new Date(Date.UTC(2026, 7, 24, 22, 0, 0)).toISOString() });
  const { service, store, now } = fixture({ plaid });
  const result = await service.createLinkToken('opaque-user-a');
  const session = store.sessions.get(`opaque-user-a|${result.correlationId}`);
  const lock = store.connectionLocks.get('opaque-user-a');
  assert.equal(Date.parse(result.expiresAt) - now(), 4 * 60 * 60 * 1000);
  assert.equal(lock.expiresAtMs - now(), 30 * 60 * 1000);
  assert.ok(session.expiresAtMs > lock.expiresAtMs);
});

test('guards concurrent connection intents for one protected user', async () => {
  const { service } = fixture();
  await service.createLinkToken('opaque-user-a');
  await assert.rejects(service.createLinkToken('opaque-user-a'), error => error.code === 'CONNECT_IN_PROGRESS');
  await service.createLinkToken('opaque-user-b');
});

test('allows a new Link after the connection-intent lock expires while the session remains valid', async () => {
  const plaid = new FakePlaid();
  plaid.createLinkToken = async () => ({ link_token: 'link-sandbox-token',
    expiration: new Date(Date.UTC(2026, 7, 24, 22, 0, 0)).toISOString() });
  const { service, advance } = fixture({ plaid });
  const first = await service.createLinkToken('opaque-user-a');
  advance(31 * 60 * 1000);
  const second = await service.createLinkToken('opaque-user-a');
  assert.notEqual(second.correlationId, first.correlationId);
  const result = await service.exchange('opaque-user-a', {
    correlationId: second.correlationId, publicToken: 'public', institutionId: 'raw-institution-id'
  });
  assert.equal(result.lifecycleStatus, 'ACTIVE');
});

test('abandoning a pending Link session releases the connection-intent lock', async () => {
  const { service } = fixture();
  const link = await service.createLinkToken('opaque-user-a');
  await service.abandonLinkSession('opaque-user-a', { correlationId: link.correlationId });
  const retry = await service.createLinkToken('opaque-user-a');
  assert.notEqual(retry.correlationId, link.correlationId);
  await assert.rejects(service.exchange('opaque-user-a', {
    correlationId: link.correlationId, publicToken: 'public', institutionId: 'raw-institution-id'
  }), error => error.code === 'LINK_SESSION_REPLAY');
});

test('update mode keeps its separate 30-minute lock and session lifetime', async () => {
  const plaid = new FakePlaid();
  plaid.createLinkToken = async () => ({ link_token: 'link-sandbox-token',
    expiration: new Date(Date.UTC(2026, 7, 24, 22, 0, 0)).toISOString() });
  const connectedFixture = fixture({ plaid });
  const link = await connectedFixture.service.createLinkToken('opaque-user-a');
  const dto = await connectedFixture.service.exchange('opaque-user-a', {
    correlationId: link.correlationId, publicToken: 'public-token-private',
    institutionId: 'raw-institution-id'
  });
  plaid.createUpdateLinkToken = async () => ({ link_token: 'link-update-token',
    expiration: new Date(Date.UTC(2026, 7, 24, 22, 0, 0)).toISOString() });
  const { service, store, now } = connectedFixture;
  const update = await service.createUpdateLinkToken('opaque-user-a', {
    protectedConnectionKey: dto.protectedConnectionKey
  });
  const session = store.sessions.get(`opaque-user-a|${update.correlationId}`);
  const lock = store.connectionLocks.get('opaque-user-a');
  assert.equal(Date.parse(update.expiresAt) - now(), 30 * 60 * 1000);
  assert.equal(lock.expiresAtMs - now(), 30 * 60 * 1000);
  assert.equal(session.expiresAtMs, lock.expiresAtMs);
  await assert.rejects(service.createUpdateLinkToken('opaque-user-a', {
    protectedConnectionKey: dto.protectedConnectionKey
  }), error => error.code === 'CONNECT_IN_PROGRESS');
});

test('exchange persists only encrypted credentials and sanitized account discovery', async () => {
  const { store, dto } = await connected();
  const serialized = JSON.stringify(store.persistedDocuments);
  for (const forbidden of ['access-token-private', 'raw-item-id-private', 'raw-checking-id-private',
    'raw-savings-id-private', 'raw-credit-id-private', 'raw-investment-id-private',
    'raw-institution-id', '12345.67', '12000']) {
    assert.equal(serialized.includes(forbidden), false, `persisted documents contain ${forbidden}`);
    assert.equal(JSON.stringify(dto).includes(forbidden), false, `DTO contains ${forbidden}`);
  }
  assert.equal(dto.environment, 'SANDBOX');
  assert.equal(dto.institutionName, 'Sandbox Institution');
  assert.deepEqual(dto.accounts.map(account => account.type),
    ['depository', 'depository', 'credit', 'investment']);
  assert.deepEqual(Object.keys(dto.accounts[0]).sort(), [
    'displayName', 'lifecycleStatus', 'mask', 'officialName', 'protectedAccountKey', 'subtype', 'type'
  ]);
  assert.equal(dto.accounts[0].balance, undefined);
});

test('mock KMS abstraction round-trips and wrong-key decryption fails closed', async () => {
  const cipher = new FakeCipher('key-a');
  const encrypted = await cipher.encrypt(Buffer.from('access-token-private'));
  assert.equal(encrypted.ciphertext.includes('access-token-private'), false);
  assert.equal((await cipher.decrypt(encrypted.ciphertext)).toString(), 'access-token-private');
  await assert.rejects(new FakeCipher('key-b').decrypt(encrypted.ciphertext));
});

test('runtime status proves secrets, Firestore nonce completion, and KMS round trip without exposing values', async () => {
  const { service } = fixture();
  const status = await service.runtimeStatus();
  assert.deepEqual(status, {
    ok: true,
    environment: 'SANDBOX',
    firestoreNonceConsumed: true,
    kmsEncryptDecrypt: true,
    secrets: {
      clientIdReadable: true,
      providerSecretReadable: true,
      sandboxSecretReadable: true
    }
  });
  assert.equal(JSON.stringify(status).includes('identity-hmac-test-secret'), false);
  assert.equal(JSON.stringify(status).includes('client-secret-value'), false);
  assert.equal(JSON.stringify(status).includes('sandbox-secret-value'), false);
});

test('protected identities are deterministic and environment isolated', () => {
  const a = protectedKey('secret', 'SANDBOX', 'PLAID_SANDBOX_V1|ITEM', 'raw-id');
  assert.equal(a, protectedKey('secret', 'SANDBOX', 'PLAID_SANDBOX_V1|ITEM', 'raw-id'));
  assert.notEqual(a, protectedKey('secret', 'TRIAL', 'PLAID_TRIAL_V1|ITEM', 'raw-id'));
});

test('an existing institution does not block starting Link for a distinct institution', async () => {
  const { service, plaid } = await connected();
  let calls = 0;
  plaid.createLinkToken = async () => { calls += 1; return { link_token: 'next-institution-link',
    expiration: new Date(Date.now() + 10 * 60 * 1000).toISOString() }; };
  const link = await service.createLinkToken('opaque-user-a');
  assert.equal(link.linkToken, 'next-institution-link');
  assert.equal(calls, 1);
});

test('exchange session is one-time and owner-scoped', async () => {
  const { service, store, now } = fixture();
  const link = await service.createLinkToken('opaque-user-a');
  await assert.rejects(service.exchange('opaque-user-b', { correlationId: link.correlationId,
    publicToken: 'public', institutionId: 'raw-institution-id' }), error => error.code === 'LINK_SESSION_NOT_FOUND');
  await service.exchange('opaque-user-a', { correlationId: link.correlationId,
    publicToken: 'public', institutionId: 'raw-institution-id' });
  await assert.rejects(service.exchange('opaque-user-a', { correlationId: link.correlationId,
    publicToken: 'public', institutionId: 'raw-institution-id' }), error => error.code === 'LINK_SESSION_REPLAY');
});

test('expired CREATE completion is quarantined and blocks another provider Link call', async () => {
  const { service, store, plaid, now } = fixture();
  store.sessions.set('opaque-user-a|expired-correlation', { status: 'PENDING', mode: 'CREATE',
    connectionKey: '', expiresAtMs: now() - 1 });
  await assert.rejects(service.exchange('opaque-user-a', { correlationId: 'expired-correlation',
    publicToken: 'public', institutionId: 'raw-institution-id' }),
    error => error.code === 'LINK_COMPLETION_REVIEW_REQUIRED');
  assert.equal(store.sessions.get('opaque-user-a|expired-correlation').status,
    'COMPLETION_REVIEW_REQUIRED');
  let calls = 0;
  plaid.createLinkToken = async () => { calls += 1; return { link_token: 'unexpected' }; };
  await assert.rejects(service.createLinkToken('opaque-user-a'),
    error => error.code === 'LINK_COMPLETION_REVIEW_REQUIRED');
  assert.equal(calls, 0);
});

test('unresolved exchange blocks another provider Link call across reloads or tabs', async () => {
  const { service, store, plaid, now } = fixture();
  store.sessions.set('opaque-user-a|exchange-in-progress', { status: 'EXCHANGING', mode: 'CREATE',
    connectionKey: '', expiresAtMs: now() + 60000 });
  let calls = 0;
  plaid.createLinkToken = async () => { calls += 1; return { link_token: 'unexpected' }; };
  await assert.rejects(service.createLinkToken('opaque-user-a'),
    error => error.code === 'LINK_COMPLETION_REVIEW_REQUIRED');
  assert.equal(calls, 0);
});

test('duplicate institution is rejected before public-token exchange consumes another Item', async () => {
  const { service, store, plaid } = await connected();
  store.sessions.set('opaque-user-a|second-correlation', { status: 'PENDING', mode: 'CREATE',
    connectionKey: '', expiresAtMs: Date.now() + 60000 });
  await assert.rejects(service.exchange('opaque-user-a', { correlationId: 'second-correlation',
    publicToken: 'second-public', institutionId: 'raw-institution-id' }),
  error => error.code === 'REUSABLE_INSTITUTION_EXISTS');
  assert.equal(plaid.exchangeCalls, 1);
  assert.deepEqual(plaid.removedTokens, []);
});

test('provider-rejected replayed public token cannot create a connection', async () => {
  const { service, store } = fixture();
  store.sessions.set('opaque-user-a|replay-correlation', { status: 'PENDING', mode: 'CREATE',
    connectionKey: '', expiresAtMs: Date.now() + 60000 });
  await assert.rejects(service.exchange('opaque-user-a', {
    correlationId: 'replay-correlation', publicToken: 'provider-replayed-token',
    institutionId: 'other-institution-id'
  }));
  assert.equal(store.connections.size, 0);
});

test('update mode decrypts the existing credential and preserves Item identity', async () => {
  const { service, store, dto } = await connected();
  store.connections.get(`opaque-user-a|${dto.protectedConnectionKey}`).lifecycleStatus = 'REAUTH_REQUIRED';
  const update = await service.createUpdateLinkToken('opaque-user-a', {
    protectedConnectionKey: dto.protectedConnectionKey
  });
  assert.equal(update.linkToken, 'link-update-token');
  assert.equal(update.protectedConnectionKey, dto.protectedConnectionKey);
  const complete = await service.completeUpdate('opaque-user-a', {
    protectedConnectionKey: dto.protectedConnectionKey, correlationId: update.correlationId
  });
  assert.equal(complete.lifecycleStatus, 'ACTIVE');
  assert.equal(store.connections.size, 1);
});

test('update Link session cannot be diverted into public-token exchange', async () => {
  const { service, store, dto } = await connected();
  store.connections.get(`opaque-user-a|${dto.protectedConnectionKey}`).lifecycleStatus = 'REAUTH_REQUIRED';
  const update = await service.createUpdateLinkToken('opaque-user-a', {
    protectedConnectionKey: dto.protectedConnectionKey
  });
  await assert.rejects(service.exchange('opaque-user-a', {
    correlationId: update.correlationId, publicToken: 'synthetic-public',
    institutionId: 'raw-institution-id'
  }), error => error.code === 'LINK_SESSION_MISMATCH');
  assert.equal(store.connections.size, 1);
});

test('multi-account preview is read-only and preserves depository and credit evidence', async () => {
  const { service, store, plaid, dto } = await connected();
  const before = store.persistedDocuments.length;
  const result = await service.preview('opaque-user-a', {
    protectedConnectionKey: dto.protectedConnectionKey,
    existingFactsByProtectedAccountKey: {
      [dto.accounts.find(account => account.type === 'credit').protectedAccountKey]: {
        CURRENT_BALANCE: { value: 420.25 }, CREDIT_LIMIT: { value: 1800 }
      }
    }
  });
  assert.equal(result.readOnly, true);
  assert.equal(result.authority, 'SHADOW_ONLY');
  assert.deepEqual(result.products, ['assets', 'liabilities']);
  assert.deepEqual(result.sources, ['accounts/get', 'liabilities/get']);
  assert.deepEqual(result.accounts.map(account => account.type),
    ['depository', 'depository', 'credit', 'investment']);
  const checkingRows = result.accounts.find(account => account.subtype === 'checking').rows;
  assert.equal(checkingRows.find(row => row.factType === 'CURRENT_BALANCE').status,
    'SEMANTIC_REVIEW_REQUIRED');
  assert.equal(checkingRows.some(row => row.factType === 'APR_COMPONENT_EVIDENCE'), false);
  const rows = result.accounts.find(account => account.type === 'credit').rows;
  assert.equal(rows.find(row => row.factType === 'CURRENT_BALANCE').status, 'MATCH');
  assert.equal(rows.find(row => row.factType === 'CREDIT_LIMIT').status, 'DIFFERENT');
  assert.equal(rows.find(row => row.factType === 'MINIMUM_PAYMENT').candidate.numericValue, 0);
  assert.equal(rows.find(row => row.factType === 'STATEMENT_BALANCE').effectiveAsOf, '2026-08-01');
  assert.equal(rows.filter(row => row.factType.includes('APR')).length, 2);
  assert.ok(rows.filter(row => row.factType.includes('APR')).every(row => row.status === 'SEMANTIC_REVIEW_REQUIRED'));
  assert.equal(rows.some(row => row.factType === 'APR'), false);
  assert.equal(result.accounts.find(account => account.type === 'investment').rows[0].reason,
    'UNSUPPORTED_ACCOUNT_TYPE');
  assert.equal(plaid.liabilitiesCalls, 1);
  assert.equal(store.persistedDocuments.length, before);
  assert.equal(JSON.stringify(result).includes('raw-account-id-private'), false);
  assert.equal(JSON.stringify(result).includes('access-token-private'), false);
  assert.equal(JSON.stringify(result).includes('raw-request-id-private'), false);
});

test('account-scoped depository preview skips liabilities on mixed connections', async () => {
  const { service, plaid: observedPlaid, dto } = await connected();
  const checking = dto.accounts.find(account => account.subtype === 'checking');
  assert.ok(checking);
  const result = await service.preview('opaque-user-a', {
    protectedConnectionKey: dto.protectedConnectionKey,
    targetProtectedAccountKey: checking.protectedAccountKey,
    existingFactsByProtectedAccountKey: {
      [checking.protectedAccountKey]: { CURRENT_BALANCE: { value: 1000 } }
    }
  });
  assert.equal(result.accounts.length, 1);
  assert.equal(result.accounts[0].protectedAccountKey, checking.protectedAccountKey);
  assert.deepEqual(result.products, ['assets']);
  assert.deepEqual(result.sources, ['accounts/get']);
  assert.equal(observedPlaid.liabilitiesCalls, 0);
});

test('depository-only refresh does not initialize or call Liabilities', async () => {
  const plaid = new FakePlaid();
  plaid.getAccounts = async () => {
    plaid.accountsCalls += 1;
    return { item: { institution_id: 'raw-institution-id' }, accounts: [{
      account_id: 'raw-checking-id-private', name: 'Checking', type: 'depository',
      subtype: 'checking', mask: '1111', balances: { current: 10, available: 9,
        iso_currency_code: 'USD' }
    }] };
  };
  const { service, plaid: observedPlaid } = fixture({ plaid });
  const link = await service.createLinkToken('opaque-user-a');
  const dto = await service.exchange('opaque-user-a', { correlationId: link.correlationId,
    publicToken: 'public', institutionId: 'raw-institution-id' });
  const result = await service.preview('opaque-user-a', {
    protectedConnectionKey: dto.protectedConnectionKey,
    existingFactsByProtectedAccountKey: {}
  });
  assert.deepEqual(result.products, ['assets']);
  assert.deepEqual(result.sources, ['accounts/get']);
  assert.equal(observedPlaid.liabilitiesCalls, 0);
});

test('mortgage refresh reuses accounts/get and exposes current balance without Liabilities', async () => {
  const plaid = new FakePlaid();
  plaid.getAccounts = async () => {
    plaid.accountsCalls += 1;
    return { item: { institution_id: 'raw-institution-id' }, accounts: [{
      account_id: 'raw-mortgage-id-private', name: 'Mortgage', type: 'loan',
      subtype: 'mortgage', mask: '2222', balances: { current: 125000, available: 900000,
        iso_currency_code: 'USD' }
    }] };
  };
  const { service, plaid: observedPlaid } = fixture({ plaid });
  const link = await service.createLinkToken('opaque-user-a');
  const dto = await service.exchange('opaque-user-a', { correlationId: link.correlationId,
    publicToken: 'public', institutionId: 'raw-institution-id' });
  const result = await service.preview('opaque-user-a', {
    protectedConnectionKey: dto.protectedConnectionKey,
    existingFactsByProtectedAccountKey: {}
  });
  assert.deepEqual(result.products, ['assets']);
  assert.deepEqual(result.sources, ['accounts/get']);
  assert.equal(observedPlaid.liabilitiesCalls, 0);
  assert.deepEqual(result.accounts[0].rows.map(row => row.factType), ['CURRENT_BALANCE']);
  assert.equal(result.accounts[0].rows[0].candidate.numericValue, 125000);
  assert.equal(JSON.stringify(result).includes('900000'), false);
  assert.equal(JSON.stringify(result).includes('raw-mortgage-id-private'), false);
});

test('provider-discovered institution must match Link metadata before persistence', async () => {
  const plaid = new FakePlaid();
  const { service, store } = fixture({ plaid });
  const link = await service.createLinkToken('opaque-user-a');
  await assert.rejects(service.exchange('opaque-user-a', { correlationId: link.correlationId,
    publicToken: 'public', institutionId: 'different-institution-id' }),
  error => error.code === 'LINK_INSTITUTION_MISMATCH');
  assert.equal(store.connections.size, 0);
  assert.deepEqual(plaid.removedTokens, ['access-token-private']);
});

test('post-exchange discovery failure revokes the otherwise orphaned Item', async () => {
  const plaid = new FakePlaid();
  plaid.getAccounts = async () => { throw new Error('discovery failed'); };
  const { service } = fixture({ plaid });
  const link = await service.createLinkToken('opaque-user-a');
  await assert.rejects(service.exchange('opaque-user-a', { correlationId: link.correlationId,
    publicToken: 'public', institutionId: 'raw-institution-id' }));
  assert.deepEqual(plaid.removedTokens, ['access-token-private']);
});

test('connections and disconnect are owner-scoped', async () => {
  const { service, dto } = await connected();
  assert.equal((await service.list('opaque-user-b')).connections.length, 0);
  await assert.rejects(service.disconnect('opaque-user-b', { protectedConnectionKey: dto.protectedConnectionKey }), error => error.code === 'CONNECTION_NOT_FOUND');
});

test('disconnect revokes, deletes ciphertext, tombstones, and is idempotent', async () => {
  const { service, store, plaid, dto } = await connected();
  const result = await service.disconnect('opaque-user-a', { protectedConnectionKey: dto.protectedConnectionKey });
  assert.equal(result.lifecycleStatus, 'DISCONNECTED');
  assert.deepEqual(plaid.removedTokens, ['access-token-private']);
  const persisted = store.connections.get(`opaque-user-a|${dto.protectedConnectionKey}`);
  assert.equal(persisted.credentialCiphertext, undefined);
  assert.equal(persisted.lifecycleStatus, 'DISCONNECTED');
  assert.equal(persisted.accounts[0].lifecycleStatus, 'DISCONNECTED');
  assert.equal((await service.disconnect('opaque-user-a', { protectedConnectionKey: dto.protectedConnectionKey })).idempotent, true);
});

test('transient disconnect failure retains encrypted credential as DISCONNECT_PENDING', async () => {
  const { service, store, plaid, dto } = await connected();
  plaid.removeMode = 'transient';
  await assert.rejects(service.disconnect('opaque-user-a', { protectedConnectionKey: dto.protectedConnectionKey }), error => error.code === 'DISCONNECT_PENDING');
  const persisted = store.connections.get(`opaque-user-a|${dto.protectedConnectionKey}`);
  assert.equal(persisted.lifecycleStatus, 'DISCONNECT_PENDING');
  assert.ok(persisted.credentialCiphertext);
});

test('shared owner identity reuses legacy Chase connections and mappings across signers', async () => {
  const legacyUserKey = 'legacy_owner_key_1234567890';
  const f = fixture({ config: fakeConfig({ environment: 'TRIAL', providerProfile: 'PLAID_TRIAL_V1' }) });
  const link = await f.service.createLinkToken(legacyUserKey);
  const connection = await f.service.exchange(legacyUserKey, {
    correlationId: link.correlationId, publicToken: 'public', institutionId: 'raw-institution-id'
  });
  const account = connection.accounts.find(value => value.type === 'credit');
  const firstSigner = await f.service.resolveRequestIdentity({
    userKey: 'central_signer_subject', legacyUserKey, userEmail: 'samertheodossy@gmail.com'
  });
  const source = [{ protectedConnectionKey: connection.protectedConnectionKey,
    protectedAccountKey: account.protectedAccountKey, stableAccountId: 'DEBT:CHASE_CARD',
    status: 'CONFIRMED' }];
  const migrated = await f.service.migrateMappings(firstSigner.userKey, {
    legacyUserKey, mappings: source
  }, firstSigner);
  assert.equal(migrated.migrated, true);
  const secondSigner = await f.service.resolveRequestIdentity({
    userKey: 'bounded_signer_subject', legacyUserKey: 'different_assertion_subject',
    userEmail: 'samertheodossy@gmail.com'
  });
  assert.equal(secondSigner.userKey, legacyUserKey);
  const mappings = await f.service.listMappings(secondSigner.userKey, {}, secondSigner);
  assert.equal(mappings.mappings.length, 1);
  assert.equal(mappings.mappings[0].stableAccountId, 'DEBT:CHASE_CARD');
  const repeated = await f.service.migrateMappings(secondSigner.userKey, {
    legacyUserKey, mappings: source
  }, secondSigner);
  assert.equal(repeated.idempotent, true);
});

test('shared mapping authority isolates users and supports ignore remap invalidate lifecycle', async () => {
  const f = await connected();
  const account = f.dto.accounts.find(value => value.type === 'credit');
  const identity = { actorKey: 'actor-a', userEmail: 'owner@example.com' };
  const base = { protectedConnectionKey: f.dto.protectedConnectionKey,
    protectedAccountKey: account.protectedAccountKey };
  const confirmed = await f.service.saveMapping('opaque-user-a', {
    ...base, stableAccountId: 'DEBT:CARD_A', status: 'CONFIRMED'
  }, identity);
  const ignored = await f.service.saveMapping('opaque-user-a', {
    ...base, status: 'IGNORED', expectedRevision: confirmed.mapping.revision
  }, identity);
  assert.equal(ignored.mapping.status, 'IGNORED');
  const remapped = await f.service.saveMapping('opaque-user-a', {
    ...base, stableAccountId: 'DEBT:CARD_B', status: 'CONFIRMED',
    expectedRevision: ignored.mapping.revision
  }, identity);
  assert.equal((await f.service.resolveMapping('opaque-user-a', base, identity))
    .mapping.stableAccountId, 'DEBT:CARD_B');
  assert.equal((await f.service.listMappings('opaque-user-b', {}, {
    actorKey: 'actor-b', userEmail: 'other@example.com'
  })).mappings.length, 0);
  await f.service.invalidateMapping('opaque-user-a', {
    ...base, expectedRevision: remapped.mapping.revision
  }, identity);
  await assert.rejects(f.service.resolveMapping('opaque-user-a', base, identity),
    error => error.code === 'MAPPING_NOT_RESOLVED');
});

test('legacy mapping migration fails closed on owner or source conflict', async () => {
  const legacyUserKey = 'legacy_owner_key_1234567890';
  const f = fixture({ config: fakeConfig({ environment: 'TRIAL', providerProfile: 'PLAID_TRIAL_V1' }) });
  const link = await f.service.createLinkToken(legacyUserKey);
  const connection = await f.service.exchange(legacyUserKey, {
    correlationId: link.correlationId, publicToken: 'public', institutionId: 'raw-institution-id'
  });
  const account = connection.accounts.find(value => value.type === 'credit');
  const identity = await f.service.resolveRequestIdentity({ userKey: 'central_signer_subject',
    legacyUserKey, userEmail: 'samertheodossy@gmail.com' });
  const base = { protectedConnectionKey: connection.protectedConnectionKey,
    protectedAccountKey: account.protectedAccountKey, status: 'CONFIRMED' };
  await f.service.migrateMappings(identity.userKey, {
    legacyUserKey, mappings: [{ ...base, stableAccountId: 'DEBT:CARD_A' }]
  }, identity);
  await assert.rejects(f.service.migrateMappings(identity.userKey, {
    legacyUserKey, mappings: [{ ...base, stableAccountId: 'DEBT:CARD_B' }]
  }, identity), error => error.code === 'MAPPING_MIGRATION_CONFLICT');
  await assert.rejects(f.service.migrateMappings(identity.userKey, {
    legacyUserKey, mappings: [{ ...base, stableAccountId: 'DEBT:CARD_A' }]
  }, { ...identity, userEmail: 'not-the-admin@example.com' }),
  error => error.code === 'MIGRATION_FORBIDDEN');
});
