import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { ServiceError } from '../src/errors.js';

export class FakeCipher {
  constructor(key = 'test-key-a') {
    this.keyName = `mock-kms/${key}`;
    this.key = createHash('sha256').update(key).digest();
  }
  async encrypt(plaintext) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { ciphertext: Buffer.concat([iv, tag, encrypted]).toString('base64'), keyName: this.keyName };
  }
  async decrypt(encoded) {
    const value = Buffer.from(encoded, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', this.key, value.subarray(0, 12));
    decipher.setAuthTag(value.subarray(12, 28));
    return Buffer.concat([decipher.update(value.subarray(28)), decipher.final()]);
  }
}

export class FakeStore {
  constructor(now = () => Date.now()) {
    this.now = now;
    this.nonces = new Set();
    this.sessions = new Map();
    this.connections = new Map();
    this.identityAliases = new Map();
    this.mappings = new Map();
    this.mappingMigrations = new Map();
    this.persistedDocuments = [];
  }
  key(user, id) { return `${user}|${id}`; }
  mappingKey(user, connectionKey, accountKey) {
    return `${user}|${connectionKey}|${accountKey}`;
  }
  publicMapping(value) {
    return JSON.parse(JSON.stringify(value));
  }
  ownedAccount(user, connectionKey, accountKey) {
    const connection = this.connections.get(this.key(user, connectionKey));
    const account = connection?.accounts?.find(value => value.protectedAccountKey === accountKey);
    if (!connection || !account) {
      throw new ServiceError(404, 'MAPPING_ACCOUNT_NOT_FOUND', 'not found');
    }
    if (!['ACTIVE', 'REAUTH_REQUIRED'].includes(connection.lifecycleStatus) ||
        !['ACTIVE', 'REAUTH_REQUIRED'].includes(account.lifecycleStatus || connection.lifecycleStatus)) {
      throw new ServiceError(409, 'MAPPING_ACCOUNT_INACTIVE', 'inactive');
    }
    return { connection, account };
  }
  async resolveIdentityAlias(actorKey) {
    return this.identityAliases.get(actorKey) || actorKey;
  }
  async listMappings(user) {
    return [...this.mappings.entries()]
      .filter(([key]) => key.startsWith(`${user}|`))
      .map(([, value]) => this.publicMapping(value));
  }
  async saveMapping(user, mapping, now = this.now()) {
    this.ownedAccount(user, mapping.protectedConnectionKey, mapping.protectedAccountKey);
    const key = this.mappingKey(user, mapping.protectedConnectionKey, mapping.protectedAccountKey);
    const existing = this.mappings.get(key);
    const revision = Number(existing?.revision || 0);
    if (mapping.expectedRevision !== null && mapping.expectedRevision !== revision) {
      throw new ServiceError(409, 'MAPPING_REVISION_CONFLICT', 'revision conflict');
    }
    const value = {
      protectedConnectionKey: mapping.protectedConnectionKey,
      protectedAccountKey: mapping.protectedAccountKey,
      stableAccountId: mapping.stableAccountId,
      status: mapping.status,
      revision: revision + 1,
      updatedAt: new Date(now).toISOString()
    };
    this.mappings.set(key, value);
    return this.publicMapping(value);
  }
  async invalidateMapping(user, input, now = this.now()) {
    const key = this.mappingKey(user, input.protectedConnectionKey, input.protectedAccountKey);
    const existing = this.mappings.get(key);
    if (!existing) throw new ServiceError(404, 'MAPPING_NOT_FOUND', 'not found');
    if (input.expectedRevision !== null && input.expectedRevision !== existing.revision) {
      throw new ServiceError(409, 'MAPPING_REVISION_CONFLICT', 'revision conflict');
    }
    const value = { ...existing, stableAccountId: '', status: 'INVALIDATED',
      revision: existing.revision + 1, updatedAt: new Date(now).toISOString() };
    this.mappings.set(key, value);
    return this.publicMapping(value);
  }
  async resolveMapping(user, input) {
    const value = this.mappings.get(this.mappingKey(user, input.protectedConnectionKey,
      input.protectedAccountKey));
    if (!value || value.status !== 'CONFIRMED' || !value.stableAccountId) {
      throw new ServiceError(404, 'MAPPING_NOT_RESOLVED', 'not resolved');
    }
    return this.publicMapping(value);
  }
  async migrateMappings({ actorKey, legacyUserKey, userEmail, sourceDigest, mappings }, now = this.now()) {
    const alias = this.identityAliases.get(actorKey);
    if (alias && alias !== legacyUserKey) {
      throw new ServiceError(409, 'IDENTITY_ALIAS_CONFLICT', 'alias conflict');
    }
    const markerKey = `${legacyUserKey}|sharedMappingAuthorityV1`;
    const marker = this.mappingMigrations.get(markerKey);
    if (marker) {
      if (marker.actorKey !== actorKey || marker.legacyUserKey !== legacyUserKey ||
          marker.sourceDigest !== sourceDigest) {
        throw new ServiceError(409, 'MAPPING_MIGRATION_CONFLICT', 'migration conflict');
      }
      return { migrated: false, idempotent: true };
    }
    mappings.forEach(mapping => {
      this.ownedAccount(legacyUserKey, mapping.protectedConnectionKey, mapping.protectedAccountKey);
      const existing = this.mappings.get(this.mappingKey(legacyUserKey,
        mapping.protectedConnectionKey, mapping.protectedAccountKey));
      if (existing && (existing.status !== mapping.status ||
          existing.stableAccountId !== mapping.stableAccountId)) {
        throw new ServiceError(409, 'MAPPING_MIGRATION_CONFLICT', 'mapping conflict');
      }
    });
    this.identityAliases.set(actorKey, legacyUserKey);
    mappings.forEach(mapping => {
      const key = this.mappingKey(legacyUserKey, mapping.protectedConnectionKey,
        mapping.protectedAccountKey);
      if (!this.mappings.has(key)) {
        this.mappings.set(key, {
          protectedConnectionKey: mapping.protectedConnectionKey,
          protectedAccountKey: mapping.protectedAccountKey,
          stableAccountId: mapping.stableAccountId,
          status: mapping.status,
          revision: 1,
          updatedAt: new Date(now).toISOString()
        });
      }
    });
    this.mappingMigrations.set(markerKey, { actorKey, legacyUserKey, userEmail, sourceDigest });
    return { migrated: true, idempotent: false };
  }
  async consumeNonce(user, nonce) {
    const key = this.key(user, nonce);
    if (this.nonces.has(key)) throw new ServiceError(409, 'AUTH_REPLAY', 'replay');
    this.nonces.add(key);
  }
  async createLinkSession(user, session) {
    for (const [key, value] of this.sessions) {
      if (key.startsWith(`${user}|`) && value.status === 'PENDING' && value.expiresAtMs > this.now()) {
        throw new ServiceError(409, 'CONNECT_IN_PROGRESS', 'in progress');
      }
    }
    this.sessions.set(this.key(user, session.correlationId), {
      ...session, connectionKey: session.connectionKey || '', status: 'PENDING'
    });
  }
  async consumeLinkSession(user, id, now, expected = null) {
    const session = this.sessions.get(this.key(user, id));
    if (!session) throw new ServiceError(404, 'LINK_SESSION_NOT_FOUND', 'not found');
    if (session.status !== 'PENDING') throw new ServiceError(409, 'LINK_SESSION_REPLAY', 'replay');
    if (session.expiresAtMs <= now) {
      if (expected?.mode === 'CREATE' && session.mode === 'CREATE') {
        session.status = 'COMPLETION_REVIEW_REQUIRED';
        throw new ServiceError(409, 'LINK_COMPLETION_REVIEW_REQUIRED', 'review');
      }
      throw new ServiceError(410, 'LINK_SESSION_EXPIRED', 'expired');
    }
    if (expected && (session.mode !== expected.mode || session.connectionKey !== expected.connectionKey)) {
      throw new ServiceError(409, 'LINK_SESSION_MISMATCH', 'mismatch');
    }
    session.status = 'EXCHANGING';
  }
  async markLinkSession(user, id, status) {
    const session = this.sessions.get(this.key(user, id));
    if (session) session.status = status;
  }
  async createConnection(user, connection, accounts) {
    const key = this.key(user, connection.connectionKey);
    const existing = this.connections.get(key);
    if (existing && existing.lifecycleStatus !== 'DISCONNECTED') {
      throw new ServiceError(409, 'DUPLICATE_CONNECTION', 'duplicate');
    }
    const value = { ...connection, lifecycleStatus: 'ACTIVE', accounts: accounts.map(a => ({ ...a, lifecycleStatus: 'ACTIVE' })) };
    this.connections.set(key, value);
    this.persistedDocuments.push(JSON.parse(JSON.stringify(value)));
  }
  async assertNoReusableConnection(user) {
    const reusable = [...this.connections.entries()].some(([key, value]) => key.startsWith(`${user}|`) &&
      ['ACTIVE', 'REAUTH_REQUIRED', 'DISCONNECTING', 'DISCONNECT_PENDING'].includes(value.lifecycleStatus));
    if (reusable) throw new ServiceError(409, 'REUSABLE_CONNECTION_EXISTS', 'reuse');
  }
  async assertNoReusableInstitution(user, protectedInstitutionKey) {
    const reusable = [...this.connections.entries()].some(([key, value]) => key.startsWith(`${user}|`) &&
      value.protectedInstitutionKey === protectedInstitutionKey &&
      ['ACTIVE', 'REAUTH_REQUIRED', 'DISCONNECTING', 'DISCONNECT_PENDING'].includes(value.lifecycleStatus));
    if (reusable) throw new ServiceError(409, 'REUSABLE_INSTITUTION_EXISTS', 'reuse institution');
  }
  async assertNoUnresolvedLinkCompletion(user) {
    const unresolved = [...this.sessions.entries()].some(([key, value]) =>
      key.startsWith(`${user}|`) && ['EXCHANGING', 'COMPLETION_REVIEW_REQUIRED'].includes(value.status));
    if (unresolved) throw new ServiceError(409, 'LINK_COMPLETION_REVIEW_REQUIRED', 'review');
  }
  async getReusableConnection(user, connectionKey) {
    const value = this.connections.get(this.key(user, connectionKey));
    if (!value) throw new ServiceError(404, 'CONNECTION_NOT_FOUND', 'not found');
    if (!['ACTIVE', 'REAUTH_REQUIRED'].includes(value.lifecycleStatus) || !value.credentialCiphertext) {
      throw new ServiceError(409, 'CONNECTION_NOT_REUSABLE', 'not reusable');
    }
    return value;
  }
  async listConnections(user) {
    return [...this.connections.entries()].filter(([key]) => key.startsWith(`${user}|`)).map(([, value]) => JSON.parse(JSON.stringify(value)));
  }
  async beginDisconnect(user, connectionKey) {
    const value = this.connections.get(this.key(user, connectionKey));
    if (!value) throw new ServiceError(404, 'CONNECTION_NOT_FOUND', 'not found');
    if (value.lifecycleStatus === 'DISCONNECTED') return { alreadyDisconnected: true };
    if (value.lifecycleStatus === 'DISCONNECTING') throw new ServiceError(409, 'DISCONNECT_IN_PROGRESS', 'in progress');
    if (!value.credentialCiphertext) throw new ServiceError(409, 'CREDENTIAL_UNAVAILABLE', 'missing');
    value.lifecycleStatus = 'DISCONNECTING';
    return { alreadyDisconnected: false, credentialCiphertext: value.credentialCiphertext };
  }
  async completeDisconnect(user, connectionKey) {
    const value = this.connections.get(this.key(user, connectionKey));
    value.lifecycleStatus = 'DISCONNECTED';
    delete value.credentialCiphertext;
    value.accounts.forEach(account => { account.lifecycleStatus = 'DISCONNECTED'; });
  }
  async markDisconnectPending(user, connectionKey, reasonCode) {
    const value = this.connections.get(this.key(user, connectionKey));
    value.lifecycleStatus = 'DISCONNECT_PENDING';
    value.disconnectReasonCode = reasonCode;
  }
  async completeReconnect(user, connectionKey) {
    const value = this.connections.get(this.key(user, connectionKey));
    if (!value || !['ACTIVE', 'REAUTH_REQUIRED'].includes(value.lifecycleStatus) || !value.credentialCiphertext) {
      throw new ServiceError(409, 'CONNECTION_NOT_REUSABLE', 'not reusable');
    }
    value.lifecycleStatus = 'ACTIVE';
    delete value.reconnectReasonCode;
  }
  async listStoredAccounts(user, connectionKey) {
    const value = this.connections.get(this.key(user, connectionKey));
    if (!value || !Array.isArray(value.accounts)) return [];
    return value.accounts.map(account => JSON.parse(JSON.stringify(account)));
  }
  async recordObservation(user, connectionKey, observedAt) {
    this.connections.get(this.key(user, connectionKey)).lastObservedAt = observedAt;
  }
  async markReauthRequired(user, connectionKey, reasonCode) {
    const value = this.connections.get(this.key(user, connectionKey));
    value.lifecycleStatus = 'REAUTH_REQUIRED';
    value.reconnectReasonCode = reasonCode;
  }
}

export function fakeConfig(overrides = {}) {
  const assertionPublicKeyPem = overrides.assertionPublicKeyPem;
  const assertionKeyId = overrides.assertionKeyId || 'central-v1';
  const assertionPublicKeys = overrides.assertionPublicKeys ||
    (assertionPublicKeyPem ? { [assertionKeyId]: assertionPublicKeyPem } : {});
  return {
    environment: 'SANDBOX',
    providerProfile: 'PLAID_SANDBOX_V1',
    assertionAudience: 'cashcompass-plaid-backend',
    assertionIssuer: 'cashcompass-central-app',
    assertionPublicKeys,
    assertionMaxLifetimeSeconds: 90,
    clockSkewSeconds: 15,
    ...overrides,
    assertionPublicKeys
  };
}

export function fakeCredentials() {
  return {
    async getIdentityHmac() { return 'identity-hmac-test-secret'; },
    async getPlaidCredentials() { return { clientId: 'client-secret-value', secret: 'sandbox-secret-value' }; },
    async safeStatus() { return { clientIdReadable: true, providerSecretReadable: true }; }
  };
}

export class FakePlaid {
  constructor() {
    this.removeMode = 'success';
    this.removedTokens = [];
    this.exchangeCalls = 0;
    this.accountsCalls = 0;
    this.liabilitiesCalls = 0;
  }
  async createLinkToken() { return { link_token: 'link-sandbox-token', expiration: new Date(Date.now() + 10 * 60 * 1000).toISOString() }; }
  async createUpdateLinkToken() { return { link_token: 'link-update-token', expiration: new Date(Date.now() + 10 * 60 * 1000).toISOString() }; }
  async exchangePublicToken(token) {
    this.exchangeCalls += 1;
    if (token === 'provider-replayed-token') throw Object.assign(new Error('replay'), { errorCode: 'INVALID_PUBLIC_TOKEN' });
    return { access_token: 'access-token-private', item_id: 'raw-item-id-private' };
  }
  async getAccounts() {
    this.accountsCalls += 1;
    return {
      item: { institution_id: 'raw-institution-id' },
      accounts: [{
        account_id: 'raw-checking-id-private',
        name: 'Sandbox Checking', official_name: 'Sandbox Checking Official',
        type: 'depository', subtype: 'checking', mask: '1111',
        balances: { current: 12345.67, available: 12000, iso_currency_code: 'USD' }
      }, {
        account_id: 'raw-savings-id-private',
        name: 'Sandbox Savings', official_name: 'Sandbox Savings Official',
        type: 'depository', subtype: 'savings', mask: '2222',
        balances: { current: 7000, available: 6900, iso_currency_code: 'USD' }
      }, {
        account_id: 'raw-credit-id-private', name: 'Synthetic Card',
        official_name: 'Synthetic Card Official', type: 'credit', subtype: 'credit card', mask: '3333',
        balances: { current: 420.25, available: 1579.75, limit: 2000, iso_currency_code: 'USD' }
      }, {
        account_id: 'raw-investment-id-private', name: 'Unsupported Brokerage',
        official_name: 'Unsupported Brokerage Official', type: 'investment', subtype: 'brokerage', mask: '4444',
        balances: { current: 5000, available: null, iso_currency_code: 'USD' }
      }],
      request_id: 'raw-request-id'
    };
  }
  async getLiabilities() {
    this.liabilitiesCalls += 1;
    return {
      accounts: [{ account_id: 'raw-credit-id-private', name: 'Synthetic Card',
        official_name: 'Synthetic Card Official', type: 'credit', subtype: 'credit card', mask: '3333',
        balances: { current: 420.25, available: 1579.75, limit: 2000, iso_currency_code: 'USD' } }],
      liabilities: { credit: [{ account_id: 'raw-credit-id-private', last_statement_balance: 400,
        last_statement_issue_date: '2026-08-01', minimum_payment_amount: 0,
        next_payment_due_date: '2026-08-28', aprs: [
          { apr_type: 'purchase_apr', apr_percentage: 19.99, balance_subject_to_apr: 300, interest_charge_amount: 4.5 },
          { apr_type: 'cash_advance_apr', apr_percentage: 29.99, balance_subject_to_apr: null, interest_charge_amount: null }
        ] }] }, request_id: 'raw-request-id-private'
    };
  }
  async getInstitution() { return { institution: { name: 'Sandbox Institution', institution_id: 'raw-institution-id' } }; }
  async removeItem(token) {
    this.removedTokens.push(token);
    if (this.removeMode === 'transient') {
      const error = new Error('temporary'); error.errorCode = 'INSTITUTION_DOWN'; error.transient = true; throw error;
    }
    return { removed: true };
  }
}
