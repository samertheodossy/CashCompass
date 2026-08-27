import { Firestore, FieldValue } from '@google-cloud/firestore';
import { KeyManagementServiceClient } from '@google-cloud/kms';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { sha256 } from './crypto.js';
import { fail } from './errors.js';

export class SecretCredentials {
  constructor({ projectId, clientIdSecret, plaidSecret, identityHmacSecret, client = new SecretManagerServiceClient() }) {
    this.projectId = projectId;
    this.names = { clientIdSecret, plaidSecret, identityHmacSecret };
    this.client = client;
    this.cache = null;
  }

  resource(name) {
    return String(name).includes('/secrets/') ? `${name}/versions/latest` :
      `projects/${this.projectId}/secrets/${name}/versions/latest`;
  }

  async read(name) {
    const [version] = await this.client.accessSecretVersion({ name: this.resource(name) });
    const value = version.payload?.data?.toString('utf8');
    if (!value) throw new Error('Required secret is unavailable.');
    return value;
  }

  async load() {
    if (!this.cache) {
      this.cache = Promise.all([
        this.read(this.names.clientIdSecret),
        this.read(this.names.plaidSecret),
        this.read(this.names.identityHmacSecret)
      ]).then(([clientId, secret, identityHmac]) => Object.freeze({ clientId, secret, identityHmac }));
    }
    return this.cache;
  }

  async getPlaidCredentials() {
    const { clientId, secret } = await this.load();
    return { clientId, secret };
  }

  async getIdentityHmac() {
    return (await this.load()).identityHmac;
  }

  async safeStatus() {
    const loaded = await this.load();
    return { clientIdReadable: !!loaded.clientId, providerSecretReadable: !!loaded.secret };
  }
}

export class KmsCipher {
  constructor({ keyName, client = new KeyManagementServiceClient() }) {
    this.keyName = keyName;
    this.client = client;
  }

  async encrypt(plaintext) {
    const [result] = await this.client.encrypt({ name: this.keyName, plaintext: Buffer.from(plaintext) });
    return { ciphertext: Buffer.from(result.ciphertext).toString('base64'), keyName: this.keyName };
  }

  async decrypt(ciphertext) {
    const [result] = await this.client.decrypt({
      name: this.keyName,
      ciphertext: Buffer.from(ciphertext, 'base64')
    });
    return Buffer.from(result.plaintext);
  }
}

export class FirestoreConnectionStore {
  constructor({ projectId, databaseId, environment, firestore }) {
    this.environment = environment;
    this.db = firestore || new Firestore({ projectId, databaseId });
  }

  user(userKey) {
    return this.db.collection('environments').doc(this.environment).collection('users').doc(userKey);
  }

  environmentRoot() {
    return this.db.collection('environments').doc(this.environment);
  }

  identityAlias(actorKey) {
    return this.environmentRoot().collection('identityAliases').doc(actorKey);
  }

  mappingId(connectionKey, accountKey) {
    return sha256(`${connectionKey}|${accountKey}`);
  }

  mapping(userKey, connectionKey, accountKey) {
    return this.user(userKey).collection('accountMappings')
      .doc(this.mappingId(connectionKey, accountKey));
  }

  publicMapping(snapshot) {
    const value = snapshot.data();
    return {
      protectedConnectionKey: value.protectedConnectionKey,
      protectedAccountKey: value.protectedAccountKey,
      stableAccountId: value.stableAccountId || '',
      status: value.status,
      revision: Number(value.revision || 0),
      updatedAt: value.updatedAt?.toDate ? value.updatedAt.toDate().toISOString() : ''
    };
  }

  async resolveIdentityAlias(actorKey) {
    const snapshot = await this.identityAlias(actorKey).get();
    if (!snapshot.exists) return actorKey;
    const canonicalUserKey = String(snapshot.data().canonicalUserKey || '');
    if (!/^[A-Za-z0-9_-]{20,128}$/.test(canonicalUserKey)) {
      fail(409, 'IDENTITY_ALIAS_INVALID', 'Shared user identity alias is invalid.');
    }
    return canonicalUserKey;
  }

  async listMappings(userKey) {
    const snapshot = await this.user(userKey).collection('accountMappings').get();
    return snapshot.docs.map(doc => this.publicMapping(doc));
  }

  async saveMapping(userKey, mapping, nowMs = Date.now()) {
    const connectionRef = this.user(userKey).collection('connections')
      .doc(mapping.protectedConnectionKey);
    const accountRef = connectionRef.collection('accounts').doc(mapping.protectedAccountKey);
    const mappingRef = this.mapping(userKey, mapping.protectedConnectionKey,
      mapping.protectedAccountKey);
    let result;
    await this.db.runTransaction(async tx => {
      const [connection, account, existing] = await tx.getAll(connectionRef, accountRef, mappingRef);
      if (!connection.exists || !account.exists) {
        fail(404, 'MAPPING_ACCOUNT_NOT_FOUND', 'Connected account was not found.');
      }
      if (!['ACTIVE', 'REAUTH_REQUIRED'].includes(connection.data().lifecycleStatus) ||
          !['ACTIVE', 'REAUTH_REQUIRED'].includes(account.data().lifecycleStatus || connection.data().lifecycleStatus)) {
        fail(409, 'MAPPING_ACCOUNT_INACTIVE', 'Connected account is not active.');
      }
      const currentRevision = existing.exists ? Number(existing.data().revision || 0) : 0;
      if (mapping.expectedRevision !== null && mapping.expectedRevision !== currentRevision) {
        fail(409, 'MAPPING_REVISION_CONFLICT', 'Mapping changed since it was reviewed.');
      }
      const nextRevision = currentRevision + 1;
      const value = {
        schemaVersion: 1,
        protectedConnectionKey: mapping.protectedConnectionKey,
        protectedAccountKey: mapping.protectedAccountKey,
        stableAccountId: mapping.stableAccountId,
        status: mapping.status,
        revision: nextRevision,
        createdAt: existing.exists ? existing.data().createdAt : new Date(nowMs),
        updatedAt: new Date(nowMs)
      };
      tx.set(mappingRef, value);
      result = { ...value, updatedAt: new Date(nowMs).toISOString() };
    });
    delete result.createdAt;
    return result;
  }

  async invalidateMapping(userKey, input, nowMs = Date.now()) {
    const ref = this.mapping(userKey, input.protectedConnectionKey, input.protectedAccountKey);
    let result;
    await this.db.runTransaction(async tx => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists) fail(404, 'MAPPING_NOT_FOUND', 'Mapping was not found.');
      const currentRevision = Number(snapshot.data().revision || 0);
      if (input.expectedRevision !== null && input.expectedRevision !== currentRevision) {
        fail(409, 'MAPPING_REVISION_CONFLICT', 'Mapping changed since it was reviewed.');
      }
      const nextRevision = currentRevision + 1;
      tx.update(ref, { status: 'INVALIDATED', stableAccountId: '', revision: nextRevision,
        updatedAt: new Date(nowMs) });
      result = {
        protectedConnectionKey: input.protectedConnectionKey,
        protectedAccountKey: input.protectedAccountKey,
        stableAccountId: '', status: 'INVALIDATED', revision: nextRevision,
        updatedAt: new Date(nowMs).toISOString()
      };
    });
    return result;
  }

  async resolveMapping(userKey, input) {
    const snapshot = await this.mapping(userKey, input.protectedConnectionKey,
      input.protectedAccountKey).get();
    if (!snapshot.exists || snapshot.data().status !== 'CONFIRMED' ||
        !snapshot.data().stableAccountId) {
      fail(404, 'MAPPING_NOT_RESOLVED', 'No active canonical mapping exists.');
    }
    return this.publicMapping(snapshot);
  }

  async migrateMappings({ actorKey, legacyUserKey, userEmail, sourceDigest, mappings }, nowMs = Date.now()) {
    const aliasRef = this.identityAlias(actorKey);
    const markerRef = this.user(legacyUserKey).collection('migrations').doc('sharedMappingAuthorityV1');
    const mappingRefs = mappings.map(value => this.mapping(legacyUserKey,
      value.protectedConnectionKey, value.protectedAccountKey));
    const ownershipRefs = mappings.flatMap(value => {
      const connection = this.user(legacyUserKey).collection('connections')
        .doc(value.protectedConnectionKey);
      return [connection, connection.collection('accounts').doc(value.protectedAccountKey)];
    });
    let result;
    await this.db.runTransaction(async tx => {
      const [alias, marker, ...snapshots] = await tx.getAll(aliasRef, markerRef,
        ...ownershipRefs, ...mappingRefs);
      if (alias.exists && alias.data().canonicalUserKey !== legacyUserKey) {
        fail(409, 'IDENTITY_ALIAS_CONFLICT', 'Shared user identity is already bound elsewhere.');
      }
      if (marker.exists) {
        if (marker.data().sourceDigest !== sourceDigest ||
            marker.data().actorKey !== actorKey || marker.data().legacyUserKey !== legacyUserKey) {
          fail(409, 'MAPPING_MIGRATION_CONFLICT', 'Prior migration does not match this source.');
        }
        result = { migrated: false, idempotent: true };
        return;
      }
      const ownership = snapshots.slice(0, ownershipRefs.length);
      const existingMappings = snapshots.slice(ownershipRefs.length);
      for (let index = 0; index < mappings.length; index += 1) {
        const connection = ownership[index * 2];
        const account = ownership[index * 2 + 1];
        if (!connection.exists || !account.exists) {
          fail(404, 'MAPPING_ACCOUNT_NOT_FOUND', 'Migration source account was not found.');
        }
        if (!['ACTIVE', 'REAUTH_REQUIRED'].includes(connection.data().lifecycleStatus) ||
            !['ACTIVE', 'REAUTH_REQUIRED'].includes(account.data().lifecycleStatus || connection.data().lifecycleStatus)) {
          fail(409, 'MAPPING_ACCOUNT_INACTIVE', 'Migration source account is not active.');
        }
        const existing = existingMappings[index];
        if (existing.exists) {
          const value = existing.data();
          if (value.status !== mappings[index].status ||
              String(value.stableAccountId || '') !== mappings[index].stableAccountId) {
            fail(409, 'MAPPING_MIGRATION_CONFLICT', 'Existing backend mapping conflicts with source.');
          }
        }
      }
      tx.set(aliasRef, {
        schemaVersion: 1, actorKey, canonicalUserKey: legacyUserKey,
        normalizedUserEmail: userEmail, createdAt: new Date(nowMs), updatedAt: new Date(nowMs)
      });
      mappings.forEach((mapping, index) => {
        if (existingMappings[index].exists) return;
        tx.create(mappingRefs[index], {
          schemaVersion: 1,
          protectedConnectionKey: mapping.protectedConnectionKey,
          protectedAccountKey: mapping.protectedAccountKey,
          stableAccountId: mapping.stableAccountId,
          status: mapping.status,
          revision: 1,
          createdAt: new Date(nowMs),
          updatedAt: new Date(nowMs)
        });
      });
      tx.create(markerRef, {
        schemaVersion: 1, actorKey, legacyUserKey, sourceDigest,
        mappingCount: mappings.length, migratedAt: new Date(nowMs)
      });
      result = { migrated: true, idempotent: false };
    });
    return result;
  }

  async consumeNonce(userKey, nonce, expiresAtSeconds, nowMs = Date.now()) {
    const ref = this.user(userKey).collection('requestNonces').doc(sha256(nonce));
    await this.db.runTransaction(async tx => {
      const existing = await tx.get(ref);
      if (existing.exists) fail(409, 'AUTH_REPLAY', 'Assertion was already used.');
      tx.create(ref, {
        createdAt: new Date(nowMs),
        expiresAt: new Date(expiresAtSeconds * 1000)
      });
    });
  }

  async createLinkSession(userKey, session, nowMs = Date.now()) {
    const userRef = this.user(userKey);
    const lockRef = userRef.collection('connectionIntents').doc('current');
    const sessionRef = userRef.collection('linkSessions').doc(session.correlationId);
    await this.db.runTransaction(async tx => {
      const lock = await tx.get(lockRef);
      if (lock.exists && Number(lock.data().expiresAtMs || 0) > nowMs) {
        fail(409, 'CONNECT_IN_PROGRESS', 'A connection is already in progress.');
      }
      tx.set(lockRef, { correlationId: session.correlationId, expiresAtMs: session.expiresAtMs });
      tx.create(sessionRef, {
        status: 'PENDING',
        environment: this.environment,
        mode: session.mode,
        connectionKey: session.connectionKey || '',
        products: session.products || [],
        additionalConsentedProducts: session.additionalConsentedProducts || [],
        createdAt: new Date(nowMs),
        expiresAt: new Date(session.expiresAtMs)
      });
    });
  }

  async consumeLinkSession(userKey, correlationId, nowMs = Date.now(), expected = null) {
    const userRef = this.user(userKey);
    const ref = userRef.collection('linkSessions').doc(correlationId);
    const lockRef = userRef.collection('connectionIntents').doc('current');
    let completionReviewRequired = false;
    await this.db.runTransaction(async tx => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists) fail(404, 'LINK_SESSION_NOT_FOUND', 'Link session was not found.');
      const value = snapshot.data();
      const expiry = value.expiresAt?.toMillis ? value.expiresAt.toMillis() : Number(value.expiresAtMs || 0);
      if (value.status !== 'PENDING') fail(409, 'LINK_SESSION_REPLAY', 'Link session was already consumed.');
      if (!expiry || expiry <= nowMs) {
        if (expected?.mode === 'CREATE' && value.mode === 'CREATE') {
          completionReviewRequired = true;
          tx.update(ref, { status: 'COMPLETION_REVIEW_REQUIRED', updatedAt: new Date(nowMs) });
          tx.delete(lockRef);
          return;
        }
        fail(410, 'LINK_SESSION_EXPIRED', 'Link session expired.');
      }
      if (expected && (value.mode !== expected.mode || value.connectionKey !== expected.connectionKey)) {
        fail(409, 'LINK_SESSION_MISMATCH', 'Link session does not match the requested operation.');
      }
      tx.update(ref, { status: 'EXCHANGING', consumedAt: new Date(nowMs) });
      tx.delete(lockRef);
    });
    if (completionReviewRequired) {
      fail(409, 'LINK_COMPLETION_REVIEW_REQUIRED', 'Link completion requires review before retry.');
    }
  }

  async assertNoReusableConnection(userKey) {
    const snapshot = await this.user(userKey).collection('connections')
      .where('lifecycleStatus', 'in', ['ACTIVE', 'REAUTH_REQUIRED', 'DISCONNECTING',
        'DISCONNECT_PENDING']).limit(1).get();
    if (!snapshot.empty) {
      fail(409, 'REUSABLE_CONNECTION_EXISTS', 'Use the existing connection or update mode.');
    }
  }

  async assertNoReusableInstitution(userKey, protectedInstitutionKey) {
    const snapshot = await this.user(userKey).collection('connections')
      .where('protectedInstitutionKey', '==', protectedInstitutionKey).limit(10).get();
    const reusable = snapshot.docs.some(doc => ['ACTIVE', 'REAUTH_REQUIRED', 'DISCONNECTING',
      'DISCONNECT_PENDING'].includes(doc.data().lifecycleStatus));
    if (reusable) {
      fail(409, 'REUSABLE_INSTITUTION_EXISTS', 'Use the existing institution connection or update mode.');
    }
  }

  async assertNoUnresolvedLinkCompletion(userKey) {
    const snapshot = await this.user(userKey).collection('linkSessions')
      .where('status', 'in', ['EXCHANGING', 'COMPLETION_REVIEW_REQUIRED']).limit(1).get();
    if (!snapshot.empty) {
      fail(409, 'LINK_COMPLETION_REVIEW_REQUIRED', 'Resolve the prior Link completion before retry.');
    }
  }

  async getReusableConnection(userKey, connectionKey) {
    const snapshot = await this.user(userKey).collection('connections').doc(connectionKey).get();
    if (!snapshot.exists) fail(404, 'CONNECTION_NOT_FOUND', 'Connection was not found.');
    const value = snapshot.data();
    if (!['ACTIVE', 'REAUTH_REQUIRED'].includes(value.lifecycleStatus) || !value.credentialCiphertext) {
      fail(409, 'CONNECTION_NOT_REUSABLE', 'Connection cannot be refreshed or updated.');
    }
    return value;
  }

  async markLinkSession(userKey, correlationId, status, nowMs = Date.now()) {
    await this.user(userKey).collection('linkSessions').doc(correlationId)
      .set({ status, updatedAt: new Date(nowMs) }, { merge: true });
  }

  async createConnection(userKey, connection, accounts, nowMs = Date.now()) {
    const ref = this.user(userKey).collection('connections').doc(connection.connectionKey);
    await this.db.runTransaction(async tx => {
      const existing = await tx.get(ref);
      if (existing.exists && existing.data().lifecycleStatus !== 'DISCONNECTED') {
        fail(409, 'DUPLICATE_CONNECTION', 'Connection already exists.');
      }
      tx.set(ref, {
        schemaVersion: 1,
        environment: this.environment,
        provider: 'PLAID',
        providerProfile: connection.providerProfile,
        protectedInstitutionKey: connection.protectedInstitutionKey,
        protectedItemKey: connection.protectedItemKey,
        credentialCiphertext: connection.credentialCiphertext,
        kmsKeyName: connection.kmsKeyName,
        institutionName: connection.institutionName,
        products: connection.products || [],
        additionalConsentedProducts: connection.additionalConsentedProducts || [],
        lifecycleStatus: 'ACTIVE',
        createdAt: new Date(nowMs),
        updatedAt: new Date(nowMs)
      });
      for (const account of accounts) {
        tx.set(ref.collection('accounts').doc(account.protectedAccountKey), {
          schemaVersion: 1,
          protectedAccountKey: account.protectedAccountKey,
          displayName: account.displayName,
          officialName: account.officialName,
          type: account.type,
          subtype: account.subtype,
          mask: account.mask,
          lifecycleStatus: 'ACTIVE',
          createdAt: new Date(nowMs),
          updatedAt: new Date(nowMs)
        });
      }
    });
  }

  async listConnections(userKey) {
    const snapshots = await this.user(userKey).collection('connections').get();
    const result = [];
    for (const doc of snapshots.docs) {
      const value = doc.data();
      const accountDocs = await doc.ref.collection('accounts').get();
      result.push({
        connectionKey: doc.id,
        institutionName: value.institutionName || '',
        lifecycleStatus: value.lifecycleStatus,
        lastObservedAt: value.lastObservedAt?.toDate
          ? value.lastObservedAt.toDate().toISOString() : '',
        accounts: accountDocs.docs.map(account => account.data())
      });
    }
    return result;
  }

  async completeReconnect(userKey, connectionKey, nowMs = Date.now()) {
    const ref = this.user(userKey).collection('connections').doc(connectionKey);
    await this.db.runTransaction(async tx => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists) fail(404, 'CONNECTION_NOT_FOUND', 'Connection was not found.');
      const value = snapshot.data();
      if (!['ACTIVE', 'REAUTH_REQUIRED'].includes(value.lifecycleStatus) || !value.credentialCiphertext) {
        fail(409, 'CONNECTION_NOT_REUSABLE', 'Connection cannot complete update mode.');
      }
      tx.update(ref, { lifecycleStatus: 'ACTIVE', reconnectReasonCode: FieldValue.delete(),
        updatedAt: new Date(nowMs) });
    });
  }

  async recordObservation(userKey, connectionKey, observedAt, nowMs = Date.now()) {
    await this.user(userKey).collection('connections').doc(connectionKey).update({
      lastObservedAt: new Date(observedAt), updatedAt: new Date(nowMs)
    });
  }

  async markReauthRequired(userKey, connectionKey, reasonCode, nowMs = Date.now()) {
    await this.user(userKey).collection('connections').doc(connectionKey).update({
      lifecycleStatus: 'REAUTH_REQUIRED', reconnectReasonCode: reasonCode,
      updatedAt: new Date(nowMs)
    });
  }

  async beginDisconnect(userKey, connectionKey, nowMs = Date.now()) {
    const ref = this.user(userKey).collection('connections').doc(connectionKey);
    let result;
    await this.db.runTransaction(async tx => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists) fail(404, 'CONNECTION_NOT_FOUND', 'Connection was not found.');
      const value = snapshot.data();
      if (value.lifecycleStatus === 'DISCONNECTED') {
        result = { alreadyDisconnected: true };
        return;
      }
      if (value.lifecycleStatus === 'DISCONNECTING') fail(409, 'DISCONNECT_IN_PROGRESS', 'Disconnect is in progress.');
      if (!value.credentialCiphertext) fail(409, 'CREDENTIAL_UNAVAILABLE', 'Credential is unavailable.');
      tx.update(ref, { lifecycleStatus: 'DISCONNECTING', updatedAt: new Date(nowMs) });
      result = { alreadyDisconnected: false, credentialCiphertext: value.credentialCiphertext };
    });
    return result;
  }

  async completeDisconnect(userKey, connectionKey, nowMs = Date.now()) {
    const ref = this.user(userKey).collection('connections').doc(connectionKey);
    const accounts = await ref.collection('accounts').get();
    const batch = this.db.batch();
    batch.update(ref, {
      lifecycleStatus: 'DISCONNECTED',
      credentialCiphertext: FieldValue.delete(),
      disconnectedAt: new Date(nowMs),
      updatedAt: new Date(nowMs)
    });
    for (const account of accounts.docs) {
      batch.update(account.ref, { lifecycleStatus: 'DISCONNECTED', updatedAt: new Date(nowMs) });
    }
    await batch.commit();
  }

  async markDisconnectPending(userKey, connectionKey, reasonCode, nowMs = Date.now()) {
    await this.user(userKey).collection('connections').doc(connectionKey).update({
      lifecycleStatus: 'DISCONNECT_PENDING',
      disconnectReasonCode: reasonCode,
      updatedAt: new Date(nowMs)
    });
  }
}
