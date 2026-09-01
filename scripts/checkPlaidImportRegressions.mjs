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
  'plaidImportApplyDebtUpdates', 'plaidImportApplyCashUpdates', 'plaidImportInvalidateMapping', 'plaidImportDisconnect']) {
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
assert(!/appendRow|setValue|setValues|appendFinancialFact|runDebtPlanner/i.test(bridge),
  'bridge file must not contain direct workbook or Planning writers');
{
  const previewStart = bridge.indexOf('function plaidImportFetchPreviewMappedCore_');
  const previewEnd = bridge.indexOf('\nfunction plaidImportRefreshPreviewAccountAfterApply_');
  const previewCore = bridge.slice(previewStart, previewEnd);
  assert(!previewCore.includes('updateBankAccountValueByDate_') &&
    !previewCore.includes('updateDebtField('),
    'Import Data preview core must not write financial fields');
  assert(previewCore.includes('targetProtectedAccountKey') &&
    previewCore.includes('plaidImportConfirmedFacts_(connection, mappings, targetAccountKey)'),
    'Import Data must persist baselines only for the triggering account');
  assert(bridge.includes('plaidImportAccountReviewObservedAt_'),
    'Import Data must use account-scoped review tokens for Apply freshness');
  assert(/function plaidImportApplyCashUpdates_[\s\S]{0,8000}updateBankAccountValueByDate_\(/.test(bridge),
    'Bank Apply must use canonical bank writer');
}
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
assert(bridge.includes('plaidImportApplyDebtUpdates') &&
  bridge.includes('plaidImportApplyCashUpdates') &&
  bridge.includes('PLAID_IMPORT_REVIEW_BASELINE_KEY_PREFIX_') &&
  bridge.includes('reviewObservedAt') &&
  bridge.includes('updateDebtField({') &&
  bridge.includes('updateBankAccountValueByDate_('),
  'Debt and Bank Apply bridges, review baseline, and canonical writer seams are present');
assert(client.includes("plaidMainCall_('plaidImportPreviewMapped'") &&
  !client.includes('updateDebtField(') &&
  !client.includes('updateBankAccountValueByDate('),
  'Connected client must preview read-only and Apply through bridge only');
assert(client.includes('plaidMainEnsureAccountReviewExpanded_') &&
  /plaidMainImportData_[\s\S]{0,900}plaidMainEnsureAccountReviewExpanded_/.test(client) &&
  !/plaidMainEnsureAccountReviewExpanded_[\s\S]{0,200}plaidMainCall_/.test(client),
  'successful Import must expand only the affected account without a backend call');

assert(!/accessToken|itemId|account_id|item_id|client_id|production secret/i.test(client),
  'browser client references raw provider identities or credentials');
assert(runbook.includes('Future approved-Apply Activity Log contract') &&
  runbook.includes('source `PLAID`') &&
  runbook.includes('must not be logged as financial updates'),
  'future approved-Apply Activity Log contract is not pinned');
assert(regressionScenarios.includes('REG-075') && regressionScenarios.includes('REG-076') &&
  regressionScenarios.includes('Connected data is temporarily unavailable.'),
  'one-product inline or future Activity Log regression is missing');

assert(bridge.includes('plaidImportBuildConnectedDisplayTargets_') &&
  bridge.includes('plaidImportBuildConnectedDisplayTargetsFromRegistry_') &&
  bridge.includes('plaidImportEnsureIdentityReadyForConnected_') &&
  bridge.includes('financialIdentityReadRegistry_') &&
  bridge.includes('plaidImportFetchConnectedBackendMetadata_') &&
  bridge.includes('UrlFetchApp.fetchAll') &&
  bridge.includes('plaidImportLogConnectedLoadTiming_') &&
  bridge.includes('metadataOnly: true') &&
  /function plaidImportConnectedAccountsState[\s\S]{0,2200}stageTimingMs/.test(bridge),
  'Connected initial load must expose lightweight metadata path with stage timing');

{
  const connectedStart = bridge.indexOf('function plaidImportConnectedAccountsState');
  const connectedEnd = bridge.indexOf('\nfunction ', connectedStart + 1);
  const connectedSource = bridge.slice(connectedStart, connectedEnd < 0 ? bridge.length : connectedEnd);
  assert(!connectedSource.includes('/v1/preview') &&
    !connectedSource.includes('plaidImportExistingFacts_') &&
    !connectedSource.includes('plaidImportRequestDebtLegacyIndex_') &&
    !connectedSource.includes('plaidImportRequestCashLegacyIndex_') &&
    !connectedSource.includes('getBankAccountUiData()') &&
    !connectedSource.includes('getDebtsUiData()') &&
    !connectedSource.includes('getInvestmentUiData()') &&
    !connectedSource.includes('buildFinancialIdentityFoundationPreview_') &&
    !connectedSource.includes('financialIdentityReadExplicitComparisonAccounts_') &&
    !connectedSource.includes('plaidImportRequestRegistry_') &&
    !connectedSource.includes('reviewAnchorDate') &&
    /plaidImportMappingState_\(connection, account, mappings, registry\)/.test(connectedSource),
    'initial Connected metadata load must not fetch preview, UI models, or foundation preview');
}

{
  const displayStart = bridge.indexOf('function plaidImportBuildConnectedDisplayTargetsFromRegistry_');
  const displayEnd = bridge.indexOf('function plaidImportLogConnectedLoadTiming_');
  const displaySource = bridge.slice(displayStart, displayEnd);
  assert(displaySource.includes('plaidImportConnectedTargetEligible_') &&
    displaySource.includes('displayName') &&
    displaySource.includes('stableAccountId') &&
    !displaySource.includes('getBankAccountUiData()') &&
    !displaySource.includes('getDebtsUiData()') &&
    !displaySource.includes('getInvestmentUiData()'),
    'Connected display targets must use registry labels only');
  const eligibleStart = bridge.indexOf('function plaidImportConnectedTargetEligible_');
  const eligibleEnd = bridge.indexOf('function plaidImportBuildConnectedDisplayTargetsFromRegistry_');
  const eligibleSource = bridge.slice(eligibleStart, eligibleEnd);
  assert(eligibleSource.includes("normalized === 'INVESTMENT'") &&
    eligibleSource.includes("normalized === 'DEBT'") &&
    eligibleSource.includes("rowDomain === 'CASH'"),
    'Connected display targets must remain domain scoped');
}

assert(client.includes("plaidMainCall_('plaidImportConnectedAccountsState', { domain:") &&
  client.includes('metadataByDomain') &&
  /loadPlaidConnectedAccounts_\(true,/.test(client),
  'Connected client must pass domain and support explicit metadata reload');

assert(bridge.includes('plaidImportSafeConnection_') &&
  bridge.includes('PLAID_IMPORT_ALLOWLISTED_CONNECTION_ERROR_CODES_') &&
  bridge.includes('connectionErrorCode'),
  'connection bridge must allowlist safe backend error codes only');
{
  const initStart = bridge.indexOf('function plaidImportInitializeConnection');
  const initEnd = bridge.indexOf('\nfunction ', initStart + 1);
  const initSource = bridge.slice(initStart, initEnd < 0 ? bridge.length : initEnd);
  const exchangeStart = bridge.indexOf('function plaidImportExchangePublicToken');
  const exchangeEnd = bridge.indexOf('\nfunction ', exchangeStart + 1);
  const exchangeSource = bridge.slice(exchangeStart, exchangeEnd < 0 ? bridge.length : exchangeEnd);
  assert(initSource.includes('plaidImportSafeConnection_') &&
    exchangeSource.includes('plaidImportSafeConnection_'),
    'initialize and exchange must use connection-safe wrapper');
  const abandonStart = bridge.indexOf('function plaidImportAbandonConnection');
  const abandonEnd = bridge.indexOf('\nfunction ', abandonStart + 1);
  const abandonSource = bridge.slice(abandonStart, abandonEnd < 0 ? bridge.length : abandonEnd);
  assert(abandonSource.includes("'/v1/link-session/abandon'") &&
    abandonSource.includes("'LINK_SESSION_ABANDON'") &&
    abandonSource.includes('plaidImportSafeConnection_'),
    'abandon connection must call the backend through the safe connection wrapper');
}
{
  const ctx = vm.createContext({ console });
  vm.runInContext(bridge, ctx);
  const inProgress = ctx.plaidImportSafeConnection_(() => {
    throw new Error('Plaid import request failed: CONNECT_IN_PROGRESS');
  });
  assert(inProgress.ok === false &&
    inProgress.connectionErrorCode === 'CONNECT_IN_PROGRESS' &&
    inProgress.error === 'Connected data is temporarily unavailable.' &&
    !JSON.stringify(inProgress).includes('linkToken'),
    'CONNECT_IN_PROGRESS must pass allowlisted code without sensitive fields');
  const reviewRequired = ctx.plaidImportSafeConnection_(() => {
    throw new Error('Plaid import request failed: LINK_COMPLETION_REVIEW_REQUIRED');
  });
  assert(reviewRequired.connectionErrorCode === 'LINK_COMPLETION_REVIEW_REQUIRED',
    'LINK_COMPLETION_REVIEW_REQUIRED must pass allowlisted code');
  const generic = ctx.plaidImportSafeConnection_(() => {
    throw new Error('Plaid import request failed: INVALID_API_KEYS');
  });
  assert(generic.ok === false && !generic.connectionErrorCode,
    'non-allowlisted backend failures must not expose raw codes');
}

new vm.Script(bridge);
new vm.Script(client);

console.log('Plaid import regressions passed.');
