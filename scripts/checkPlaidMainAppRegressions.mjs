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
  client.includes("'Apply Selected Updates'") &&
  client.includes('allowApplySelection') &&
  client.includes('plaidMainDebtApplySelectable_'),
  'Debt Apply selection UX is missing from Connected client');
assert(!client.includes('approvalToken'),
  'Apply must not use browser approval tokens');
assert(client.includes('Import Data = read-only provider retrieval'),
  'Connected client must document Import vs Apply contract');

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

console.log('Plaid main-app regressions passed.');
