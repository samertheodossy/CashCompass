import fs from 'node:fs';
import vm from 'node:vm';

const bridge = fs.readFileSync(new URL('../plaid_import_bridge.js', import.meta.url), 'utf8');
const body = fs.readFileSync(new URL('../Dashboard_Body.html', import.meta.url), 'utf8');
const page = fs.readFileSync(new URL('../PlannerDashboardWeb.html', import.meta.url), 'utf8');
const client = fs.readFileSync(new URL('../Dashboard_Script_PlaidConnectedAccounts.html', import.meta.url), 'utf8');
const assetsClient = fs.readFileSync(new URL('../Dashboard_Script_AssetsBankInvestments.html', import.meta.url), 'utf8');
const debtsClient = fs.readFileSync(new URL('../Dashboard_Script_PlanningDebts.html', import.meta.url), 'utf8');
const housesClient = fs.readFileSync(new URL('../Dashboard_Script_AssetsHouseValues.html', import.meta.url), 'utf8');
const trackedEditorsClient = fs.readFileSync(new URL('../Dashboard_Script_TrackedEditors.html', import.meta.url), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(`Plaid main-app regression failed: ${message}`);
}

function assertThrows(callback, pattern, message) {
  let thrown = null;
  try {
    callback();
  } catch (err) {
    thrown = err;
  }
  assert(thrown && pattern.test(String(thrown && thrown.message || thrown)), message);
}

function htmlElementRangeById(source, id, tagName = 'div') {
  const opening = new RegExp(`<${tagName}\\b[^>]*\\bid=["']${id}["'][^>]*>`, 'i').exec(source);
  if (!opening) return null;
  const tokens = new RegExp(`<\\/?${tagName}\\b[^>]*>`, 'gi');
  tokens.lastIndex = opening.index;
  let depth = 0;
  let token;
  while ((token = tokens.exec(source))) {
    depth += /^<\//.test(token[0]) ? -1 : 1;
    if (depth === 0) return { start: opening.index, end: tokens.lastIndex };
  }
  return null;
}

assert(!body.includes('data-page="connected"') && !body.includes('id="page_connected"'),
  'standalone Connected Accounts workspace remains');
for (const area of ['bank', 'debt', 'inv']) {
  const manage = htmlElementRangeById(body, `${area}_mode_manage_wrap`);
  const connected = htmlElementRangeById(body, `${area}_mode_connected_wrap`);
  assert(manage && connected && manage.end <= connected.start,
    `${area} Connected panel is nested inside the hidden Manage panel`);
}
assert(page.includes("includeHtml_('Dashboard_Script_PlaidConnectedAccounts')"),
  'normal CashCompass page omits the shared inline client');
assert(!body.includes('id="plaid_main_frame_') && !body.includes('Open connected') &&
  !client.includes('window.open') && !client.includes('view=plaid-import'),
  'iframe or separate-page Connected workaround remains');
assert(client.includes('function plaidMainTargetMatchesDomain_(target, domain)') &&
  client.includes("target.accountName || target.displayName") &&
  !client.includes('target.mask ?'),
  'Connected selectors do not reuse manual update account labels');
assert(client.includes('function plaidMainTargetMatchesDomain_(target, domain)') &&
  client.includes('return plaidMainTargetMatchesDomain_(target, domain);'),
  'domain filtering is incomplete');
assert(client.includes("if (type === 'depository') return 'CASH'") &&
  client.includes("if (type === 'credit' || type === 'loan' || subtype === 'mortgage') return 'DEBT'") &&
  client.includes("if (type === 'investment' || type === 'brokerage') return 'INVESTMENT'"),
  'account type routing is incomplete');
assert(assetsClient.includes("if (connectedMode && typeof loadPlaidConnectedAccounts_ === 'function')") &&
  assetsClient.includes("loadPlaidConnectedAccounts_(false, 'CASH')") &&
  assetsClient.includes("if (m === 'connected' && typeof loadPlaidConnectedAccounts_ === 'function')") &&
  assetsClient.includes("loadPlaidConnectedAccounts_(false, 'INVESTMENT')") &&
  debtsClient.includes("if (mode === 'connected' && typeof loadPlaidConnectedAccounts_ === 'function')") &&
  debtsClient.includes("loadPlaidConnectedAccounts_(false, 'DEBT')"),
  'Connected data is not loaded only when its contextual panel is selected');
assert(trackedEditorsClient.includes('function currentTrackedEditorMode_(') &&
  assetsClient.includes("currentTrackedEditorMode_('bank', ['update', 'add', 'manage', 'connected']) === 'update'") &&
  assetsClient.includes("currentTrackedEditorMode_('inv', ['update', 'add', 'manage', 'connected']) === 'update'") &&
  debtsClient.includes("currentTrackedEditorMode_('debt', ['update', 'add', 'manage', 'connected']) === 'update'") &&
  housesClient.includes("currentTrackedEditorMode_('house', ['update', 'add', 'manage']) === 'update'"),
  'late background reads can override an explicitly selected mode');
assert(client.includes("var PLAID_MAIN_UNAVAILABLE_ = 'Connected data is temporarily unavailable.'") &&
  client.includes('function plaidMainUserMessage_(err)') &&
  !client.includes('showError('), 'Plaid failure can replace normal dashboard startup state');
assert(client.includes('Import Data') && !client.includes('Refresh evidence'),
  'Connected import action must use product terminology');
assert(client.includes('CashCompass account') && !client.includes('Confirm mapping') &&
  !client.includes('Mapping: Confirmed') && !client.includes('Mapping: '),
  'Connected association must not expose mapping terminology');
assert(client.includes('Manage connection') &&
  client.includes("'Apply Selected Updates'") &&
  client.includes('allowApplySelection') &&
  client.includes('Select approved fields, then Apply Selected Updates'),
  'Debt Connected review must expose controlled Apply selection UX');
assert(client.includes('Review imported changes') && client.includes('Changes to review') &&
  client.includes('Additional information') && client.includes('Needs review') &&
  client.includes('plaid-main-review-panel') && client.includes('max-width:920px') &&
  client.includes('margin:14px auto 0') &&
  client.includes('plaid-main-comparison-table') && client.includes('plaidMainGetNextDueDateParts_') &&
  client.includes('Changes to review') && client.includes('Same') &&
  client.includes('Needs selection') && client.includes('plaidMainFormatImportedAt_') &&
  client.includes('PLAID_MAIN_MISSING_') && client.includes('plaidMainEnsureStyles_') &&
  client.includes('plaidMainRenderInlineAprControls_') &&
  client.includes('Provider Available Credit') &&
  client.includes('plaidMainDerivedCreditLeft_') &&
  !client.includes('Same due day'),
  'Connected import review tables and semantics are missing');
assert(client.includes('plaidMainProviderImportTiming_') &&
  client.includes('plaidMainProviderBalanceEffectiveAt_') &&
  client.includes('Provider balance as of:') &&
  client.includes('Plaid retrieved:') &&
  client.includes('providerEffectiveAsOf'),
  'Connected import review must show Plaid retrieval and provider balance timestamps');
assert(client.includes('plaidMainSaveAprPreference_') &&
  client.includes('plaidImportSaveAprSourcePreference') &&
  client.includes('writerField: \'Int Rate\'') &&
  client.includes('derivedOnly: true') &&
  client.includes('Change APR source'),
  'APR source preference and Credit Left derivation contract are missing');
assert(client.includes('PLAID_MAIN_DEBT_CANONICAL_') &&
  client.includes('Credit Left') && client.includes('CREDIT_LEFT_DERIVED') &&
  client.includes('NEXT_PAYMENT_DATE') && client.includes('Due Date') &&
  client.includes('reviewAnchorDate') &&
  !/plaidMainBuildDueDateRow_[\s\S]{0,400}toLocaleString/.test(client),
  'canonical Debt field coverage and due-date display contract are missing');
assert(client.includes('plaidMainApplyMappingLocally_'), 'association save must update local Connected state');
{
  const saveMappingStart = client.indexOf('function plaidMainSaveMapping_');
  const saveMappingEnd = client.indexOf('\nfunction ', saveMappingStart + 1);
  const saveMappingSource = client.slice(saveMappingStart, saveMappingEnd < 0 ? client.length : saveMappingEnd);
  assert(!saveMappingSource.includes('loadPlaidConnectedAccounts_(true'),
    'association save must not trigger a full Connected reload');
}
assert(!/plaidMainElement_\([^)]*row\.status|row\.reason \? ' · '/.test(client),
  'raw provider review codes must not be rendered in Connected UI');
assert(client.includes('plaidMainApplySelectedUpdates_') &&
  client.includes('plaidImportApplyDebtUpdates') &&
  client.includes('plaidImportApplyCashUpdates') &&
  client.includes('PLAID_MAIN_CASH_APPLY_KEYS_') &&
  client.includes("'Apply Selected Updates'") &&
  client.includes('allowApplySelection') &&
  client.includes('plaidMainApplySelectable_') &&
  client.includes('plaidMainSelectedEligibleApplyCount_') &&
  client.includes('importingKeys') &&
  client.includes('plaidMainRenderAccountLocalStatus_'),
  'Debt and Bank Apply selection UX and account-local status are present in Connected client');

assert(client.includes('Importing data…') &&
  !client.includes('Importing provider data…') &&
  /loadPlaidConnectedAccounts_[\s\S]{0,400}plaidMainSetStatus_/.test(client),
  'section Reload must keep section-level status while Import uses account-local status');

assert(/plaidMainApplySelectable_[\s\S]{0,200}change === 'Same'/.test(client) &&
  /applyBtn\.disabled = applying \|\| applyCount < 1/.test(client),
  'Apply button must disable when no eligible changed fields remain selected');
assert(!client.includes('approvalToken'),
  'Apply must not use browser approval tokens');
assert(client.includes('Import Data = read-only provider retrieval'),
  'Connected client must document Import vs Apply contract');

assert(client.includes('plaidMainHasValidAccountPreview_') &&
  client.includes('accountImportState') &&
  client.includes('accountPreviews') &&
  client.includes('plaidMainClearAccountReviewState_') &&
  /plaidMainRenderDomain_[\s\S]{0,3000}plaidMainGetAccountPreviewBundle_/.test(client) &&
  /plaidMainImportData_[\s\S]{0,600}protectedAccountKey/.test(client) &&
  client.includes('plaidMainPatchAccountCard_') &&
  client.includes('Not yet imported'),
  'review UI must use account-scoped previews that coexist under one connection');

assert(client.includes('collapsedAccountKeys') &&
  client.includes('plaidMainApplySelectionKey_') &&
  client.includes('plaidMainIsAccountReviewCollapsed_') &&
  client.includes('plaidMainToggleAccountReviewCollapsed_') &&
  client.includes('plaid-main-review-toggle') &&
  /plaidMainRenderReviewToggleButton_[\s\S]{0,400}Collapse/.test(client) &&
  /plaidMainRenderReviewToggleButton_[\s\S]{0,400}Expand/.test(client) &&
  client.includes('aria-expanded') &&
  client.includes('aria-controls') &&
  client.includes('plaid-main-collapsed-review-summary') &&
  client.includes('plaidMainActionableReviewSummaryText_') &&
  client.includes('✓ Up to date') &&
  client.includes('changes to review') &&
  /plaidMainActionableReviewSummaryText_[\s\S]{0,600}derivedOnly/.test(client) &&
  /plaidMainActionableReviewSummaryText_[\s\S]{0,600}informational/.test(client) &&
  /plaidMainActionableReviewSummaryText_[\s\S]{0,600}change === 'Same'/.test(client) &&
  /plaidMainBuildAccountCard_[\s\S]{0,2500}!collapsed[\s\S]{0,400}plaidMainRenderPreviewAccount_/.test(client) &&
  /plaidMainBuildAccountCard_[\s\S]{0,2500}collapsed[\s\S]{0,400}plaidMainRenderCollapsedReviewSummary_/.test(client) &&
  /plaidMainToggleAccountReviewCollapsed_[\s\S]{0,300}plaidMainPatchAccountCard_/.test(client) &&
  !/plaidMainToggleAccountReviewCollapsed_[\s\S]{0,300}plaidMainCall_/.test(client) &&
  /plaidMainImportData_[\s\S]{0,900}plaidMainEnsureAccountReviewExpanded_/.test(client) &&
  /plaidMainApplySelectedUpdates_[\s\S]{0,1500}plaidMainEnsureAccountReviewExpanded_/.test(client) &&
  /plaidMainClearAccountReviewState_[\s\S]{0,300}collapsedAccountKeys/.test(client) &&
  /if \(hasPreview\) \{[\s\S]{0,200}plaidMainRenderReviewToggleButton_/.test(client),
  'Connected account review collapse/expand UX contract is missing');

assert(client.includes('metadataByDomain') &&
  client.includes('plaidMainInvalidateMetadataCache_') &&
  client.includes('plaidMainStoreMetadataCache_') &&
  /loadPlaidConnectedAccounts_[\s\S]{0,900}metadataByDomain\[targetDomain\]/.test(client) &&
  /plaidMainCall_\('plaidImportConnectedAccountsState', \{ domain: targetDomain \}/.test(client) &&
  /loadPlaidConnectedAccounts_\(true, targetDomain\)/.test(client) &&
  /plaidMainInvalidateMetadataCache_\(\)[\s\S]{0,400}loadPlaidConnectedAccounts_\(true/.test(client) &&
  !/plaidMainImportData_[\s\S]{0,600}plaidMainInvalidateMetadataCache_/.test(client) &&
  !/plaidMainApplySelectedUpdates_[\s\S]{0,900}plaidMainInvalidateMetadataCache_/.test(client),
  'Connected initial load must use domain-scoped session metadata cache with explicit invalidation');

{
  const connectedStart = bridge.indexOf('function plaidImportConnectedAccountsState');
  const connectedEnd = bridge.indexOf('\nfunction ', connectedStart + 1);
  const connectedSource = bridge.slice(connectedStart, connectedEnd < 0 ? bridge.length : connectedEnd);
  assert(!connectedSource.includes('/v1/preview') &&
    !connectedSource.includes('plaidImportFetchPreviewMappedCore_') &&
    !connectedSource.includes('plaidImportExistingFacts_') &&
    !connectedSource.includes('plaidImportStoreReviewBaseline_') &&
    !connectedSource.includes('buildFinancialIdentityFoundationPreview_') &&
    !connectedSource.includes('financialIdentityReadExplicitComparisonAccounts_') &&
    !connectedSource.includes('plaidImportRequestRegistry_') &&
    connectedSource.includes('plaidImportFetchConnectedBackendMetadata_') &&
    bridge.includes('UrlFetchApp.fetchAll') &&
    connectedSource.includes('metadataOnly: true') &&
    connectedSource.includes('stageTimingMs') &&
    connectedSource.includes('plaidImportBuildConnectedDisplayTargetsFromRegistry_') &&
    /plaidImportMappingState_\(connection, account, mappings, registry\)/.test(connectedSource),
    'initial Connected load must remain metadata-only without financial evidence reads');
}

new vm.Script(bridge);
new vm.Script(client);

function bag(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getProperty: key => values.has(key) ? values.get(key) : null,
    setProperty: (key, value) => values.set(key, String(value)),
    values
  };
}

function bridgeContext(centralMode, activeWorkbookId = 'book-1', email = 'samertheodossy@gmail.com') {
  const scriptProps = bag({
    CENTRAL_MODE: centralMode,
    PLAID_IMPORT_ENABLED: 'true',
    PLAID_IMPORT_ENVIRONMENT: 'TRIAL'
  });
  const workbook = { getId: () => 'book-1' };
  const context = vm.createContext({
    console, Date, JSON, Number, String, Array, Object, RegExp,
    PropertiesService: {
      getScriptProperties: () => scriptProps,
      getUserProperties: () => bag()
    },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => {
        throw new Error('redundant active workbook lookup');
      }
    },
    getCurrentUserEmail_: () => email,
    isAllowlistedUser_: () => true,
    getUserSpreadsheet_: () => workbook,
    Utilities: { getUuid: () => '123456781234123412341234567890ab' },
    plaidSandboxSha256_: value => `digest-${value}`
  });
  new vm.Script(bridge).runInContext(context);
  return context;
}

assert(bridgeContext('true').plaidImportRuntimeContext_().mode === 'CENTRAL',
  'Central runtime is not admitted explicitly');
assert(bridgeContext('false').plaidImportRuntimeContext_().mode === 'BOUNDED',
  'bounded runtime is not admitted explicitly');
assert(bridgeContext(null).plaidImportRuntimeContext_().mode === 'BOUNDED',
  'legacy no-argument bounded runtime is not preserved');
assertThrows(() => bridgeContext('unexpected').plaidImportRuntimeMode_(), /Unsupported CashCompass runtime/,
  'unknown runtime does not fail closed');
assertThrows(() => bridgeContext('false').plaidImportRejectBrowserAuthority_({ workbookId: 'book-1' }),
  /Browser-provided ownership is not accepted/, 'browser workbook authority is accepted');
const centralIdentity = bridgeContext('true').plaidImportAuthenticatedIdentity_();
const boundedIdentity = bridgeContext('false').plaidImportAuthenticatedIdentity_();
assert(centralIdentity.email === boundedIdentity.email && centralIdentity.subject === boundedIdentity.subject,
  'same CashCompass owner does not resolve identically in Central and bounded');
assert(bridgeContext('true', 'book-1', 'other@example.com').plaidImportAuthenticatedIdentity_().subject !==
  centralIdentity.subject, 'different CashCompass users share a protected subject');
const safe = bridgeContext('false').plaidImportSafe_(() => { throw new Error('private backend detail'); });
assert(safe.ok === false && safe.error === 'Connected data is temporarily unavailable.' &&
  !JSON.stringify(safe).includes('private backend detail'), 'raw server failure escaped to the browser');
const reviewSafe = bridgeContext('false').plaidImportSafe_(() => {
  throw new Error('FINANCIAL_IDENTITY_REVIEW_REQUIRED');
});
assert(reviewSafe.ok === false &&
  reviewSafe.error === 'CashCompass account identity needs review before Connected accounts can be matched.',
  'identity review failures must surface a dedicated user-facing message');

assert(client.includes('PLAID_MAIN_CONNECT_PROGRESS_') &&
  client.includes('Creating secure connection session. This may take up to 60 seconds.') &&
  client.includes('PLAID_MAIN_CONNECT_ERROR_CODES_') &&
  client.includes('plaidMainConnectErrorMessage_') &&
  client.includes('plaidMainIsConnectInFlight_') &&
  client.includes('plaidMainBeginConnect_') &&
  client.includes('plaidMainEndConnect_') &&
  client.includes('plaidMainSetConnectBusy_') &&
  client.includes('connectingByDomain') &&
  client.includes('connectRequestSeq'),
  'connect concurrency UX helpers are missing');

assert(/function plaidMainConnect_[\s\S]{0,220}plaidMainIsConnectInFlight_/.test(client) &&
  /function plaidMainConnect_[\s\S]{0,500}return;[\s\S]{0,120}plaidMainBeginConnect_/.test(client),
  'Connect must ignore duplicate clicks while a request is in flight');

assert(/function plaidMainConnect_[\s\S]{0,900}PLAID_MAIN_CONNECT_PROGRESS_/.test(client) &&
  /function plaidMainConnect_[\s\S]{0,1200}connectRequestSeq\[targetDomain\] !== requestId/.test(client),
  'Connect must show slow-session progress and ignore stale responses');

assert(/function plaidMainConnect_[\s\S]{0,2200}plaidMainConnectErrorMessage_\(err\)/.test(client) &&
  client.includes('CONNECT_IN_PROGRESS: \'A connection is already in progress. Please wait before trying again.\'') &&
  client.includes('LINK_COMPLETION_REVIEW_REQUIRED: \'A previous connection attempt requires administrator review.\''),
  'Connect must map allowlisted backend codes to safe user messages');

assert(/function plaidMainConnectErrorMessage_[\s\S]{0,260}PLAID_MAIN_UNAVAILABLE_/.test(client),
  'Connect must fall back to the generic unavailable message for other failures');

assert(/function plaidMainConnect_[\s\S]{0,2800}plaidMainEndConnect_\(targetDomain\)[\s\S]{0,220}plaidMainSetStatus_\(targetDomain, plaidMainConnectErrorMessage_\(err\), true\)/.test(client) &&
  !/function plaidMainConnect_[\s\S]{0,2800}plaidMainConnectErrorMessage_\(err\), true\)[\s\S]{0,120}loadPlaidConnectedAccounts_/.test(client) &&
  !/function plaidMainConnect_[\s\S]{0,2800}plaidMainConnectErrorMessage_\(err\), true\)[\s\S]{0,120}plaidMainRenderDomain_/.test(client),
  'new-connect failure must not reload or replace existing connection cards');

assert(/function plaidMainConnect_[\s\S]{0,3200}handler\.open\(\)/.test(client) &&
  !/function plaidMainConnect_[\s\S]{0,3200}plaidImportInitializeConnection[\s\S]{0,400}plaidImportInitializeConnection/.test(client),
  'successful link-token response must open Plaid Link once without auto-retry');

assert(!/function plaidMainConnect_[\s\S]{0,4000}plaidImportPreviewMapped/.test(client) &&
  !/function plaidMainConnect_[\s\S]{0,4000}plaidImportApplyDebtUpdates/.test(client) &&
  !/function plaidMainConnect_[\s\S]{0,4000}plaidImportApplyCashUpdates/.test(client),
  'Connect must not invoke Import Data or Apply flows');

assert(/function plaidMainConnect_[\s\S]{0,4000}PLAID_MAIN_CONNECT_TIMEOUT_MS_/.test(client) &&
  /function plaidMainConnect_[\s\S]{0,4000}Connection session timed out/.test(client),
  'Connect must handle client timeout and re-enable the button');

assert(/function plaidMainAbandonPendingConnect_[\s\S]{0,500}plaidImportAbandonConnection/.test(client) &&
  /function plaidMainConnect_[\s\S]{0,4200}plaidMainAbandonPendingConnect_\(result\.correlationId/.test(client),
  'Connect onExit must abandon a still-pending link session before re-enabling');

assert(/function plaidMainCall_[\s\S]{0,260}connectionErrorCode/.test(client),
  'bridge responses must pass allowlisted connection error codes to the client');

console.log('Plaid main-app regressions passed.');
