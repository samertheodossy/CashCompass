import { decodeCredentialBlob, encodeCredentialBlob, protectedKey, sha256 } from './crypto.js';
import { fail } from './errors.js';
import { PlaidError, asProviderServiceError } from './plaid.js';
import { buildReadOnlyPreview, normalizePlaidMixedAccounts } from './liabilities_adapter.js';

function requiredString(value, name, maxLength = 512) {
  const text = String(value || '').trim();
  if (!text || text.length > maxLength) fail(400, 'INVALID_REQUEST', `${name} is invalid.`);
  return text;
}

function safeText(value, maxLength) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

const LINK_SESSION_MAX_LIFETIME_MS = Object.freeze({
  CREATE: 4 * 60 * 60 * 1000,
  UPDATE: 30 * 60 * 1000
});

/** Shorter than link-session lifetime so abandoned Connect retries recover without bypassing concurrency. */
const CONNECTION_INTENT_LOCK_LIFETIME_MS = Object.freeze({
  CREATE: 30 * 60 * 1000,
  UPDATE: 30 * 60 * 1000
});

const SOLE_ADMIN_EMAIL = 'samertheodossy@gmail.com';
const MAPPING_STATUSES = new Set(['CONFIRMED', 'IGNORED']);

function protectedIdentity(value, name) {
  const text = requiredString(value, name, 64).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(text)) fail(400, 'INVALID_REQUEST', `${name} is invalid.`);
  return text;
}

function stableAccountId(value) {
  const text = requiredString(value, 'canonical account identity', 160);
  if (!/^[A-Za-z0-9][A-Za-z0-9:_-]{0,159}$/.test(text)) {
    fail(400, 'INVALID_REQUEST', 'Canonical account identity is invalid.');
  }
  return text;
}

function mappingStatus(value) {
  const text = requiredString(value, 'mapping status', 20).toUpperCase();
  if (!MAPPING_STATUSES.has(text)) fail(400, 'INVALID_REQUEST', 'Mapping status is invalid.');
  return text;
}

function linkSessionExpiry(response, mode, nowMs) {
  const providerExpiry = Date.parse(response?.expiration || '');
  const maxLifetime = LINK_SESSION_MAX_LIFETIME_MS[mode];
  if (!Number.isFinite(providerExpiry) || providerExpiry <= nowMs || !maxLifetime) {
    fail(502, 'PROVIDER_RESPONSE_INVALID', 'Provider Link expiration is invalid.');
  }
  return Math.min(providerExpiry, nowMs + maxLifetime);
}

function connectionIntentLockExpiry(sessionExpiresAtMs, mode, nowMs) {
  const maxLockLifetime = CONNECTION_INTENT_LOCK_LIFETIME_MS[mode];
  if (!maxLockLifetime) fail(500, 'INTERNAL_ERROR', 'Connection lock lifetime is unavailable.');
  return Math.min(sessionExpiresAtMs, nowMs + maxLockLifetime);
}

function sanitizedAccount(account, identitySecret, config) {
  const rawId = requiredString(account.account_id, 'account identity', 256);
  return {
    protectedAccountKey: protectedKey(identitySecret, config.environment, `${config.providerProfile}|ACCOUNT`, rawId),
    displayName: safeText(account.name, 120),
    officialName: safeText(account.official_name, 160),
    type: safeText(account.type, 40),
    subtype: safeText(account.subtype, 60),
    mask: safeText(account.mask, 8)
  };
}

function publicConnection(connection) {
  return {
    environment: connection.environment,
    protectedConnectionKey: connection.connectionKey,
    institutionName: connection.institutionName || '',
    lifecycleStatus: connection.lifecycleStatus,
    lastObservedAt: connection.lastObservedAt || '',
    accounts: (connection.accounts || []).map(account => ({
      protectedAccountKey: account.protectedAccountKey,
      displayName: account.displayName || '',
      officialName: account.officialName || '',
      type: account.type || '',
      subtype: account.subtype || '',
      mask: account.mask || '',
      lifecycleStatus: account.lifecycleStatus || connection.lifecycleStatus
    }))
  };
}

function accountNeedsLiabilitiesFetch_(account) {
  const type = String(account?.type || '').toLowerCase();
  const subtype = String(account?.subtype || '').toLowerCase();
  return type === 'credit' && subtype === 'credit card';
}

function previewNeedsLiabilities_(storedAccounts, targetAccountKey, liveAccounts) {
  const liveHasCredit = (liveAccounts || []).some(account =>
    String(account?.type || '').toLowerCase() === 'credit' &&
    String(account?.subtype || '').toLowerCase() === 'credit card');
  if (!liveHasCredit) return false;
  const scopedKey = String(targetAccountKey || '').trim();
  if (!scopedKey) return true;
  const target = (storedAccounts || []).find(account =>
    String(account?.protectedAccountKey || '') === scopedKey);
  if (!target) return true;
  return accountNeedsLiabilitiesFetch_(target);
}

export class PlaidConnectionService {
  constructor({ config, store, cipher, credentials, plaid, randomId, now = () => Date.now() }) {
    this.config = config;
    this.store = store;
    this.cipher = cipher;
    this.credentials = credentials;
    this.plaid = plaid;
    this.randomId = randomId;
    this.now = now;
  }

  async resolveRequestIdentity(auth) {
    if (!auth?.userEmail) {
      return { userKey: auth.userKey, actorKey: auth.userKey, userEmail: '', legacyUserKey: auth.userKey };
    }
    const identitySecret = await this.credentials.getIdentityHmac();
    const actorKey = protectedKey(identitySecret, this.config.environment,
      'CASHCOMPASS_USER', auth.userEmail);
    const userKey = await this.store.resolveIdentityAlias(actorKey);
    return {
      userKey,
      actorKey,
      userEmail: auth.userEmail,
      legacyUserKey: auth.legacyUserKey || auth.userKey
    };
  }

  requireSharedIdentity(identity) {
    if (!identity?.userEmail || !identity?.actorKey) {
      fail(401, 'AUTH_USER_REQUIRED', 'Shared mapping operations require authenticated user identity.');
    }
  }

  normalizeMapping(input) {
    const status = mappingStatus(input?.status);
    return {
      protectedConnectionKey: protectedIdentity(input?.protectedConnectionKey, 'connection key'),
      protectedAccountKey: protectedIdentity(input?.protectedAccountKey, 'account key'),
      stableAccountId: status === 'CONFIRMED' ? stableAccountId(input?.stableAccountId) : '',
      status,
      expectedRevision: Number.isInteger(input?.expectedRevision) && input.expectedRevision >= 0
        ? input.expectedRevision : null
    };
  }

  async listMappings(userKey, _input, identity) {
    this.requireSharedIdentity(identity);
    const mappings = await this.store.listMappings(userKey);
    return { ok: true, environment: this.config.environment, mappings };
  }

  async saveMapping(userKey, input, identity) {
    this.requireSharedIdentity(identity);
    const mapping = this.normalizeMapping(input);
    const saved = await this.store.saveMapping(userKey, mapping, this.now());
    return { ok: true, environment: this.config.environment, mapping: saved };
  }

  async invalidateMapping(userKey, input, identity) {
    this.requireSharedIdentity(identity);
    const protectedConnectionKey = protectedIdentity(input?.protectedConnectionKey, 'connection key');
    const protectedAccountKey = protectedIdentity(input?.protectedAccountKey, 'account key');
    const expectedRevision = Number.isInteger(input?.expectedRevision) && input.expectedRevision >= 0
      ? input.expectedRevision : null;
    const mapping = await this.store.invalidateMapping(userKey, {
      protectedConnectionKey, protectedAccountKey, expectedRevision
    }, this.now());
    return { ok: true, environment: this.config.environment, mapping };
  }

  async resolveMapping(userKey, input, identity) {
    this.requireSharedIdentity(identity);
    const protectedConnectionKey = protectedIdentity(input?.protectedConnectionKey, 'connection key');
    const protectedAccountKey = protectedIdentity(input?.protectedAccountKey, 'account key');
    const mapping = await this.store.resolveMapping(userKey, {
      protectedConnectionKey, protectedAccountKey
    });
    return { ok: true, environment: this.config.environment, mapping };
  }

  async migrateMappings(_userKey, input, identity) {
    this.requireSharedIdentity(identity);
    if (this.config.environment !== 'TRIAL' || identity.userEmail !== SOLE_ADMIN_EMAIL) {
      fail(403, 'MIGRATION_FORBIDDEN', 'Mapping migration is restricted to the sole Trial administrator.');
    }
    const legacyUserKey = requiredString(input?.legacyUserKey, 'legacy user identity', 128);
    if (!/^[A-Za-z0-9_-]{20,128}$/.test(legacyUserKey)) {
      fail(400, 'INVALID_REQUEST', 'Legacy user identity is invalid.');
    }
    const source = Array.isArray(input?.mappings) ? input.mappings : [];
    if (source.length > 500) fail(400, 'INVALID_REQUEST', 'Too many mappings.');
    const mappings = source.map(value => this.normalizeMapping(value));
    const unique = new Set(mappings.map(value =>
      `${value.protectedConnectionKey}|${value.protectedAccountKey}`));
    if (unique.size !== mappings.length) fail(409, 'MAPPING_MIGRATION_CONFLICT', 'Duplicate source mapping.');
    const sourceDigest = sha256(JSON.stringify(mappings.map(value => ({
      protectedConnectionKey: value.protectedConnectionKey,
      protectedAccountKey: value.protectedAccountKey,
      stableAccountId: value.stableAccountId,
      status: value.status
    })).sort((a, b) => `${a.protectedConnectionKey}|${a.protectedAccountKey}`
      .localeCompare(`${b.protectedConnectionKey}|${b.protectedAccountKey}`))));
    const result = await this.store.migrateMappings({
      actorKey: identity.actorKey,
      legacyUserKey,
      userEmail: identity.userEmail,
      sourceDigest,
      mappings
    }, this.now());
    return { ok: true, environment: this.config.environment, migrated: result.migrated,
      idempotent: result.idempotent, mappingCount: mappings.length };
  }

  async createLinkToken(userKey) {
    const correlationId = this.randomId();
    await this.store.assertNoUnresolvedLinkCompletion(userKey);
    let response;
    try {
      response = await this.plaid.createLinkToken({ userKey, correlationId });
    } catch (error) {
      throw asProviderServiceError(error);
    }
    const linkToken = requiredString(response.link_token, 'link token', 4096);
    const nowMs = this.now();
    const expiresAtMs = linkSessionExpiry(response, 'CREATE', nowMs);
    const lockExpiresAtMs = connectionIntentLockExpiry(expiresAtMs, 'CREATE', nowMs);
    await this.store.createLinkSession(userKey, { correlationId, expiresAtMs, lockExpiresAtMs, mode: 'CREATE',
      products: ['assets'], additionalConsentedProducts: ['liabilities'] }, nowMs);
    return {
      ok: true,
      environment: this.config.environment,
      linkToken,
      correlationId,
      expiresAt: new Date(expiresAtMs).toISOString()
    };
  }

  async createUpdateLinkToken(userKey, input) {
    const connectionKey = requiredString(input?.protectedConnectionKey, 'connection key', 128);
    if (!/^[a-f0-9]{64}$/.test(connectionKey)) fail(400, 'INVALID_REQUEST', 'Connection key is invalid.');
    const state = await this.store.getReusableConnection(userKey, connectionKey);
    const credential = decodeCredentialBlob(await this.cipher.decrypt(state.credentialCiphertext));
    const correlationId = this.randomId();
    let response;
    try {
      response = await this.plaid.createUpdateLinkToken({ userKey, accessToken: credential.accessToken, correlationId });
    } catch (error) {
      throw asProviderServiceError(error);
    }
    const linkToken = requiredString(response.link_token, 'link token', 4096);
    const nowMs = this.now();
    const expiresAtMs = linkSessionExpiry(response, 'UPDATE', nowMs);
    const lockExpiresAtMs = connectionIntentLockExpiry(expiresAtMs, 'UPDATE', nowMs);
    await this.store.createLinkSession(userKey, { correlationId, expiresAtMs, lockExpiresAtMs,
      mode: 'UPDATE', connectionKey }, nowMs);
    return { ok: true, environment: this.config.environment,
      linkToken, correlationId,
      protectedConnectionKey: connectionKey, expiresAt: new Date(expiresAtMs).toISOString() };
  }

  async abandonLinkSession(userKey, input) {
    const correlationId = requiredString(input?.correlationId, 'correlation ID', 128);
    await this.store.abandonLinkSession(userKey, correlationId, this.now());
    return { ok: true, environment: this.config.environment };
  }

  async completeUpdate(userKey, input) {
    const correlationId = requiredString(input?.correlationId, 'correlation ID', 128);
    const connectionKey = requiredString(input?.protectedConnectionKey, 'connection key', 128);
    await this.store.consumeLinkSession(userKey, correlationId, this.now(), { mode: 'UPDATE', connectionKey });
    await this.store.completeReconnect(userKey, connectionKey, this.now());
    await this.store.markLinkSession(userKey, correlationId, 'COMPLETED', this.now());
    return { ok: true, environment: this.config.environment,
      protectedConnectionKey: connectionKey, lifecycleStatus: 'ACTIVE' };
  }

  async exchange(userKey, input) {
    const correlationId = requiredString(input?.correlationId, 'correlation ID', 128);
    const publicToken = requiredString(input?.publicToken, 'public token', 4096);
    const linkInstitutionId = requiredString(input?.institutionId, 'institution identity', 256);
    await this.store.consumeLinkSession(userKey, correlationId, this.now(), {
      mode: 'CREATE', connectionKey: ''
    });
    let accessToken = '';
    let connectionPersisted = false;
    try {
      const identitySecret = await this.credentials.getIdentityHmac();
      const claimedInstitutionKey = protectedKey(identitySecret, this.config.environment,
        `${this.config.providerProfile}|INSTITUTION`, linkInstitutionId);
      // Plaid supplies institutionId in Link onSuccess metadata. The browser
      // forwards it only for a pre-exchange duplicate check; discovery below
      // must prove the same institution before anything is persisted.
      await this.store.assertNoReusableInstitution(userKey, claimedInstitutionKey);
      const exchange = await this.plaid.exchangePublicToken(publicToken);
      accessToken = requiredString(exchange.access_token, 'provider credential', 4096);
      const itemId = requiredString(exchange.item_id, 'provider item identity', 512);
      const discovery = await this.plaid.getAccounts(accessToken);
      const protectedItemKey = protectedKey(
        identitySecret,
        this.config.environment,
        `${this.config.providerProfile}|ITEM`,
        itemId
      );
      const institutionId = safeText(discovery.item?.institution_id, 256);
      const protectedInstitutionKey = institutionId ? protectedKey(identitySecret,
        this.config.environment, `${this.config.providerProfile}|INSTITUTION`, institutionId) : '';
      if (!protectedInstitutionKey || protectedInstitutionKey !== claimedInstitutionKey) {
        fail(409, 'LINK_INSTITUTION_MISMATCH', 'Link institution did not match provider discovery.');
      }
      let institutionName = '';
      if (institutionId) {
        const institution = await this.plaid.getInstitution(institutionId);
        institutionName = safeText(institution?.institution?.name, 120);
      }
      const sourceAccounts = Array.isArray(discovery.accounts) ? discovery.accounts : [];
      const accounts = sourceAccounts.map(account => sanitizedAccount(account, identitySecret, this.config));
      const rawAccountIds = {};
      for (let i = 0; i < accounts.length; i += 1) {
        rawAccountIds[accounts[i].protectedAccountKey] = requiredString(sourceAccounts[i].account_id, 'account identity', 256);
      }
      const encrypted = await this.cipher.encrypt(encodeCredentialBlob({ accessToken, itemId, rawAccountIds }));
      const connection = {
        connectionKey: protectedItemKey,
        protectedItemKey,
        providerProfile: this.config.providerProfile,
        environment: this.config.environment,
        protectedInstitutionKey,
        institutionName,
        products: ['assets'],
        additionalConsentedProducts: ['liabilities'],
        credentialCiphertext: encrypted.ciphertext,
        kmsKeyName: encrypted.keyName
      };
      try {
        await this.store.createConnection(userKey, connection, accounts, this.now());
        connectionPersisted = true;
      } catch (error) {
        throw error;
      }
      try {
        await this.store.markLinkSession(userKey, correlationId, 'COMPLETED', this.now());
      } catch (_sessionError) {
        // The encrypted connection is already durable. Do not revoke a valid
        // Item or misreport exchange failure solely because session bookkeeping
        // could not be finalized; replay is still blocked by EXCHANGING state.
      }
      return publicConnection({ ...connection, lifecycleStatus: 'ACTIVE', accounts });
    } catch (error) {
      if (accessToken && !connectionPersisted) {
        try { await this.plaid.removeItem(accessToken); } catch (_removeError) {}
      }
      try { await this.store.markLinkSession(userKey, correlationId, 'FAILED', this.now()); } catch (_sessionError) {}
      throw asProviderServiceError(error);
    }
  }

  async list(userKey) {
    const connections = await this.store.listConnections(userKey);
    return { ok: true, environment: this.config.environment,
      connections: connections.map(connection => publicConnection({ ...connection, environment: this.config.environment })) };
  }

  async preview(userKey, input) {
    const connectionKey = requiredString(input?.protectedConnectionKey, 'connection key', 128);
    if (!/^[a-f0-9]{64}$/.test(connectionKey)) fail(400, 'INVALID_REQUEST', 'Connection key is invalid.');
    const targetAccountKey = String(input?.targetProtectedAccountKey || '').trim();
    const existingByAccount = input?.existingFactsByProtectedAccountKey &&
      typeof input.existingFactsByProtectedAccountKey === 'object' &&
      !Array.isArray(input.existingFactsByProtectedAccountKey)
      ? input.existingFactsByProtectedAccountKey : {};
    const state = await this.store.getReusableConnection(userKey, connectionKey);
    const storedAccounts = typeof this.store.listStoredAccounts === 'function'
      ? await this.store.listStoredAccounts(userKey, connectionKey) : [];
    const credential = decodeCredentialBlob(await this.cipher.decrypt(state.credentialCiphertext));
    const observedAt = new Date(this.now()).toISOString();
    try {
      const accountsResponse = await this.plaid.getAccounts(credential.accessToken);
      const needsLiabilities = previewNeedsLiabilities_(storedAccounts, targetAccountKey,
        accountsResponse.accounts || []);
      const liabilitiesResponse = needsLiabilities
        ? await this.plaid.getLiabilities(credential.accessToken) : null;
      const identitySecret = await this.credentials.getIdentityHmac();
      const accounts = normalizePlaidMixedAccounts({ accountsResponse, liabilitiesResponse,
        identitySecret, config: this.config, protectedKey, observedAt });
      const scopedAccounts = targetAccountKey
        ? accounts.filter(account => String(account.protectedAccountKey || '') === targetAccountKey)
        : accounts;
      const preview = scopedAccounts.flatMap(account => buildReadOnlyPreview({ accounts: [account],
        existingFacts: existingByAccount[account.protectedAccountKey] || {}, observedAt,
        environment: this.config.environment,
        comparisonExplicit: Object.hasOwn(existingByAccount, account.protectedAccountKey) }));
      await this.store.recordObservation(userKey, connectionKey, observedAt, this.now());
      const usedLiabilities = !!liabilitiesResponse;
      return { ok: true, environment: this.config.environment, readOnly: true,
        authority: 'SHADOW_ONLY', products: usedLiabilities ? ['assets', 'liabilities'] : ['assets'],
        sources: usedLiabilities ? ['accounts/get', 'liabilities/get'] : ['accounts/get'],
        observedAt, accounts: preview };
    } catch (error) {
      if (error instanceof PlaidError && ['ITEM_LOGIN_REQUIRED', 'PENDING_EXPIRATION',
        'PENDING_DISCONNECT'].includes(error.errorCode)) {
        await this.store.markReauthRequired(userKey, connectionKey, error.errorCode, this.now());
        fail(409, 'REAUTH_REQUIRED', 'Connection requires update mode.');
      }
      throw asProviderServiceError(error);
    }
  }

  async disconnect(userKey, input) {
    const connectionKey = requiredString(input?.protectedConnectionKey, 'connection key', 128);
    if (!/^[a-f0-9]{64}$/.test(connectionKey)) fail(400, 'INVALID_REQUEST', 'Connection key is invalid.');
    const state = await this.store.beginDisconnect(userKey, connectionKey, this.now());
    if (state.alreadyDisconnected) {
      return { ok: true, environment: this.config.environment, protectedConnectionKey: connectionKey, lifecycleStatus: 'DISCONNECTED', idempotent: true };
    }
    let credential;
    try {
      credential = decodeCredentialBlob(await this.cipher.decrypt(state.credentialCiphertext));
    } catch (_error) {
      await this.store.markDisconnectPending(userKey, connectionKey, 'CREDENTIAL_DECRYPT_FAILED', this.now());
      fail(503, 'DISCONNECT_PENDING', 'Credential could not be decrypted.');
    }
    try {
      await this.plaid.removeItem(credential.accessToken);
      await this.store.completeDisconnect(userKey, connectionKey, this.now());
      return { ok: true, environment: this.config.environment, protectedConnectionKey: connectionKey, lifecycleStatus: 'DISCONNECTED', idempotent: false };
    } catch (error) {
      const reason = error instanceof PlaidError ? error.errorCode : 'PROVIDER_REMOVE_FAILED';
      await this.store.markDisconnectPending(userKey, connectionKey, reason, this.now());
      fail(503, 'DISCONNECT_PENDING', 'Provider revocation is pending.');
    }
  }

  async runtimeStatus() {
    const status = await this.credentials.safeStatus();
    const marker = Buffer.from('cashcompass-runtime-kms-check-v1', 'utf8');
    const encrypted = await this.cipher.encrypt(marker);
    const decrypted = await this.cipher.decrypt(encrypted.ciphertext);
    return { ok: true, environment: this.config.environment,
      firestoreNonceConsumed: true,
      kmsEncryptDecrypt: Buffer.from(decrypted).equals(marker),
      secrets: {
      clientIdReadable: status.clientIdReadable === true,
      providerSecretReadable: status.providerSecretReadable === true || status.sandboxSecretReadable === true,
      sandboxSecretReadable: this.config.environment === 'SANDBOX'
        ? (status.providerSecretReadable === true || status.sandboxSecretReadable === true) : undefined
    } };
  }
}
