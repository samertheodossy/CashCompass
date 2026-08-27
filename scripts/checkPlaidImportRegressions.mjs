import fs from 'node:fs';
import vm from 'node:vm';

const bridge = fs.readFileSync(new URL('../plaid_import_bridge.js', import.meta.url), 'utf8');
const client = fs.readFileSync(new URL('../Dashboard_Script_PlaidConnectedAccounts.html', import.meta.url), 'utf8');
const body = fs.readFileSync(new URL('../Dashboard_Body.html', import.meta.url), 'utf8');
const page = fs.readFileSync(new URL('../PlannerDashboardWeb.html', import.meta.url), 'utf8');
const webapp = fs.readFileSync(new URL('../webapp.js', import.meta.url), 'utf8');
const runbook = fs.readFileSync(new URL('../PLAID_CONNECTIVITY.md', import.meta.url), 'utf8');
const regressionScenarios = fs.readFileSync(new URL('../REGRESSION_SCENARIOS.md', import.meta.url), 'utf8');
const boundedManifest = JSON.parse(fs.readFileSync(new URL('../appsscript.json', import.meta.url), 'utf8'));
const centralManifest = JSON.parse(fs.readFileSync(new URL('../appsscript.central.json', import.meta.url), 'utf8'));

function assert(condition, message) {
  if (!condition) throw new Error(`Plaid import regression failed: ${message}`);
}

const externalRequest = 'https://www.googleapis.com/auth/script.external_request';
assert(boundedManifest.oauthScopes.filter(scope => scope === externalRequest).length === 1,
  'bounded external-request scope is not present exactly once');
assert(!boundedManifest.executionApi, 'bounded manifest gained an execution API');
assert(centralManifest.oauthScopes.filter(scope => scope === externalRequest).length === 1,
  'Central external-request scope is not present exactly once');
assert(centralManifest.executionApi?.access === 'MYSELF', 'Central execution API authority changed');

assert(bridge.includes("if (raw === 'true') return 'CENTRAL'") &&
  bridge.includes("if (raw === null || raw === '' || raw === 'false') return 'BOUNDED'") &&
  bridge.includes("throw new Error('Unsupported CashCompass runtime.')"),
  'Central and bounded modes are not explicit and fail-closed');
const runtimeContextStart = bridge.indexOf('function plaidImportRuntimeContext_');
const runtimeContextEnd = bridge.indexOf('\nfunction ', runtimeContextStart + 1);
const runtimeContextSource = bridge.slice(
  runtimeContextStart,
  runtimeContextEnd < 0 ? bridge.length : runtimeContextEnd
);
assert(runtimeContextStart >= 0 &&
  runtimeContextSource.includes('getCurrentUserEmail_()') &&
  runtimeContextSource.includes('isAllowlistedUser_()') &&
  runtimeContextSource.includes('getUserSpreadsheet_()'),
  'authenticated user and workbook authority are not server-derived');
assert(!runtimeContextSource.includes('SpreadsheetApp.getActiveSpreadsheet()'),
  'runtime context repeats active-workbook resolution after the authoritative resolver');
assert(bridge.includes("['owner', 'email', 'userKey', 'workbookId', 'spreadsheetId']"),
  'browser ownership fields are not rejected');
for (const operation of ['plaidImportExchangePublicToken', 'plaidImportReconnect',
  'plaidImportCompleteReconnect', 'plaidImportSaveMapping', 'plaidImportPreviewMapped',
  'plaidImportInvalidateMapping', 'plaidImportDisconnect']) {
  const start = bridge.indexOf(`function ${operation}`);
  const end = bridge.indexOf('\nfunction ', start + 1);
  const source = bridge.slice(start, end < 0 ? bridge.length : end);
  assert(start >= 0 && source.includes('plaidImportRejectBrowserAuthority_'),
    `${operation} does not reject browser ownership authority`);
}
assert(bridge.includes("subject: 'u_' + plaidSandboxSha256_(email)") &&
  bridge.includes('sub: identity.subject') && bridge.includes('usr: identity.email'),
  'authenticated CashCompass identity is not derived server-side');
assert(bridge.includes("'/v1/mappings'") && bridge.includes("'/v1/mappings/save'") &&
  bridge.includes("'/v1/mappings/invalidate'"),
  'shared backend is not the normal mapping authority');
const legacyStart = bridge.indexOf('function plaidImportLegacyMappingProperty_');
const migrationEnd = bridge.indexOf('\nfunction plaidImportMappingState_', legacyStart);
const legacySource = bridge.slice(legacyStart, migrationEnd);
const normalSource = bridge.slice(0, legacyStart) + bridge.slice(migrationEnd);
assert(legacyStart >= 0 && legacySource.includes("ACCOUNT_MAPPINGS_JSON") &&
  legacySource.includes('PropertiesService.getUserProperties()') &&
  legacySource.includes('plaidImportMigrateLegacyMappingsToBackend'),
  'one-time legacy mapping migration is missing');
assert(!normalSource.includes("getProperty('PLAID_' + environment + '_ACCOUNT_MAPPINGS_JSON')") &&
  !normalSource.includes('getProperty(plaidImportLegacyMappingProperty_())') &&
  !/setProperty\([^\n]*(?:ACCOUNT_MAPPINGS_JSON|PLAID_IMPORT_LEGACY_MAPPING_KEY_PREFIX_)/.test(bridge),
  'normal runtime retains a second local mapping authority');
assert(legacySource.includes("context.mode !== 'CENTRAL'") &&
  legacySource.includes("identity.email !== PLAID_IMPORT_SOLE_ADMIN_EMAIL_") &&
  legacySource.includes('legacySourcePreserved: true'),
  'legacy migration is not sole-admin, Central-only, and non-destructive');
assert(bridge.includes("value !== 'SANDBOX' && value !== 'TRIAL'") &&
  bridge.includes("props.getProperty(PLAID_IMPORT_ENABLED_KEY_) === 'true'"),
  'feature and backend environment are not explicit and fail-closed');
assert(bridge.includes("env: environment") && bridge.includes('computeRsaSha256Signature'),
  'reviewed signed backend transport is not reused');
assert(bridge.includes("'/v1/preview'") && bridge.includes("authority: 'SHADOW_ONLY'") &&
  bridge.includes('readOnly: true'), 'preview is not shadow-only and read-only');
assert(bridge.includes('plaidImportBuildManualComparisonTargets_') &&
  bridge.includes('getDebtsUiData()') && bridge.includes('getBankAccountUiData()') &&
  bridge.includes('getInvestmentUiData()') &&
  bridge.includes('accountName: accountName') &&
  bridge.includes('financialIdentityIsEligibleExplicitComparisonTarget_') &&
  !bridge.includes("identityStatus || '').toUpperCase() === 'VERIFIED'"),
  'Connected comparison targets do not reuse manual update account lists');
assert(bridge.includes('plaidImportEnsureIdentityFoundationForConnected_') &&
  bridge.includes('plaidImportResolveComparisonTargets_') &&
  bridge.includes('ensureFinancialIdentityFoundationForConnectedAccounts_') &&
  bridge.includes('FINANCIAL_IDENTITY_REVIEW_REQUIRED') &&
  bridge.includes('PLAID_IMPORT_IDENTITY_REVIEW_ERROR_') &&
  bridge.includes('runPlaidImportIdentitySelfInitDiagnostic'),
  'Connected path does not self-init identity foundation safely');
assert(!/appendRow|setValue|setValues|appendFinancialFact|updateBankAccountValueByDate_|runDebtPlanner/i.test(bridge),
  'bridge file must not contain direct workbook or Planning writers');
assert(!/transactions\/|investments\/|\/asset_report\//i.test(bridge),
  'read-only bridge requests a prohibited provider product endpoint');

assert(!fs.existsSync(new URL('../PlaidImportUI.html', import.meta.url)),
  'rejected separate Plaid page remains in source');
assert(!webapp.includes("view === 'plaid-import'") && !client.includes('view=plaid-import'),
  'separate Plaid route or redirect remains');
assert(!client.includes('<iframe') && !client.includes('window.open') &&
  !client.includes('location.href') && !client.includes('location.assign'),
  'inline client retains an iframe or navigation fallback');
assert(page.includes("includeHtml_('Dashboard_Script_PlaidConnectedAccounts')") &&
  page.includes('https://cdn.plaid.com/link/v2/stable/link-initialize.js'),
  'shared native client or Plaid Link is not in the normal CashCompass shell');
for (const area of ['bank', 'debt', 'inv']) {
  assert(body.includes(`id="${area}_mode_connected_btn"`) &&
    body.includes(`id="${area}_mode_connected_wrap"`),
  `${area} Connected panel is missing`);
}
assert(client.includes("var PLAID_MAIN_UNAVAILABLE_ = 'Connected data is temporarily unavailable.'") &&
  client.includes('result && result.error') &&
  client.includes('function plaidMainUserMessage_(err)') &&
  !client.includes('showError('), 'Connected failures are not isolated to their panel');
assert(client.includes('function loadPlaidConnectedAccounts_(') &&
  client.includes("plaidMainCall_('plaidImportConnectedAccountsState'") &&
  client.includes("plaidMainCall_('plaidImportPreviewMapped'") &&
  client.includes("plaidMainCall_('plaidImportSaveMapping'"),
  'Connected panels do not use the shared native bridge');
assert(bridge.includes('plaidImportSaveAprSourcePreference') &&
  bridge.includes('PLAID_IMPORT_APR_SOURCE_KEY_PREFIX_') &&
  bridge.includes('accountPreview.cashCompassLegacy') &&
  bridge.includes('Credit Left review value is derived') &&
  bridge.includes('Provider Available Credit') &&
  bridge.includes('plaidImportReviewAnchorDate_') &&
  bridge.includes('reviewAnchorDate') &&
  bridge.includes('Future Apply must route each approved field'),
  'APR preference, Credit Left derivation, and review anchor contract are missing');
assert(client.includes("plaidMainCall_('plaidImportSaveAprSourcePreference'") ||
  client.includes('plaidImportSaveAprSourcePreference'),
  'Connected client must save APR source preferences through the bridge');
assert(!/plaidImportApply|approvalToken/i.test(client + bridge),
  'current candidate exposes Plaid Apply authority');
assert(!client.includes("plaidMainButton_('Apply Selected Updates'"),
  'disabled Apply Selected Updates control must stay hidden in review-only UX');
assert(!/accessToken|itemId|account_id|item_id|client_id|production secret/i.test(client),
  'browser client references raw provider identities or credentials');
assert(runbook.includes('Future approved-Apply Activity Log contract') &&
  runbook.includes('source `PLAID`') &&
  runbook.includes('must not be logged as financial updates'),
  'future approved-Apply Activity Log contract is not pinned');
assert(regressionScenarios.includes('REG-075') && regressionScenarios.includes('REG-076') &&
  regressionScenarios.includes('Connected data is temporarily unavailable.'),
  'one-product inline or future Activity Log regression is missing');

new vm.Script(bridge);
new vm.Script(client);

console.log('Plaid import regressions passed.');
