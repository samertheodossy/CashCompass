import assert from 'node:assert/strict';
import crypto, { generateKeyPairSync, sign } from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

const bridge = fs.readFileSync(new URL('../plaid_sandbox_bridge.js', import.meta.url), 'utf8');
const provisioner = fs.readFileSync(new URL('../plaid_sandbox_provisioning.js', import.meta.url), 'utf8');
const provisionUiUrl = new URL('../PlaidSandboxProvisioningUI.html', import.meta.url);
const webapp = fs.readFileSync(new URL('../webapp.js', import.meta.url), 'utf8');
const manifest = JSON.parse(fs.readFileSync(new URL('../appsscript.json', import.meta.url), 'utf8'));
const centralManifest = JSON.parse(fs.readFileSync(new URL('../appsscript.central.json', import.meta.url), 'utf8'));
const centralClasp = JSON.parse(fs.readFileSync(new URL('../.clasp-central.json', import.meta.url), 'utf8'));
const dashboardStartup = [
  'PlannerDashboardWeb.html',
  'Dashboard_Body.html',
  'Dashboard_Script_Render.html'
].map(name => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8')).join('\n');
const customerHtml = fs.readdirSync(new URL('..', import.meta.url))
  .filter(name => name.endsWith('.html'))
  .map(name => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8'))
  .join('\n');

const keyPair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const privateKey = keyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }).trim();
const nextKeyPair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const nextPrivateKey = nextKeyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }).trim();
const backendUrl = 'https://cashcompass-plaid-backend-example.us-west1.run.app';
const nextBackendUrl = 'https://cashcompass-plaid-backend-next.us-west1.run.app';

class FakeProperties {
  constructor(initial = {}, options = {}) {
    this.values = new Map(Object.entries(initial));
    this.lastDeleteAllOthers = null;
    this.lastWrittenNames = [];
    this.setPropertyNames = [];
    this.failSetProperties = options.failSetProperties === true;
  }
  getProperty(name) { return this.values.has(name) ? this.values.get(name) : null; }
  setProperty(name, value) {
    this.setPropertyNames.push(name);
    this.values.set(name, String(value));
  }
  setProperties(values, deleteAllOthers) {
    this.lastDeleteAllOthers = deleteAllOthers;
    this.lastWrittenNames = Object.keys(values);
    if (this.failSetProperties) throw new Error('synthetic write failure');
    if (deleteAllOthers === true) this.values.clear();
    for (const [name, value] of Object.entries(values)) this.values.set(name, String(value));
  }
}

function utilities() {
  return {
    base64Decode(value) { return [...Buffer.from(String(value), 'base64')]; },
    computeRsaSha256Signature(value, pem) {
      return [...sign('RSA-SHA256', Buffer.from(String(value), 'utf8'), pem)];
    }
  };
}

function lock() {
  return {
    acquired: false,
    released: false,
    tryLock() { this.acquired = true; return true; },
    releaseLock() { this.released = true; }
  };
}

function createContext(overrides = {}) {
  const properties = overrides.properties || new FakeProperties({ UNRELATED_SETTING: 'preserved' });
  const scriptLock = overrides.lock || lock();
  const state = {
    Buffer,
    Date,
    JSON,
    Object,
    Array,
    String,
    Number,
    isFinite,
    getCurrentUserEmail_: () => overrides.email ?? 'samertheodossy@gmail.com',
    isAdminUser_: () => overrides.admin ?? true,
    isCentralModeEnabled_: () => overrides.central ?? true,
    isAllowlistedUser_: () => true,
    ScriptApp: {
      getScriptId: () => overrides.scriptId ??
        '153TEsXfVu4fwwToMj1-CvdOScj_vNJKBLTgSTejHZSTOUI89xHzgHt4_'
    },
    LockService: { getScriptLock: () => scriptLock },
    PropertiesService: {
      getScriptProperties: () => properties,
      getUserProperties: () => ({ getProperty: () => '', setProperty() {} })
    },
    Utilities: {
      ...utilities(),
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      computeDigest(_algorithm, value) {
        return [...crypto.createHash('sha256').update(String(value), 'utf8').digest()];
      },
      base64EncodeWebSafe(value) { return Buffer.from(value).toString('base64url'); },
      newBlob(value) { return { getBytes: () => [...Buffer.from(String(value), 'utf8')] }; },
      getUuid() { return '12345678-1234-1234-1234-123456789012'; }
    },
    UrlFetchApp: { fetch() { throw new Error('unexpected Cloud Run request'); } }
  };
  vm.createContext(state);
  vm.runInContext(`${bridge}\n${provisioner}`, state);
  return { state, properties, scriptLock };
}

function adminDeps(properties, overrides = {}) {
  return {
    properties,
    utilities: utilities(),
    lock: overrides.lock || lock(),
    currentUserEmail: () => overrides.email ?? 'samertheodossy@gmail.com',
    isAdmin: () => overrides.admin ?? true,
    isCentral: () => overrides.central ?? true,
    scriptId: () => overrides.scriptId ??
      '153TEsXfVu4fwwToMj1-CvdOScj_vNJKBLTgSTejHZSTOUI89xHzgHt4_'
  };
}

function initialPayload(overrides = {}) {
  return { backendUrl, keyId: 'synthetic-key-v1', privateKeyPem: privateKey, ...overrides };
}

function currentProperties(overrides = {}) {
  return new FakeProperties({
    PLAID_SANDBOX_PROOF_ENABLED: 'false',
    PLAID_SANDBOX_BACKEND_URL: backendUrl,
    PLAID_SANDBOX_ASSERTION_KEY_ID: 'synthetic-key-v1',
    PLAID_SANDBOX_ASSERTION_PRIVATE_KEY_PEM: privateKey,
    UNRELATED_SETTING: 'preserved',
    ...overrides
  });
}

function rotationPayload(overrides = {}) {
  return {
    expectedCurrentBackendUrl: backendUrl,
    expectedCurrentKeyId: 'synthetic-key-v1',
    backendUrl: nextBackendUrl,
    keyId: 'synthetic-key-v2',
    privateKeyPem: nextPrivateKey,
    ...overrides
  };
}

function expectThrow(fn, pattern) {
  assert.throws(fn, error => pattern.test(String(error && error.message || error)));
}

const targetNames = [
  'PLAID_SANDBOX_PROOF_ENABLED',
  'PLAID_SANDBOX_BACKEND_URL',
  'PLAID_SANDBOX_ASSERTION_KEY_ID',
  'PLAID_SANDBOX_ASSERTION_PRIVATE_KEY_PEM'
];

{
  const { state, properties } = createContext();
  const result = state.plaidSandboxProvisionInitialInternal_(
    initialPayload(), adminDeps(properties)
  );
  assert.equal(result.installed, true);
  assert.equal(result.proofEnabled, false);
  assert.equal(result.keyId, 'synthetic-key-v1');
  assert.equal(result.privateKeyPresent, true);
  assert.deepEqual([...result.propertyNames], targetNames);
  assert.deepEqual(properties.lastWrittenNames, targetNames);
  assert.equal(properties.lastDeleteAllOthers, false);
  assert.equal(properties.values.get('UNRELATED_SETTING'), 'preserved');
  assert.equal(properties.values.get('PLAID_SANDBOX_PROOF_ENABLED'), 'false');
  assert.equal(JSON.stringify(result).includes(privateKey), false);
}

for (const [label, overrides] of [
  ['normal user', { email: 'normal-user@example.com', admin: false }],
  ['disposable user', { email: 'cashcompass2026@gmail.com', admin: false }],
  ['wrong email with admin helper', { email: 'other-admin@example.com', admin: true }],
  ['wrong mode', { central: false }],
  ['wrong script', { scriptId: 'wrong-script' }]
]) {
  const { state, properties } = createContext(overrides);
  expectThrow(
    () => state.plaidSandboxProvisionInitialInternal_(
      initialPayload(), adminDeps(properties, overrides)
    ),
    /restricted|Central mode|Script ID/
  );
  assert.deepEqual(properties.lastWrittenNames, [], label);
  assert.deepEqual(properties.setPropertyNames, [], `${label} must not mutate proof`);
}

for (const extra of [
  { email: 'samertheodossy@gmail.com' },
  { user: 'samertheodossy@gmail.com' },
  { scriptId: 'browser-script' },
  { propertyNames: targetNames },
  { proofEnabled: true },
  { properties: { PLAID_SANDBOX_PROOF_ENABLED: 'true' } }
]) {
  const { state, properties } = createContext();
  expectThrow(
    () => state.plaidSandboxProvisionInitialInternal_(
      { ...initialPayload(), ...extra }, adminDeps(properties)
    ),
    /fields/
  );
  assert.equal(properties.values.has('PLAID_SANDBOX_PROOF_ENABLED'), false);
  assert.equal(properties.values.has('PLAID_SANDBOX_BACKEND_URL'), false);
}

for (const [payload, pattern] of [
  [initialPayload({ backendUrl: 'https://example.com' }), /backend URL/],
  [initialPayload({ keyId: 'bad' }), /key ID/],
  [initialPayload({ keyId: '__proto__' }), /fields|key ID/],
  [initialPayload({ privateKeyPem: 'not-a-key' }), /private key/]
]) {
  const { state, properties } = createContext();
  expectThrow(
    () => state.plaidSandboxProvisionInitialInternal_(payload, adminDeps(properties)),
    pattern
  );
  assert.deepEqual(properties.lastWrittenNames, []);
}

for (const name of targetNames) {
  const properties = new FakeProperties({ [name]: name === 'PLAID_SANDBOX_PROOF_ENABLED' ? 'false' : 'existing' });
  const { state } = createContext({ properties });
  expectThrow(
    () => state.plaidSandboxProvisionInitialInternal_(initialPayload(), adminDeps(properties)),
    /not empty/
  );
  assert.deepEqual(properties.lastWrittenNames, []);
}

{
  const properties = new FakeProperties({ UNRELATED_SETTING: 'preserved' }, { failSetProperties: true });
  const { state } = createContext({ properties });
  expectThrow(
    () => state.plaidSandboxProvisionInitialInternal_(
      initialPayload(), adminDeps(properties)
    ),
    /synthetic write failure/
  );
  const result = state.plaidSandboxProvisionFailure_(true);
  assert.equal(result.installed, false);
  assert.equal(result.privateKeyPresent, false);
  assert.equal(result.keyId, '');
  assert.equal(properties.values.get('PLAID_SANDBOX_PROOF_ENABLED'), 'false');
  assert.equal(properties.values.get('UNRELATED_SETTING'), 'preserved');
  assert.equal(JSON.stringify(result).includes(privateKey), false);
}

{
  const properties = currentProperties();
  const { state } = createContext({ properties });
  const result = state.plaidSandboxRotateProvisioningInternal_(
    rotationPayload(),
    adminDeps(properties)
  );
  assert.equal(result.installed, true);
  assert.equal(result.proofEnabled, false);
  assert.equal(result.keyId, 'synthetic-key-v2');
  assert.equal(properties.values.get('PLAID_SANDBOX_BACKEND_URL'), nextBackendUrl);
  assert.equal(properties.values.get('PLAID_SANDBOX_ASSERTION_KEY_ID'), 'synthetic-key-v2');
  assert.equal(properties.values.get('UNRELATED_SETTING'), 'preserved');
  assert.equal(properties.lastDeleteAllOthers, false);
  assert.equal(JSON.stringify(result).includes(nextPrivateKey), false);
}

for (const [label, properties, payload] of [
  ['proof true', currentProperties({ PLAID_SANDBOX_PROOF_ENABLED: 'true' }), rotationPayload()],
  ['proof missing', currentProperties({ PLAID_SANDBOX_PROOF_ENABLED: undefined }), rotationPayload()],
  ['stale URL', currentProperties(), rotationPayload({ expectedCurrentBackendUrl: nextBackendUrl })],
  ['stale key', currentProperties(), rotationPayload({ expectedCurrentKeyId: 'stale-key-v9' })],
  ['same key', currentProperties(), rotationPayload({ keyId: 'synthetic-key-v1' })]
]) {
  if (label === 'proof missing') properties.values.delete('PLAID_SANDBOX_PROOF_ENABLED');
  const { state } = createContext({ properties });
  expectThrow(
    () => state.plaidSandboxRotateProvisioningInternal_(payload, adminDeps(properties)),
    /stale current|new immutable/
  );
  assert.notEqual(properties.values.get('PLAID_SANDBOX_ASSERTION_KEY_ID'), 'synthetic-key-v2', label);
}

for (const proofState of [null, '', 'false', 'FALSE', 'unexpected']) {
  const context = {
    getCurrentUserEmail_: () => 'cashcompass2026@gmail.com',
    isAdminUser_: () => false,
    isCentralModeEnabled_: () => true,
    isAllowlistedUser_: () => true,
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: () => proofState })
    }
  };
  vm.createContext(context);
  vm.runInContext(bridge, context);
  assert.equal(context.isPlaidSandboxProofUser_(), false, `kill switch failed for ${proofState}`);
}

assert.equal(/SpreadsheetApp|Drive\.|checksum|expiresAt|runId|SHEET_ID|SHEET_NAME/.test(provisioner), false);
assert.equal(/Logger\.|console\.|console\.log/.test(provisioner), false);
assert.equal(/setProperty\s*\(\s*(?:name|key|propertyName)/.test(provisioner), false);
assert(provisioner.includes('props.setProperties(values, false)'));
assert(provisioner.includes("values[PLAID_SANDBOX_PROOF_ENABLED_KEY_] = 'false'"));
assert.match(provisioner, /function\s+plaidSandboxProvisionInitialInternal_\s*\(payload, deps\)/);
assert.match(provisioner, /function\s+plaidSandboxRotateProvisioningInternal_\s*\(payload, deps\)/);
assert.doesNotMatch(provisioner, /function\s+plaidSandboxProvisionInitial\s*\(payload\)/);
assert.doesNotMatch(provisioner, /function\s+plaidSandboxRotateProvisioning\s*\(payload\)/);
assert.doesNotMatch(provisioner, /function\s+plaidSandboxProvisionHandshake\s*\(\)/);
assert.equal(/\/v1\/(?:link-token|exchange|connections|disconnect)/.test(provisioner), false);
assert(!/function\s+plaidSandboxProvisionInitial\s*\([^)]*(?:email|user|scriptId|proof|properties)/.test(provisioner));
assert(!/function\s+plaidSandboxRotateProvisioning\s*\([^)]*(?:email|user|scriptId|proof|properties)/.test(provisioner));
assert.equal(fs.existsSync(provisionUiUrl), false);
assert.equal(/plaidSandboxProvisionInitial|plaidSandboxRotateProvisioning/.test(customerHtml), false);
assert.equal(/plaidSandboxProvisionInitial|plaidSandboxRotateProvisioning/.test(dashboardStartup), false);
assert.equal(/plaidSandbox(?:InitializeConnection|ExchangePublicToken|ListConnections|Disconnect|RuntimeStatus)/.test(dashboardStartup), false);
assert.equal(/getUserSpreadsheet_|SpreadsheetApp|DocumentApp|appendFinancialFact|saveFinancialFact|runDebtPlanner|INPUT -|OUT -/i.test(bridge + provisioner), false);
assert.equal(webapp.includes("view === 'plaid-sandbox-provisioning'"), false);
assert.equal(/plaid-sandbox-provisioning/.test(customerHtml), false);
assert.equal(Object.hasOwn(manifest, 'gcpProjectNumber'), false);
assert.equal(Object.hasOwn(centralClasp, 'projectId'), false);
assert.deepEqual(manifest.oauthScopes, [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/script.send_mail',
  'https://www.googleapis.com/auth/script.scriptapp',
  'https://www.googleapis.com/auth/script.container.ui',
  'https://www.googleapis.com/auth/script.external_request'
]);
assert.equal(Object.hasOwn(manifest, 'executionApi'), false);
assert(centralManifest.oauthScopes.includes('https://www.googleapis.com/auth/script.external_request'));
assert.equal(centralManifest.executionApi?.access, 'MYSELF');

console.log('Plaid temporary provisioning and kill-switch regressions passed.');
