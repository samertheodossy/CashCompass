import fs from 'node:fs';
import vm from 'node:vm';

const bridge = fs.readFileSync(new URL('../plaid_sandbox_bridge.js', import.meta.url), 'utf8');
const provisioner = fs.readFileSync(new URL('../plaid_sandbox_provisioning.js', import.meta.url), 'utf8');
const webapp = fs.readFileSync(new URL('../webapp.js', import.meta.url), 'utf8');
const ui = fs.readFileSync(new URL('../PlaidSandboxTestingUI.html', import.meta.url), 'utf8');
const suites = fs.readFileSync(new URL('../test_harness_suites.js', import.meta.url), 'utf8');
const manifest = JSON.parse(fs.readFileSync(new URL('../appsscript.json', import.meta.url), 'utf8'));
const centralManifest = JSON.parse(fs.readFileSync(new URL('../appsscript.central.json', import.meta.url), 'utf8'));
const claspIgnore = fs.readFileSync(new URL('../.claspignore', import.meta.url), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(`Plaid bridge regression failed: ${message}`);
}

assert(bridge.includes("getCurrentUserEmail_() === PLAID_SANDBOX_PROOF_TEST_EMAIL_"), 'proof identity is not server-derived from the effective user');
assert(bridge.includes('isCentralModeEnabled_()') && bridge.includes('isAllowlistedUser_()'), 'Central mode or allow-list gate is missing');
assert(bridge.includes("!isAdminUser_()"), 'disposable proof identity must remain non-admin');
assert(bridge.includes("'owner' in input") && bridge.includes("'email' in input") && bridge.includes("'userKey' in input"), 'browser ownership fields are not explicitly rejected');
assert(!/function\s+plaidSandbox(?:InitializeConnection|ExchangePublicToken|ListConnections|Disconnect)\s*\([^)]*(?:email|owner|userKey|workbook)/.test(bridge), 'a public RPC accepts browser ownership or workbook identity');
assert(!/getUserSpreadsheet_|SpreadsheetApp|DocumentApp|appendFinancialFact|saveFinancialFact|runDebtPlanner|INPUT -|OUT -/i.test(bridge), 'bridge reaches workbook, Financial Facts, INPUT, or Planning state');
assert(!/plaid-sandbox-client-id|plaid-sandbox-secret|access[_ -]?token.*setProperty|item[_ -]?id.*setProperty|account[_ -]?id.*setProperty/i.test(bridge), 'bridge stores Plaid credentials or provider IDs in Script Properties');
assert(bridge.includes('computeRsaSha256Signature') && bridge.includes('bodySha256') && bridge.includes("env: 'SANDBOX'") && bridge.includes('jti:'), 'signed assertion is missing required binding claims');
assert(bridge.includes("exp: now + 60"), 'assertion lifetime is not short');
assert(bridge.includes("PropertiesService.getUserProperties()"), 'protected user identity is not server-side and user-scoped');
assert(!bridge.includes('function plaidSandboxConfigureDeployment(payload)'),
  'browser-callable direct deployment configuration still exists');
assert(provisioner.includes('function plaidSandboxProvisionInitialInternal_(payload, deps)') &&
  provisioner.includes('function plaidSandboxRotateProvisioningInternal_(payload, deps)') &&
  provisioner.includes('function plaidSandboxAssertProvisioningAdmin_(deps)'),
  'reusable administrator provisioning internals are missing');
assert(!provisioner.includes('function plaidSandboxProvisionInitial(payload)') &&
  !provisioner.includes('function plaidSandboxRotateProvisioning(payload)') &&
  !provisioner.includes('function plaidSandboxProvisionHandshake()') &&
  !provisioner.includes('function plaidSandboxAdminProofOffRuntimeStatus()'),
  'temporary administrator entry handler remains exposed');
assert(!/google\.script\.run[\s\S]{0,160}plaidSandboxProvisionInitial/i.test(ui + webapp),
  'customer browser code invokes the temporary provisioner');
assert(provisioner.includes("values[PLAID_SANDBOX_PROOF_ENABLED_KEY_] = 'false'"),
  'temporary provisioner does not initialize the proof runner OFF');
assert(bridge.includes('function plaidSandboxSetProofEnabled(enabled)') && bridge.includes('readAllowlist_()'),
  'proof control does not recheck the exact allow-list');
assert(/^services\/\*\*$/m.test(claspIgnore), 'Cloud Run service source is not excluded from Apps Script pushes');

assert(webapp.includes("view === 'plaid-sandbox' && isPlaidSandboxProofUser_()"), 'guarded proof route is missing');
assert(suites.includes("id: 'SUITE-PLAID-SANDBOX-CONNECTIVITY'") && suites.includes("browserRoute: 'plaid-sandbox'"), 'proof adapter is not registered in the single Validation console');
assert(ui.includes('SANDBOX ONLY') && ui.includes('Connect financial account') && ui.includes('Disconnect'), 'proof UI is missing required visible lifecycle controls');
assert(!/accessToken|itemId|account_id|item_id|client_id|secret\s*[:=]/.test(ui), 'proof UI references raw provider credentials or identifiers');
assert(manifest.oauthScopes.filter(scope => scope === 'https://www.googleapis.com/auth/script.external_request').length === 1 &&
  !manifest.executionApi, 'bounded manifest is missing its exact direct-backend scope or gained execution API authority');
assert(centralManifest.oauthScopes.filter(scope => scope === 'https://www.googleapis.com/auth/script.external_request').length === 1,
  'Central UrlFetch scope is missing or duplicated');
assert(centralManifest.executionApi && centralManifest.executionApi.access === 'MYSELF',
  'deployment configuration API must remain deployer-only');

const context = {
  getCurrentUserEmail_: () => 'cashcompass2026@gmail.com',
  isAdminUser_: () => false,
  isCentralModeEnabled_: () => true,
  isAllowlistedUser_: () => true,
  PropertiesService: {
    getScriptProperties: () => ({ getProperty: name => name === 'PLAID_SANDBOX_PROOF_ENABLED' ? 'true' : '' })
  }
};
vm.createContext(context);
vm.runInContext(bridge, context);
assert(context.isPlaidSandboxProofUser_() === true, 'exact Central non-admin allowlisted proof user is not admitted');
context.isCentralModeEnabled_ = () => false;
assert(context.isPlaidSandboxProofUser_() === false, 'bound mode can reach Central Plaid state');
context.isCentralModeEnabled_ = () => true;
context.isAllowlistedUser_ = () => false;
assert(context.isPlaidSandboxProofUser_() === false, 'non-allowlisted caller can reach Plaid bridge');

console.log('Plaid bridge regressions passed.');
