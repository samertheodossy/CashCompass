import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import vm from 'node:vm';

const files = Object.fromEntries(await Promise.all([
  'Dashboard_Body.html',
  'Dashboard_Help.html',
  'Dashboard_Script_Activity.html',
  'Dashboard_Script_AssetsBankInvestments.html',
  'Dashboard_Script_AssetsHouseValues.html',
  'Dashboard_Script_BillsDue.html',
  'Dashboard_Script_CashFlowUpcoming.html',
  'Dashboard_Script_Donations.html',
  'Dashboard_Script_Income.html',
  'Dashboard_Script_Onboarding.html',
  'Dashboard_Script_Payments.html',
  'Dashboard_Script_PlanningDebts.html',
  'Dashboard_Script_PlanningDebtPayoff.html',
  'Dashboard_Script_PlanningNextActions.html',
  'Dashboard_Script_PlanningPurchaseSim.html',
  'Dashboard_Script_PlanningRetirement.html',
  'Dashboard_Script_PropertyPerformance.html',
  'Dashboard_Script_PropertiesHouseExpenses.html',
  'Dashboard_Script_Render.html',
  'Dashboard_Script_TrackedEditors.html',
  'Dashboard_Script_RollingDebtPayoff.html',
  'Dashboard_Styles.html',
  'BankAccountsUI.html',
  'DebtsUI.html',
  'HouseValuesUI.html',
  'house_values.js',
  'InvestmentsUI.html',
  'PlannerDashboard.html',
  'PlannerDashboardWeb.html',
  'ValidationTestingUI.html',
  'QuickAddPaymentUI.html',
  'quick_add_payment.js',
  'activity_log.js',
  'bank_accounts.js',
  'bills.js',
  'dashboard_data.js',
  'debts.js',
  'donations.js',
  'income_sources.js',
  'investments.js',
  'onboarding.js',
  'planner_helpers.js',
  'property_performance.js',
  'retirement.js',
  'rolling_debt_payoff.js',
  'upcoming_expenses.js',
  'test_harness_scenarios_bills.js',
  'test_harness_scenarios_house_financial_accuracy.js',
  'test_harness_scenarios.js',
  'test_harness_scenarios_quick_add.js',
  'AdminDiagnostics.html'
].map(async (name) => [name, await readFile(new URL(`../${name}`, import.meta.url), 'utf8')])));

const render = files['Dashboard_Script_Render.html'];
// Native browser dialogs are forbidden on every shipped/root HTML surface,
// not only the main dashboard script includes. Read the directory inventory so
// a newly added standalone UI or test console is covered automatically.
const browserHtmlNames = (await readdir(new URL('../', import.meta.url), { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
  .map((entry) => entry.name)
  .sort();
const browserUiSources = await Promise.all(browserHtmlNames.map(async (name) => [
  name,
  await readFile(new URL(`../${name}`, import.meta.url), 'utf8')
]));
for (const [name, source] of browserUiSources) {
  // Ignore explanatory comments while retaining scripts, inline handlers, and
  // executable markup. This avoids treating customer copy such as
  // "prompt (Select a category)" as a native prompt call.
  const executableSource = source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(executableSource, /window\s*\.\s*(?:alert|confirm|prompt)\b/,
    `${name} must not call, patch, or depend on browser-native dialogs`);
  assert.doesNotMatch(executableSource, /(?<![A-Za-z0-9_$.-])(?:alert|confirm|prompt)\s*\(/,
    `${name} must not call an inline, nested, or unqualified browser-native dialog`);
}
assert.match(files['Dashboard_Body.html'],
  /id="dashboard_confirm_dialog"[\s\S]*?role="dialog"[\s\S]*?aria-modal="true"[\s\S]*?id="dashboard_confirm_cancel_btn"[\s\S]*?id="dashboard_confirm_submit_btn"/,
  'The web dashboard must provide one accessible reusable CashCompass confirmation surface');
assert.equal(
  (files['Dashboard_Body.html'].match(/id=["']dashboard_confirm_backdrop["']/g) || []).length,
  1,
  'The web dashboard must render exactly one shared CashCompass confirmation surface'
);
const confirmationAncestors = openHtmlAncestorsAtId_(
  files['Dashboard_Body.html'],
  'dashboard_confirm_backdrop'
);
assert.equal(
  confirmationAncestors.some((ancestor) => ancestor.classes.includes('workspace-page')),
  false,
  'The shared confirmation must live outside every workspace page so it is visible from every surface'
);
assert.match(render,
  /function openDashboardConfirm_\(options\)[\s\S]*?cancel\.focus\(\)[\s\S]*?function closeDashboardConfirm_\(confirmed\)/,
  'The shared confirmation must focus the safe action and own cancel/confirm behavior');
for (const [name, action, writer] of [
  ['Dashboard_Script_AssetsHouseValues.html', 'stopTrackingHouse', 'deactivateHouseFromDashboard'],
  ['Dashboard_Script_AssetsBankInvestments.html', 'stopTrackingBank', 'deactivateBankAccountFromDashboard'],
  ['Dashboard_Script_AssetsBankInvestments.html', 'reactivateBankAccountFromManage_', 'reactivateBankAccountFromDashboard'],
  ['Dashboard_Script_AssetsBankInvestments.html', 'stopTrackingInvestment', 'deactivateInvestmentAccountFromDashboard'],
  ['Dashboard_Script_AssetsBankInvestments.html', 'reactivateInvestmentFromManage_', 'reactivateInvestmentAccountFromDashboard'],
  ['Dashboard_Script_Activity.html', 'activityDeleteClick_', 'deleteActivityLogRow'],
  ['Dashboard_Script_Income.html', 'stopTrackingIncomeSource', 'deactivateIncomeSourceFromDashboard'],
  ['Dashboard_Script_BillsDue.html', 'reactivateBillFromManage_', 'reactivateBillFromDashboard'],
  ['Dashboard_Script_PlanningDebts.html', 'stopTrackingDebtFromManage_', 'deactivateDebtFromDashboard'],
  ['Dashboard_Script_PlanningDebts.html', 'reactivateDebtFromManage_', 'reactivateDebtFromDashboard'],
  ['Dashboard_Script_PlanningDebts.html', 'stopTrackingDebt', 'deactivateDebtFromDashboard']
]) {
  const actionSource = functionSource_(files[name], action);
  assert.match(actionSource,
    new RegExp(`openDashboardConfirm_[\\s\\S]*?onConfirm:[\\s\\S]*?${writer}`),
    `${action} must defer ${writer} until the CashCompass confirmation is accepted`);
}
for (const [page, tab] of Object.entries({
  assets: 'houses',
  cashflow: 'payments',
  properties: 'houseExpenses',
  planning: 'capitalAllocationPreview'
})) {
  assert.match(render, new RegExp(`${page}:\\s*['\"]${tab}['\"]`), `${page} must have a default panel`);
}
assert.match(
  render,
  /targetTab\s*&&\s*!page\.querySelector\(['"]\.panel\.active['"]\)/,
  'Default navigation must preserve an explicitly active panel'
);
assert.match(render, /DASHBOARD_LAST_TAB_BY_PAGE_\[ownerPage\]\s*=\s*name/,
  'Subtab navigation must remember the selected panel for its workspace');
assert.match(render, /DASHBOARD_LAST_TAB_BY_PAGE_\[name\]\s*\|\|\s*defaultTab/,
  'Returning to a workspace must restore its most recent subtab before using the default');
for (const page of ['assets', 'cashflow', 'properties', 'planning']) {
  assert.match(files['Dashboard_Body.html'],
    new RegExp(`data-page=["']${page}["'][^>]*onclick=["']showWorkspacePage\\(["']${page}["']\\)`),
    `${page} top-level navigation must hydrate its visible lazy panel`);
}
const workspaceNavigationCalls = [];
const workspaceNavigationPage = {
  querySelector(selector) {
    assert.equal(selector, '.panel.active');
    return { id: 'payments' };
  }
};
const showWorkspacePage = Function(
  'document',
  'showPage',
  'showTab',
  `${functionSource_(render, 'showWorkspacePage')}; return showWorkspacePage;`
)(
  { getElementById: (id) => id === 'page_cashflow' ? workspaceNavigationPage : null },
  (name) => workspaceNavigationCalls.push(['page', name]),
  (name) => workspaceNavigationCalls.push(['tab', name])
);
showWorkspacePage('cashflow');
assert.deepEqual(workspaceNavigationCalls, [
  ['page', 'cashflow'],
  ['tab', 'payments']
], 'Cash Flow entry must hydrate a pre-active Quick Add panel');
workspaceNavigationCalls.length = 0;
showWorkspacePage('assets');
assert.deepEqual(workspaceNavigationCalls, [['page', 'assets']],
  'Workspace entry must not duplicate the default-tab hydration performed by showPage');
const initDashboardStart = files['PlannerDashboardWeb.html'].indexOf('function initDashboard()');
const initDashboardEnd = files['PlannerDashboardWeb.html'].indexOf('\n    // Expose', initDashboardStart);
const initDashboardBody = files['PlannerDashboardWeb.html'].slice(initDashboardStart, initDashboardEnd);
assert.ok(initDashboardStart >= 0 && initDashboardEnd > initDashboardStart,
  'Dashboard startup must remain statically testable');
assert.match(initDashboardBody, /refreshSnapshot\(\{\s*progressive:\s*true\s*\}\)/,
  'Dashboard startup must hydrate the visible Overview progressively');
for (const hiddenLoader of [
  'loadHouseSection', 'loadHouseExpensesSection', 'loadBankSection',
  'loadInvestmentSection', 'loadDebtSection', 'loadPaymentSection',
  'loadUpcomingSection', 'loadRetirementSection', 'loadPurchaseSimulatorSection',
  'loadDashboardActionSections', 'loadIncomeSourcesSection'
]) {
  assert.ok(!initDashboardBody.includes(`${hiddenLoader}(`),
    `Dashboard startup must not eagerly call hidden loader ${hiddenLoader}`);
}
assert.match(render,
  /function refreshSnapshot\(options\)[\s\S]*?requestDashboardOverviewCoreSnapshotWithRetry_\([\s\S]*?getDashboardSnapshot\(\)/,
  'Progressive startup must request core cards before the full Overview snapshot');
assert.match(render,
  /function requestDashboardOverviewCoreSnapshotWithRetry_\(options\)[\s\S]*?runReadOnlyRpcWithRetry_\([\s\S]*?getDashboardOverviewCoreSnapshot\(\)/,
  'Only the progressive Overview core read may recover once from a transient storage failure');
assert.match(render,
  /applyOverviewCoreSnapshot_\(data\);\s*requestDashboardOverviewDetailsAfterPaint_\(requestId,\s*data\s*&&\s*data\.continuationId\)/,
  'The full Overview request must begin only after the core response renders');
assert.match(render,
  /data && data\.cachedDetails[\s\S]*?applySnapshot\(data\.cachedDetails\)[\s\S]*?applyOverviewCoreSnapshot_\(data\)/,
  'Progressive Overview must paint cached lower details before restoring fresh top totals');
assert.match(files['dashboard_data.js'],
  /core\.cachedDetails = getCachedDashboardOverviewDetails_\(ss\)/,
  'Overview core must return only user- and workbook-scoped cached details');
assert.match(files['dashboard_data.js'],
  /const details = buildDashboardSnapshot_[\s\S]*?cacheDashboardOverviewDetails_\(ss, details\)[\s\S]*?return details/,
  'A completed background Overview read must refresh the short-lived detail cache');
assert.match(files['dashboard_data.js'],
  /CacheService\.getUserCache\(\)[\s\S]*?workbookId:\s*ss\.getId\(\)/,
  'Overview detail caching must remain user-scoped and workbook-scoped');
assert.match(render,
  /function requestDashboardOverviewDetailsAfterPaint_\(requestId, continuationId\)[\s\S]*?requestAnimationFrame[\s\S]*?requestAnimationFrame/,
  'Progressive startup must yield through a browser paint before background detail work');
assert.match(render,
  /function loadOverviewOperationalSummaries_\(\)[\s\S]*?getBillsDueFromCashFlowForDashboard\(\)[\s\S]*?getUpcomingExpensesUiData\(\)[\s\S]*?getHouseExpenseSummaryData\(\)/,
  'Overview startup must hydrate Bills and Operations from their authoritative summary reads');
const overviewOperationalLoader = functionSource_(render, 'loadOverviewOperationalSummaries_');
for (const hiddenRenderer of [
  'renderBillsList_', 'renderUpcomingList', 'renderHouseExpenseSummaryList_',
  'loadRecurringBillsUi_', 'loadActiveBillsManagementUi_'
]) {
  assert.ok(!overviewOperationalLoader.includes(hiddenRenderer),
    `Overview summaries must not render hidden workspace content via ${hiddenRenderer}`);
}
assert.match(render,
  /requestDashboardOverviewDetailsAfterPaint_\(requestId, data && data\.continuationId\);\s*requestOverviewOperationalSummariesAfterPaint_\(\)/,
  'Operational summaries must start after the authoritative top cards are painted');
assert.match(render,
  /applySnapshot\(data\);\s*runDashboardPostRenderMaintenance_\(\)/,
  'Maintenance must run only after the full Overview response is applied');
assert.match(render,
  /const requestId = \+\+overviewSnapshotRequestId_/,
  'Every Overview refresh must receive a monotonic request identity');
assert.ok((render.match(/requestId !== overviewSnapshotRequestId_/g) || []).length >= 3,
  'Core, background-detail, and failure callbacks must reject stale responses');
const showTabStart = render.indexOf('function showTab(name)');
const showTabEnd = render.indexOf('\nfunction toggleHealthExplainer', showTabStart);
const showTabBody = render.slice(showTabStart, showTabEnd);
for (const [tab, loader] of [
  ['houses', 'loadHouseSection'],
  ['bank', 'loadBankSection'],
  ['investments', 'loadInvestmentSection'],
  ['debts', 'loadDebtSection'],
  ['payments', 'loadPaymentSection'],
  ['upcoming', 'loadUpcomingSection'],
  ['billsDue', 'loadDashboardActionSections'],
  ['income', 'loadIncomeSourcesSection'],
  ['retirement', 'loadRetirementSection'],
  ['purchase', 'loadPurchaseSimulatorSection']
]) {
  assert.match(showTabBody,
    new RegExp(`name === ['"]${tab}['"][\\s\\S]*?${loader}\\(\\)`),
    `${tab} must hydrate ${loader} on tab entry`);
}
assert.match(render, /Financial plan refreshed/, 'Planner refresh must leave a success message');
assert.match(render, /planner_refresh_btn/, 'Planner refresh must guard against duplicate clicks');
const currencyUiSources = [
  render,
  files['PlannerDashboard.html'],
  files['QuickAddPaymentUI.html'],
  files['BankAccountsUI.html'],
  files['DebtsUI.html'],
  files['HouseValuesUI.html'],
  files['InvestmentsUI.html']
];
for (const source of currencyUiSources) {
  assert.match(source, /const sign = num < 0 \? '-' : '';/,
    'Currency formatters must calculate the sign separately');
  assert.match(source, /sign \+ '\$' \+ Math\.abs\(num\)\.toLocaleString\('en-US'/,
    'Currency formatters must place the sign before the dollar sign');
  assert.doesNotMatch(source, /return '\$' \+ num\.toLocaleString\('en-US'/,
    'Currency formatters must never render $-amount');
}

const dashboardMoneyFormatter = Function(
  `${functionSource_(render, 'fmtCurrency')}; return fmtCurrency;`
)();
const plannerMoneyFormatter = Function(
  `${functionSource_(files['planner_helpers.js'], 'fmtCurrency_')}; return fmtCurrency_;`
)();
const nextActionsMoneyFormatter = Function(
  `${functionSource_(files['Dashboard_Script_PlanningNextActions.html'], 'formatMoneyNextActions_')}; return formatMoneyNextActions_;`
)();
const activityMoneyFormatter = Function(
  `${functionSource_(files['activity_log.js'], 'activityLogFmtMoney_')}; return activityLogFmtMoney_;`
)();
const upcomingMoneyFormatter = Function(
  'round2_',
  'toNumber_',
  `${functionSource_(files['upcoming_expenses.js'], 'fmtMoneyForMessage_')}; return fmtMoneyForMessage_;`
)(value => Math.round(Number(value) * 100) / 100, value => Number(value));
const moneyFormatters = [
  ['Dashboard', dashboardMoneyFormatter],
  ['Planner server', plannerMoneyFormatter],
  ['Next Actions', nextActionsMoneyFormatter],
  ['Activity server', activityMoneyFormatter],
  ['Upcoming server message', upcomingMoneyFormatter]
];
for (const [label, formatter] of moneyFormatters) {
  assert.equal(formatter(0), '$0.00', `${label} must show zero with two decimals`);
  assert.equal(formatter(12.3), '$12.30', `${label} must show two decimal places`);
  assert.equal(formatter(1234.5), '$1,234.50', `${label} must group thousands`);
  assert.equal(formatter(-1234.5), '-$1,234.50',
    `${label} must put the negative sign before the dollar sign`);
}
assert.equal(dashboardMoneyFormatter(Infinity), '—',
  'The customer Dashboard must not render a non-finite amount as currency');
assert.match(files['Dashboard_Script_AssetsBankInvestments.html'],
  /balanceDisplay\s*=\s*\(r\.raw[\s\S]*?escapeHtml\(fmtCurrency\(r\.raw\.balance\)\)/,
  'Bank import preview balances must use the canonical Dashboard currency formatter');
assert.doesNotMatch(files['Dashboard_Script_AssetsBankInvestments.html'],
  /'\$'\s*\+\s*r\.raw\.balance/,
  'Bank import preview must not construct $-amount strings directly');
assert.match(files['activity_log.js'],
  /'Corrected from '\s*\+\s*activityLogFmtMoney_\(latestCorrection\.fromAmount\)/,
  'Activity correction history must use the canonical signed money formatter');
assert.match(files['rolling_debt_payoff.js'],
  /Remaining execute-now pool was '\s*\+\s*fmtCurrency_\(/,
  'Rolling payoff diagnostics must format execute-now money canonically');
assert.match(files['rolling_debt_payoff.js'],
  /income exceeds '\s*\+\s*fmtCurrency_\(ROLLING_DP_SD_REVIEW_LOSS_\)/,
  'Rolling payoff advisory thresholds must use canonical grouped currency');
assert.match(files['Dashboard_Script_PlanningDebtPayoff.html'], /\$0\.00 balance rows/,
  'Debt payoff empty guidance must show a two-decimal zero amount');
assert.match(files['Dashboard_Script_BillsDue.html'], /amount greater than \$0\.00/,
  'Bill Pay validation must show a two-decimal zero amount');
assert.match(files['property_performance.js'], /loan-payment totals are \$0\.00/,
  'Property performance unavailable guidance must show a two-decimal zero amount');
for (const source of [render, files['PlannerDashboard.html']]) {
  assert.match(source, /if \(num < 0\) return '-' \+ fmtCurrency\(Math\.abs\(num\)\);/,
    'Signed currency must place the minus sign before the dollar sign');
  assert.match(source,
    /function currencyFocus\(id,\s*selectAll\)[\s\S]*?selectAll === true[\s\S]*?input\.select\(\)/,
    'Currency focus must support opt-in whole-value replacement');

  const focusStart = source.indexOf('function currencyFocus(');
  const focusEnd = source.indexOf('function currencyBlur(', focusStart);
  assert.ok(focusStart >= 0 && focusEnd > focusStart,
    'Currency focus implementation must remain directly testable');
  const focusSource = source.slice(focusStart, focusEnd);
  let selectCount = 0;
  const input = {
    value: '$12,500.00',
    select() { selectCount += 1; }
  };
  const documentStub = {
    activeElement: input,
    getElementById(id) { return id === 'bank_value' ? input : null; }
  };
  const windowStub = { setTimeout(fn) { fn(); } };
  const toNumberStub = (value) => Number(String(value).replace(/[$,]/g, ''));
  const focus = Function(
    'document',
    'window',
    'toNumber',
    `${focusSource}; return currencyFocus;`
  )(documentStub, windowStub, toNumberStub);
  focus('bank_value', true);
  assert.equal(input.value, '12500',
    'Bank focus must expose the loaded balance as one raw numeric value');
  assert.ok(selectCount >= 1,
    'Bank focus must select the complete loaded balance for replacement');
}
assert.match(render, /Change vs ['"] \+ label \+ ': ' \+ fmtSignedCurrency\(num\)/,
  'Overview month deltas must use the signed-currency formatter');

const body = files['Dashboard_Body.html'];
const styles = files['Dashboard_Styles.html'];
const dashboardData = files['dashboard_data.js'];
const activityClient = files['Dashboard_Script_Activity.html'];
const paymentsClient = files['Dashboard_Script_Payments.html'];
const activityServer = files['activity_log.js'];
const activityRenderStart = activityClient.indexOf('function renderActivityTable_(');
const activityRenderEnd = activityClient.indexOf('function activityUpdatePagerUi_(', activityRenderStart);
assert.ok(activityRenderStart >= 0 && activityRenderEnd > activityRenderStart,
  'Activity must retain a directly testable table renderer');
const activityRenderSource = activityClient.slice(activityRenderStart, activityRenderEnd);
const activityWrap = { innerHTML: '' };
const renderActivityTableForRegression = Function(
  'document',
  'window',
  'activityHeaderLabel_',
  'activitySortRows_',
  'escapeHtml',
  'formatActivityLoggedAtDisplay_',
  'formatActivityDueDateDisplay_',
  'fmtCurrency',
  'toNumber',
  `${activityRenderSource}; return renderActivityTable_;`
)(
  { getElementById(id) { return id === 'act_tableWrap' ? activityWrap : null; } },
  { __activitySort: { key: 'loggedAt', dir: 'desc' } },
  (_key, label) => `<th>${label}</th>`,
  rows => rows,
  value => String(value),
  value => String(value || ''),
  value => String(value || ''),
  value => `$${Number(value).toFixed(2)}`,
  value => Number(value)
);
renderActivityTableForRegression([{
  loggedAt: '2026-07-26 07:40:00',
  payee: 'Planner',
  kindLabel: 'Planner',
  eventType: 'planner_email_sent',
  actionLabel: 'Email sent',
  amount: 0,
  amountNum: 0,
  isNonMonetary: true,
  entryDate: '',
  sheetRow: 2
}], { skipSort: true });
assert.match(activityWrap.innerHTML, /<th scope="col" class="activity-th-actions">Action<\/th>/,
  'Activity must use a neutral Action column heading');
assert.doesNotMatch(activityWrap.innerHTML, /<button[^>]*>[^<]*Remove/i,
  'Planner/email rows must not render a Remove action');
assert.doesNotMatch(activityWrap.innerHTML, /disabled/,
  'Unsupported Activity events must not render misleading disabled controls');

renderActivityTableForRegression([{
  loggedAt: '2026-07-26 07:41:00',
  payee: 'Test Charity',
  kindLabel: 'Donation',
  eventType: 'donation',
  actionLabel: '',
  amount: 25,
  amountNum: 25,
  isNonMonetary: false,
  entryDate: '2026-07-26',
  sheetRow: 2,
  operationId: 'fixture-donation-operation',
  correctionAction: 'correct_entry',
  correctionState: '',
  entryFamily: 'donation'
}], { skipSort: true });
assert.match(activityWrap.innerHTML,
  /data-operation-id="fixture-donation-operation"[^>]*data-entry-family="donation"[^>]*>Correct entry<\/button>/,
  'Eligible Donation rows must expose the shared Correct entry action');
assert.doesNotMatch(activityClient, /Remove\s*<span[^>]*>\(Donation\)/,
  'Activity must not restore the old Remove (Donation) column label');

renderActivityTableForRegression([{
  loggedAt: '2026-07-28 09:00:00',
  payee: 'Fixture Quick Add',
  kindLabel: 'Bill',
  eventType: 'quick_pay',
  actionLabel: '',
  amount: 40,
  amountNum: 40,
  isNonMonetary: false,
  entryDate: '2026-07-28',
  sheetRow: 3,
  operationId: 'fixture-operation',
  correctionAction: 'correct_entry',
  correctionState: ''
}], { skipSort: true });
assert.match(activityWrap.innerHTML,
  /data-operation-id="fixture-operation"[^>]*>Correct entry<\/button>/,
  'Eligible direct Quick Add rows must expose Correct entry');
assert.match(activityClient, /previewActivityEntryCorrection\(operationId\)/,
  'Correct entry must run the shared fresh server-side preview before enabling the writer');
assert.match(activityClient,
  /\.correctActivityEntry\(/,
  'The Activity drawer must call the shared guarded correction writer');
assert.match(styles,
  /\.dash-loading\[hidden\]\s*\{\s*display:\s*none\s*!important;/,
  'Hidden loading indicators must not be forced visible by dash-loading display rules');
assert.match(activityClient,
  /retireQuickAddWriteReceiptsForCorrection_\([\s\S]*?result,[\s\S]*?__activityCorrectionState\.operationId[\s\S]*?loadActivitySection/,
  'A completed correction must reconcile all browser receipts for its Cash Flow target before refreshing Activity');
assert.match(paymentsClient,
  /function retireQuickAddWriteReceipt_\(operationId\)[\s\S]*?quickAddRetiredWriteReceiptIds_\[id\]\s*=\s*true[\s\S]*?hideQuickAddWriteGuard_\(\)/,
  'Retiring a corrected Quick Add receipt must suppress stale in-flight checks and hide its write guard');
assert.match(paymentsClient,
  /function retireQuickAddWriteReceiptsForCorrection_\(result, operationId\)[\s\S]*?quickAddWriteReceiptTargetKey_\(receipt\) === targetKey[\s\S]*?quickAddRetiredWriteReceiptIds_\[id\]\s*=\s*true/,
  'Middle-entry correction must retire later browser receipts for the same Cash Flow target');
assert.match(activityClient,
  /retireQuickAddWriteReceiptsForCorrection_\([\s\S]*?refreshQuickAddAfterActivityCorrection_\(\)[\s\S]*?loadActivitySection/,
  'A completed correction must refresh the open Quick Add state before Activity finishes reloading');
assert.match(paymentsClient,
  /function loadPaymentPreview\(options\)[\s\S]*?requestSeq\s*=\s*\+\+quickAddPreviewRequestSeq_[\s\S]*?requestSeq !== quickAddPreviewRequestSeq_/,
  'Quick Add preview responses must be sequenced so a late pre-correction response cannot restore stale values');
assert.match(paymentsClient,
  /function loadPaymentSection\(\)[\s\S]*?uiDataRequestSeq\s*=\s*\+\+quickAddUiDataRequestSeq_[\s\S]*?uiDataRequestSeq !== quickAddUiDataRequestSeq_/,
  'Quick Add payee-list responses must be sequenced so a late cold-load response cannot clear reconciled form state');

const correctionRefreshStart = paymentsClient.indexOf(
  'function refreshQuickAddAfterActivityCorrection_(');
const correctionRefreshEnd = paymentsClient.indexOf(
  'function applyQuickAddPreviewFromResult_(', correctionRefreshStart);
assert.ok(correctionRefreshStart >= 0 && correctionRefreshEnd > correctionRefreshStart,
  'Post-correction Quick Add reconciliation must remain directly testable');
const correctionRefreshSource = paymentsClient.slice(
  correctionRefreshStart, correctionRefreshEnd);
const correctionElements = {
  pay_type: { value: 'Expense' },
  pay_payeeSelect: {
    value: '__OTHER__',
    options: [
      { value: '' },
      { value: 'Sequence expense' },
      { value: '__OTHER__' }
    ]
  },
  pay_payeeInput: { value: 'Sequence expense' },
  pay_date: { value: '2026-07-28' }
};
let correctionRefreshSuccess;
let correctionRefreshFailure;
let correctionRefreshPreview = null;
const runCorrectionRefresh = Function(
  'document',
  'google',
  'filterPaymentPayees',
  'loadPaymentPreview',
  'QUICK_ADD_PAYEE_OTHER_SENTINEL_',
  `var quickAddPreviewRequestSeq_ = 0;
   var quickAddUiDataRequestSeq_ = 0;
   ${correctionRefreshSource}
   var paymentPayees = [];
   return refreshQuickAddAfterActivityCorrection_;`
)(
  { getElementById(id) { return correctionElements[id] || null; } },
  {
    script: {
      run: {
        withSuccessHandler(handler) {
          correctionRefreshSuccess = handler;
          return this;
        },
        withFailureHandler(handler) {
          correctionRefreshFailure = handler;
          return this;
        },
        getQuickAddPaymentUiData() {}
      }
    }
  },
  () => {
    correctionElements.pay_payeeSelect.options = [
      { value: '' },
      { value: 'Sequence expense' },
      { value: '__OTHER__' }
    ];
  },
  options => {
    correctionRefreshPreview = {
      options,
      type: correctionElements.pay_type.value,
      selectedPayee: correctionElements.pay_payeeSelect.value,
      typedPayee: correctionElements.pay_payeeInput.value,
      date: correctionElements.pay_date.value
    };
  },
  '__OTHER__'
);
runCorrectionRefresh();
correctionElements.pay_type.value = 'Income';
correctionElements.pay_payeeSelect.value = '';
correctionElements.pay_payeeInput.value = 'Changed while waiting';
correctionElements.pay_date.value = '2026-08-01';
correctionRefreshSuccess({
  payees: [{ type: 'Expense', payee: 'Sequence expense' }]
});
assert.deepEqual(correctionRefreshPreview, {
  options: { quiet: true },
  type: 'Income',
  selectedPayee: '',
  typedPayee: 'Changed while waiting',
  date: '2026-08-01'
}, 'Activity correction must quietly refresh Quick Add without rolling back an in-flight user edit');
assert.equal(typeof correctionRefreshFailure, 'function',
  'A failed payee-list refresh must retain a quiet selected-payee preview fallback');

const correctionReceiptStart = paymentsClient.indexOf(
  'function quickAddWriteReceiptTargetKey_(');
const correctionReceiptEnd = paymentsClient.indexOf(
  'function registerQuickAddWriteReceipt_(', correctionReceiptStart);
assert.ok(correctionReceiptStart >= 0 && correctionReceiptEnd > correctionReceiptStart,
  'Correction receipt reconciliation must remain directly testable');
let storedCorrectionReceipts = [
  {
    operationId: 'later-$50',
    cashFlowSheet: 'INPUT - Cash Flow 2026',
    cashFlowMonth: 'Jul-26',
    entryType: 'Expense',
    payee: 'Sequence expense'
  },
  {
    operationId: 'unrelated',
    cashFlowSheet: 'INPUT - Cash Flow 2026',
    cashFlowMonth: 'Jul-26',
    entryType: 'Expense',
    payee: 'Other payee'
  }
];
let correctionGuardHidden = false;
const reconcileCorrectionReceipts = Function(
  'loadQuickAddWriteReceipts_',
  'saveQuickAddWriteReceipts_',
  'retireQuickAddWriteReceipt_',
  'hideQuickAddWriteGuard_',
  `${paymentsClient.slice(correctionReceiptStart, correctionReceiptEnd)}
   var quickAddRetiredWriteReceiptIds_ = {};
   var quickAddActiveWriteGuardId_ = 'later-$50';
   return {
     run: retireQuickAddWriteReceiptsForCorrection_,
     retired: quickAddRetiredWriteReceiptIds_
   };`
)(
  () => storedCorrectionReceipts.slice(),
  receipts => { storedCorrectionReceipts = receipts.slice(); },
  () => { throw new Error('target reconciliation must not use single-receipt fallback'); },
  () => { correctionGuardHidden = true; }
);
reconcileCorrectionReceipts.run({
  entry: {
    cashFlowSheet: 'INPUT - Cash Flow 2026',
    cashFlowMonth: 'Jul-26',
    entryType: 'Expense',
    payee: 'Sequence expense'
  }
}, 'middle-$25');
assert.deepEqual(
  storedCorrectionReceipts.map(receipt => receipt.operationId),
  ['unrelated'],
  'Reversing the middle entry must retire a later receipt for the corrected Cash Flow cell');
assert.equal(reconcileCorrectionReceipts.retired['later-$50'], true,
  'The later same-target receipt must suppress an already in-flight stale response');
assert.equal(reconcileCorrectionReceipts.retired['middle-$25'], true,
  'The selected middle operation must also suppress stale in-flight responses');
assert.equal(correctionGuardHidden, true,
  'A visible warning for a retired same-target receipt must close immediately');
assert.match(body,
  /id="activity_correction_success_values"/,
  'Correction success must keep a dedicated financial result summary');
assert.match(body,
  /class="bill-pay-confirmation activity-correction-confirmation"/,
  'Quick Add correction success must use its dedicated confirmation treatment');
assert.match(styles,
  /\.activity-correction-confirmation\s*\{[\s\S]*?background:\s*#eff6ff/,
  'Quick Add correction success must use the approved soft-blue surface');
assert.match(activityClient,
  /function renderActivityCorrectionSuccess_\(result\)[\s\S]*?Before correction[\s\S]*?Current value/,
  'Correction success must show the verified before and current values');
assert.doesNotMatch(body,
  /Only this amount will change after its recorded state is verified/,
  'Correction choices must not expose internal verification wording');
assert.match(activityClient,
  /function activityCorrectionImpactMoney_\(impact,\s*value,\s*entryType\)[\s\S]*?cash_flow_month[\s\S]*?Expense[\s\S]*?Math\.abs/,
  'Expense Cash Flow totals must display as positive customer amounts in correction panels');
assert.match(body,
  /Change amount[\s\S]*?Remove entry/,
  'The correction drawer must offer amount change and removal as distinct choices');
assert.match(body,
  /class="activity-correction-choice-copy"[\s\S]*?Change amount[\s\S]*?class="activity-correction-choice-copy"[\s\S]*?Remove entry/,
  'Both correction choices must use the compact shared label-and-description layout');
assert.match(styles,
  /\.activity-correction-choice-copy\s*\{[\s\S]*?grid-template-columns:\s*minmax\(120px,\s*0\.42fr\)\s+minmax\(0,\s*1fr\)/,
  'Desktop correction choices must align the action label beside its explanation');
assert.match(styles,
  /\.activity-correction-choice input\s*\{[\s\S]*?height:\s*16px[\s\S]*?width:\s*16px/,
  'Correction radios must override the full-width drawer input rule');
assert.match(styles,
  /@media\s*\(max-width:\s*640px\)[\s\S]*?\.activity-correction-choice-copy\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/,
  'Narrow correction choices must stack the explanation below the action label');
assert.match(styles,
  /#activity_correction_content > \.bill-pay-summary\s*\{[\s\S]*?margin-bottom:\s*26px[\s\S]*?\.activity-correction-choice\s*\{[\s\S]*?margin:\s*0 0 24px[\s\S]*?#activity_correction_amount_wrap\s*\{[\s\S]*?margin-bottom:\s*26px/,
  'Correction sections must keep deliberate vertical spacing');
assert.match(activityClient,
  /activityCorrectionMode_\(\)[\s\S]*?change_amount[\s\S]*?correctedAmount/,
  'Amount correction must send its explicit mode and corrected amount');

const correctionSuccessStart = activityClient.indexOf('function renderActivityCorrectionSuccess_(');
const correctionSuccessEnd = activityClient.indexOf('function activityCorrectionClick_(', correctionSuccessStart);
assert.ok(correctionSuccessStart >= 0 && correctionSuccessEnd > correctionSuccessStart,
  'Correction success renderer must remain directly testable');
const correctionSuccessRoot = { innerHTML: '' };
const renderCorrectionSuccess = Function(
  'document',
  'escapeHtml',
  'activityCorrectionMoney_',
  'activityCorrectionImpactMoney_',
  `${activityClient.slice(correctionSuccessStart, correctionSuccessEnd)}
   return renderActivityCorrectionSuccess_;`
)(
  { getElementById(id) { return id === 'activity_correction_success_values' ? correctionSuccessRoot : null; } },
  value => String(value),
  value => `${Number(value) < 0 ? '-' : ''}$${Math.abs(Number(value)).toFixed(2)}`,
  (impact, value, entryType) => `${impact.type === 'cash_flow_month' && entryType === 'Expense'
    ? ''
    : (Number(value) < 0 ? '-' : '')}$${Math.abs(Number(value)).toFixed(2)}`
);
renderCorrectionSuccess({
  entry: { amount: 25, cashFlowMonth: 'Jul-26', entryType: 'Expense' },
  impacts: [{
    type: 'cash_flow_month',
    label: 'Jul-26 Cash Flow total',
    currentValue: -125,
    restoredValue: -100
  }]
});
assert.match(correctionSuccessRoot.innerHTML,
  /Cash Flow month[\s\S]*?Jul-26[\s\S]*?Entry removed[\s\S]*?\$25\.00[\s\S]*?Before correction[\s\S]*?\$125\.00[\s\S]*?Current value[\s\S]*?\$100\.00/,
  'Correction success must reconcile the removed entry with customer-facing positive expense totals');

const writeReconcileStart = paymentsClient.indexOf(
  'function reconcileQuickAddWriteVerificationResults_(');
const writeReconcileEnd = paymentsClient.indexOf(
  'function verifyPendingQuickAddWrites_(', writeReconcileStart);
assert.ok(writeReconcileStart >= 0 && writeReconcileEnd > writeReconcileStart,
  'Quick Add verification reconciliation must remain directly testable');
const reconcileQuickAddVerification = Function(
  `${paymentsClient.slice(writeReconcileStart, writeReconcileEnd)}
   var quickAddRetiredWriteReceiptIds_ = {};
   return reconcileQuickAddWriteVerificationResults_;`
)();
const supersededVerification = reconcileQuickAddVerification(
  [{ operationId: 'new-$25', lastStatus: 'PENDING' }],
  [{ operationId: 'old-$100', status: 'CHANGED_TO_OTHER', currentValue: -125 }]
);
assert.deepEqual(
  supersededVerification.receipts.map(receipt => receipt.operationId),
  ['new-$25'],
  'A late verification response must not restore the superseded Quick Add receipt');
assert.deepEqual(supersededVerification.results, [],
  'A late result for a superseded Quick Add must not produce a false warning');
const currentVerification = reconcileQuickAddVerification(
  [{ operationId: 'new-$25', lastStatus: 'PENDING' }],
  [{ operationId: 'new-$25', status: 'MATCH', currentValue: -125 }]
);
assert.equal(currentVerification.receipts[0].lastStatus, 'MATCH',
  'The current Quick Add receipt must still accept its matching verification result');
const firstTransientMismatch = reconcileQuickAddVerification(
  [{
    operationId: 'new-$25',
    lastStatus: 'PENDING',
    mismatchCount: 0,
    lastMismatchKey: ''
  }],
  [{ operationId: 'new-$25', status: 'REVERTED_TO_PREVIOUS', currentValue: -100 }]
);
assert.equal(firstTransientMismatch.results[0].confirmedMismatch, false,
  'One eventually-consistent Quick Add read must remain provisional');
const confirmedMismatch = reconcileQuickAddVerification(
  firstTransientMismatch.receipts,
  [{ operationId: 'new-$25', status: 'REVERTED_TO_PREVIOUS', currentValue: -100 }]
);
assert.equal(confirmedMismatch.results[0].confirmedMismatch, true,
  'The same Quick Add mismatch must be observed twice before warning');
const recoveredVerification = reconcileQuickAddVerification(
  confirmedMismatch.receipts,
  [{ operationId: 'new-$25', status: 'MATCH', currentValue: -125 }]
);
assert.equal(recoveredVerification.receipts[0].mismatchCount, 0,
  'A matching read must clear provisional mismatch evidence');
assert.match(paymentsClient,
  /function chooseQuickAddWriteWarning_\(results\)[\s\S]*?confirmedMismatch === true/,
  'The yellow Quick Add warning must ignore a single provisional mismatch');
assert.match(paymentsClient,
  /options\.manual && provisionalMismatch[\s\S]*?600/,
  'A save-time verification must recheck a provisional mismatch before allowing or blocking the next entry');

renderActivityTableForRegression([{
  loggedAt: '2026-07-28 09:01:00',
  payee: 'Fixture Quick Add',
  kindLabel: 'Bill',
  eventType: 'quick_pay',
  actionLabel: 'Quick Add reversed',
  amount: 40,
  amountNum: 40,
  isNonMonetary: false,
  entryDate: '2026-07-28',
  sheetRow: 3,
  operationId: 'fixture-operation',
  correctionAction: '',
  correctionState: 'removed'
}], { skipSort: true });
assert.match(activityWrap.innerHTML,
  /activity-correction-state">Removed<\/span>/,
  'A removed direct Quick Add row must become a non-actionable Removed status');
assert.doesNotMatch(activityWrap.innerHTML,
  />Correct entry<\/button>/,
  'A reversed direct Quick Add row must not retain a correction button');

const nonDonationLogRow = [
  '2026-07-26 07:40:00',
  'planner_email_sent',
  '2026-07-26',
  0,
  '',
  'Planner',
  '',
  '',
  '',
  '',
  '',
  '{}'
];
const activityServerContext = {
  Logger: { log() {} },
  ScriptApp: {
    getService() {
      return {
        getUrl() {
          return 'https://script.google.com/macros/s/fixture-deployment-id/exec';
        }
      };
    }
  },
  Session: {
    getScriptTimeZone() { return 'America/Los_Angeles'; },
    getEffectiveUser() { return { getEmail() { return 'fixture@example.com'; } }; }
  },
  Utilities: {
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    Charset: { UTF_8: 'UTF_8' },
    computeDigest(_algorithm, value) {
      const text = String(value || '');
      return Array.from({ length: 32 }, (_v, i) =>
        (text.charCodeAt(i % Math.max(text.length, 1)) || 0) ^ i);
    },
    base64EncodeWebSafe(bytes) {
      return Buffer.from(bytes).toString('base64url');
    },
    getUuid: (() => {
      let sequence = 0;
      return () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
    })(),
    formatDate() { return '2026-07-28 12:00:00'; }
  },
  round2_(value) { return Math.round(Number(value) * 100) / 100; },
  toNumber_(value) { return Number(value) || 0; },
  normalizeBillName_(value) { return String(value || '').trim().toLowerCase(); },
  getCurrentUserEmail_() { return 'fixture@example.com'; },
  getUserSpreadsheet_() {
    return {
      getSheetByName() {
        return {
          getLastRow() { return 2; },
          getRange() {
            return { getValues() { return [nonDonationLogRow]; } };
          }
        };
      }
    };
  }
};
vm.runInNewContext(activityServer, activityServerContext);
assert.equal(
  activityServerContext.activityLogActionLabel_(
    'quick_pay',
    JSON.stringify({ activityOrigin: 'bill_payment' })
  ),
  'Bill paid',
  'Bills Due money movement must carry the customer-facing Bill paid label'
);
assert.equal(
  activityServerContext.activityLogActionLabel_(
    'quick_pay',
    JSON.stringify({ activityOrigin: 'direct_quick_add' })
  ),
  '',
  'Direct Quick Add must not be mislabeled as a Bills Due payment'
);
assert.equal(activityServerContext.activityLogHiddenFromDashboard_('bill_paid'), true,
  'The internal paid-occurrence marker must stay out of the customer-facing Activity table');
assert.equal(activityServerContext.activityLogHiddenFromDashboard_('quick_pay'), false,
  'The monetary Bills Due payment must remain visible in Activity');
const billPaymentActivityRows = [
  [
    '2026-07-31 08:06:00', 'quick_pay', '2026-07-31', 234, 'expense',
    'Fixture Bill', '', '', 'INPUT - Cash Flow 2026', 'Jul-26', '',
    JSON.stringify({ activityOrigin: 'bill_payment' })
  ],
  [
    '2026-07-31 08:06:01', 'bill_paid', '2026-07-31', 0, 'expense',
    'Fixture Bill', '', '', '', 'Jul-26', 'bill_paid::fixture',
    JSON.stringify({ source: 'bills_due_pay', occurrence: true, amount: 234 })
  ]
];
const originalActivitySpreadsheetResolver = activityServerContext.getUserSpreadsheet_;
activityServerContext.getUserSpreadsheet_ = () => ({
  getSheetByName(name) {
    if (name !== 'LOG - Activity') return null;
    return {
      getLastRow() { return billPaymentActivityRows.length + 1; },
      getRange() {
        return { getDisplayValues() { return billPaymentActivityRows; } };
      }
    };
  }
});
const billPaymentActivity = activityServerContext.getActivityDashboardData({
  dateFrom: '2026-07-31',
  dateTo: '2026-07-31',
  payeeSearch: 'Fixture Bill',
  kindType: 'Bill'
});
assert.equal(billPaymentActivity.ok, true,
  `Bills Pay Activity read model must load successfully: ${JSON.stringify(billPaymentActivity)}`);
assert.equal(billPaymentActivity.rows.length, 1,
  'One Bills Pay action must render as one customer-facing Activity row');
assert.equal(billPaymentActivity.rows[0].eventType, 'quick_pay',
  'The visible Bills Pay Activity row must be the monetary record');
assert.equal(billPaymentActivity.rows[0].amountNum, 234,
  'The visible Bills Pay Activity row must retain the payment amount');
assert.equal(billPaymentActivity.rows[0].actionLabel, 'Bill paid',
  'The visible Bills Pay Activity row must explain why the amount was recorded');
activityServerContext.getUserSpreadsheet_ = originalActivitySpreadsheetResolver;
const forgedActivityDeleteResult = activityServerContext.deleteActivityLogRow(2);
assert.equal(forgedActivityDeleteResult.ok, false,
  'Activity server must reject a forged non-Donation delete request');
assert.match(forgedActivityDeleteResult.error, /only enabled for Donation rows/i,
  'Activity server rejection must explain the donation-only contract');

const operationWorkbook = { getId() { return 'disposable-operation-workbook'; } };
const operationContext = activityServerContext.createActivityOperationContext_(
  operationWorkbook,
  'quick_pay'
);
const operationTarget = {
  targetVersion: 1,
  targetType: 'cash_flow_month',
  targetKey: 'cash_flow_month::fixture',
  locator: {
    sheetName: 'INPUT - Cash Flow 2026',
    entryType: 'Expense',
    payee: 'Fixture Bill',
    entryDate: '2026-07-28',
    month: 'Jul-26',
    rowCreated: false
  },
  before: { exists: true, value: -10, flowSource: 'CASH' },
  after: { exists: true, value: -25, flowSource: 'CASH' }
};
const firstOperationDetails = activityServerContext.buildActivityDetailsForAppend_(
  operationWorkbook,
  {
    eventType: 'quick_pay',
    details: JSON.stringify({ previousValue: -10, newValue: -25 }),
    operationEnvelope: {
      context: operationContext,
      correctable: true,
      targets: [operationTarget]
    }
  }
);
const secondOperationDetails = activityServerContext.buildActivityDetailsForAppend_(
  operationWorkbook,
  {
    eventType: 'quick_pay',
    operationEnvelope: {
      context: operationContext,
      correctable: true,
      targets: [operationTarget]
    }
  }
);
assert.equal(firstOperationDetails.operationEnvelope.operationId,
  secondOperationDetails.operationEnvelope.operationId,
  'Linked Activity events must preserve one server-owned operation ID');
assert.notEqual(firstOperationDetails.operationEnvelope.eventId,
  secondOperationDetails.operationEnvelope.eventId,
  'Every Activity event must receive its own event ID');
assert.equal(firstOperationDetails.previousValue, -10,
  'Operation metadata must preserve existing event-specific Details fields');
assert.deepEqual(
  JSON.parse(JSON.stringify(firstOperationDetails.writerProvenance)),
  {
    provenanceVersion: 1,
    source: 'web_app',
    deploymentId: 'fixture-deployment-id',
    deploymentMode: 'exec'
  },
  'Every new Activity row must retain the exact writer deployment ID in Details'
);
activityServerContext.ScriptApp.getService = () => ({
  getUrl() { return 'https://script.google.com/macros/s/fixture-development-id/dev'; }
});
assert.equal(
  activityServerContext.activityWriterProvenance_().deploymentMode,
  'dev',
  'Development-mode Activity writes must be distinguishable from production deployments'
);
activityServerContext.ScriptApp.getService = () => ({ getUrl() { return null; } });
assert.deepEqual(
  JSON.parse(JSON.stringify(activityServerContext.activityWriterProvenance_())),
  {
    provenanceVersion: 1,
    source: 'unavailable',
    deploymentId: '',
    deploymentMode: ''
  },
  'Unavailable service identity must remain explicit instead of guessing a deployment'
);
assert.doesNotMatch(
  files['Dashboard_Script_Activity.html'],
  /writerProvenance|deploymentId|deploymentMode/,
  'Writer deployment provenance must remain out of the CashCompass Activity display'
);
assert.equal(
  activityServerContext.parseActivityOperationEnvelope_(firstOperationDetails).status,
  'READY_FOR_PREVIEW',
  'A correctable operation requires a valid versioned before/after target'
);
assert.equal(
  activityServerContext.parseActivityOperationEnvelope_(
    JSON.stringify({ previousValue: -10, newValue: -25 })
  ).status,
  'LEGACY_READ_ONLY',
  'Historical Activity Details without an operation envelope must remain read-only'
);
assert.throws(
  () => activityServerContext.buildActivityDetailsForAppend_(
    operationWorkbook,
    {
      eventType: 'quick_pay',
      operationEnvelope: {
        context: operationContext,
        correctable: true,
        targets: [{
          targetVersion: 1,
          targetType: 'cash_flow_month',
          targetKey: 'incomplete',
          locator: {},
          before: {},
          after: {}
        }]
      }
    }
  ),
  /descriptor is incomplete/i,
  'Correctable Activity events must fail closed when target evidence is incomplete'
);
let operationCurrentState = operationTarget.after;
activityServerContext.inspectActivityOperationTargetInSpreadsheet_ = () => ({
  supported: true,
  status: 'READ',
  current: operationCurrentState
});
const operationLogRow = [
  '2026-07-28 12:00:00',
  'quick_pay',
  '2026-07-28',
  15,
  'expense',
  'Fixture Bill',
  '',
  '',
  'INPUT - Cash Flow 2026',
  'Jul-26',
  '',
  JSON.stringify(firstOperationDetails)
];
const previewWorkbook = {
  getId() { return 'disposable-operation-workbook'; },
  getSheetByName(name) {
    if (name !== 'LOG - Activity') return null;
    return {
      getLastRow() { return 2; },
      getRange() { return { getValues() { return [operationLogRow]; } }; }
    };
  }
};
const readyOperationPreview =
  activityServerContext.previewActivityOperationInSpreadsheet_(
    previewWorkbook,
    operationContext.operationId
  );
assert.equal(readyOperationPreview.status, 'READY',
  'Operation preview must authorize only after every target matches its recorded post-state');
operationCurrentState = { exists: true, value: -99, flowSource: 'CASH' };
const changedOperationPreview =
  activityServerContext.previewActivityOperationInSpreadsheet_(
    previewWorkbook,
    operationContext.operationId
  );
assert.equal(changedOperationPreview.status, 'PRECONDITION_FAILED',
  'Operation preview must fail closed after a target changes');
const wrongWorkbookPreview =
  activityServerContext.previewActivityOperationInSpreadsheet_(
    {
      getId() { return 'different-workbook'; },
      getSheetByName: previewWorkbook.getSheetByName
    },
    operationContext.operationId
  );
assert.equal(wrongWorkbookPreview.status, 'WORKBOOK_CHANGED',
  'Operation preview must reject an operation from another workbook');
assert.match(files['quick_add_payment.js'],
  /const operationContext = createActivityOperationContext_\(ss, 'quick_pay'\);[\s\S]*?addCashFlowMoneyToCellPreserveRowFormat_/,
  'Quick Add must create its server-owned operation ID before the first money write');
assert.match(files['quick_add_payment.js'],
  /operationEnvelope:\s*\{[\s\S]*?context:\s*operationContext[\s\S]*?correctable:\s*isDirectQuickAdd[\s\S]*?targets:\s*activityTargets/,
  'Quick Add must persist complete targets while limiting correction to explicit direct Quick Add');
assert.match(files['Dashboard_Script_Payments.html'],
  /activityOrigin:[\s\S]{0,180}'direct_quick_add'/,
  'Production Quick Add UI must explicitly identify direct Quick Add operations');
assert.match(files['activity_log.js'],
  /activityOrigin\s*!==\s*QUICK_ADD_ACTIVITY_ORIGIN_DIRECT_/,
  'Server correction preview must reject linked, unclassified, and legacy Quick Add operations');
assert.match(files['activity_log.js'],
  /function buildDirectQuickAddCorrectionPlanInSpreadsheet_[\s\S]*?activityQuickAddSimulateChain_\(targetType,\s*chain,\s*requested\)/,
  'Direct Quick Add correction must replay the verified operation chain while excluding only the selected entry');
assert.match(files['activity_log.js'],
  /writeActivityOperationTargetStateInSpreadsheet_\(\s*ss,\s*writes\[i\]\.target,\s*writes\[i\]\.desired\s*\)/,
  'Correction writer must apply the verified chain result instead of blindly restoring one historical before-state');
assert.match(files['activity_log.js'],
  /applied\[k\]\.current/,
  'Correction compensation must restore the exact state observed before the attempted correction');
assert.match(files['activity_log.js'],
  /function rollbackFailedActivityAppend_[\s\S]*?quick_pay_correction::[\s\S]*?quick_pay_replacement::/,
  'A failed Quick Add correction must compensate its exact in-flight Activity rows');
assert.match(files['activity_log.js'],
  /activityQuickAddReplacementWrites_[\s\S]*?change_amount[\s\S]*?replacementOperationId/,
  'Quick Add amount correction must create a linked current replacement operation');
assert.match(files['activity_log.js'],
  /activityCorrectionHistory_[\s\S]*?replacesOperationId/,
  'Activity must preserve expandable correction history behind the current logical entry');
assert.match(files['activity_log.js'],
  /activityLogRowHiddenByCorrectionRelations_[\s\S]*?superseded/,
  'Activity must hide superseded audit rows from the default logical-entry list');
assert.match(files['activity_log.js'],
  /entryDate:\s*String\(locator\.entryDate/,
  'Correction entry dates must come from the immutable target locator');
assert.match(files['activity_log.js'],
  /var rawMonth = locator\.month/,
  'Correction month labels must prefer the immutable target locator');

const cashChain = [
  {
    operation: {
      operationId: 'cash-100',
      corrected: false,
      entry: { entryType: 'Expense', amount: 100 }
    },
    target: {
      before: { exists: true, value: 0, flowSource: 'CASH' },
      after: { exists: true, value: -100, flowSource: 'CASH' }
    }
  },
  {
    operation: {
      operationId: 'cash-25',
      corrected: false,
      entry: { entryType: 'Expense', amount: 25 }
    },
    target: {
      before: { exists: true, value: -100, flowSource: 'CASH' },
      after: { exists: true, value: -125, flowSource: 'CASH' }
    }
  },
  {
    operation: {
      operationId: 'cash-50',
      corrected: false,
      entry: { entryType: 'Expense', amount: 50 }
    },
    target: {
      before: { exists: true, value: -125, flowSource: 'CASH' },
      after: { exists: true, value: -175, flowSource: 'CASH' }
    }
  }
];
assert.equal(
  activityServerContext.activityQuickAddSimulateChain_(
    'cash_flow_month',
    cashChain,
    'cash-25'
  ).value,
  -150,
  'Reversing the middle $25 entry must preserve the earlier $100 and later $50 entries'
);
cashChain[1].operation.corrected = true;
cashChain[1].operation.correctedAtSheetRow = 5;
cashChain[2].operation.sheetRow = 6;
cashChain[2].target.before = { exists: true, value: -100, flowSource: 'CASH' };
cashChain[2].target.after = { exists: true, value: -150, flowSource: 'CASH' };
assert.equal(
  activityServerContext.activityQuickAddSimulateChainAtRow_(
    'cash_flow_month',
    cashChain,
    6
  ).value,
  -100,
  'A later Quick Add must validate against the active total after an earlier correction'
);
assert.equal(
  activityServerContext.activityQuickAddSimulateChain_(
    'cash_flow_month',
    cashChain,
    'cash-100'
  ).value,
  -50,
  'A second correction must preserve the still-active later entry'
);
const debtChain = [
  {
    operation: {
      operationId: 'card-120',
      corrected: false,
      entry: { entryType: 'Expense', amount: 120 }
    },
    target: { before: { exists: true, value: 500 }, after: { exists: true, value: 380 } }
  },
  {
    operation: {
      operationId: 'card-25',
      corrected: false,
      entry: { entryType: 'Expense', amount: 25 }
    },
    target: { before: { exists: true, value: 380 }, after: { exists: true, value: 355 } }
  },
  {
    operation: {
      operationId: 'card-50',
      corrected: false,
      entry: { entryType: 'Expense', amount: 50 }
    },
    target: { before: { exists: true, value: 355 }, after: { exists: true, value: 305 } }
  }
];
assert.equal(
  activityServerContext.activityQuickAddSimulateChain_(
    'debt_balance',
    debtChain,
    'card-25'
  ).value,
  330,
  'Credit-card correction must preserve later verified balance reductions'
);

const quickAddWriterSource = files['quick_add_payment.js'].slice(
  files['quick_add_payment.js'].indexOf('function quickAddPayment('),
  files['quick_add_payment.js'].indexOf('function activitySnapshotCellValue_(')
);
assert.doesNotMatch(quickAddWriterSource, /computeQuickAddPriorMonthPreview_/,
  'Quick Add save must not block on presentation-only prior-month reads');
assert.doesNotMatch(quickAddWriterSource, /computeQuickAddHistoryPreview_/,
  'Quick Add save must not block on presentation-only history reads');

for (const source of [body, files['PlannerDashboard.html']]) {
  assert.match(source,
    /id=["']bank_value["'][^>]*onfocus=["']currencyFocus\(['"]bank_value["'],\s*true\)["']/,
    'Bank balance updates must select the loaded amount for safe replacement');
}
const overview = body.slice(
  body.indexOf('<div id="page_overview"'),
  body.indexOf('<div id="page_assets"')
);
const overviewSections = [
  'At a glance',
  'Financial outlook',
  'What needs your attention',
  'This week',
  'More insights'
];
let previousOverviewSection = -1;
for (const heading of overviewSections) {
  const position = overview.indexOf(`>${heading}</h2>`);
  assert.ok(position > previousOverviewSection,
    `Overview section must appear in the approved order: ${heading}`);
  previousOverviewSection = position;
}
assert.match(overview, /snapshot-card snapshot-card-primary[\s\S]*?Net Worth/,
  'Net Worth must be the primary Overview KPI');
assert.ok(
  overview.indexOf('id="snap_debt"') < overview.indexOf('id="snap_netWorth"'),
  'Desktop At a glance must place Net Worth after the four component KPIs'
);
for (const id of [
  'snap_netWorth',
  'snap_cash',
  'snap_investments',
  'snap_houseEquity',
  'snap_debt',
  'actions_list',
  'issues_root',
  'health_score',
  'ret_goal',
  'ret_age',
  'ret_mc',
  'runway_label',
  'ov_bills_dueSoonCount',
  'weekly_attrib_root',
  'incomeAlloc_income',
  'ov_bills_next7'
]) {
  assert.equal((overview.match(new RegExp(`id=["']${id}["']`, 'g')) || []).length, 1,
    `Overview must preserve exactly one renderer target for ${id}`);
}
assert.doesNotMatch(overview, /Open Workspaces/,
  'Overview must not duplicate the permanent workspace navigation');
assert.doesNotMatch(overview, /class=["'][^"']*(?:snapshot-grid|six-grid)/,
  'Overview must not return to the generic orphan-producing grids');
assert.doesNotMatch(overview, /Selected Scenario|Current Investable Assets/,
  'Retirement Outlook must stay condensed to its three decision-useful values');
for (const destination of [
  /showPage\('assets'\);\s*showTab\('bank'\)/,
  /showPage\('assets'\);\s*showTab\('investments'\)/,
  /showPage\('assets'\);\s*showTab\('houses'\)/,
  /showPage\('assets'\);\s*showTab\('debts'\)/,
  /showPage\('planning'\);\s*showTab\('retirement'\)/,
  /showPage\('cashflow'\);\s*showTab\('billsDue'\)/
]) {
  assert.match(overview, destination,
    'Overview detail affordances must route to their real workspace and tab');
}
assert.match(styles,
  /\.overview-kpi-grid,[\s\S]*?grid-template-columns:\s*repeat\(12,\s*minmax\(0,\s*1fr\)\)/,
  'Overview must use the intentional 12-column layout');
assert.match(styles, /\.snapshot-card-primary\s*\{[\s\S]*?grid-column:\s*span 4;/,
  'Net Worth must receive primary desktop width');
assert.match(styles,
  /@media \(max-width:\s*760px\)[\s\S]*?\.snapshot-card-supporting\s*\{\s*grid-column:\s*span 6;/,
  'Supporting KPIs must form a deliberate two-column mobile grid');
assert.match(styles,
  /@media \(max-width:\s*760px\)[\s\S]*?\.snapshot-card-primary\s*\{[\s\S]*?order:\s*-1;[\s\S]*?grid-column:\s*span 12;/,
  'Net Worth must return to the first position on narrow layouts');
assert.match(styles,
  /@media \(max-width:\s*460px\)[\s\S]*?\.snapshot-card-supporting\s*\{\s*grid-column:\s*span 12;/,
  'Supporting KPIs must stack at the narrowest width');
assert.match(styles,
  /@media \(max-width:\s*1180px\)[\s\S]*?\.tabs\.assets-tabs\s*\{\s*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/,
  'The four Assets & Liabilities tabs must remain in one balanced row at medium widths');
assert.match(styles,
  /@media \(max-width:\s*460px\)[\s\S]*?\.tabs\.assets-tabs\s*\{\s*grid-template-columns:\s*1fr;/,
  'Assets & Liabilities tabs must stack deliberately at the narrowest width');
assert.match(render,
  /fmtSignedCurrency\(num\)\s*\.replace\(\/\^\(\[\+\-\]\)\(\?=\\\$\)\//,
  'Overview deltas must keep their sign attached to the currency amount');
assert.ok(render.includes("'$1\\u2060'"),
  'Overview delta sign binding must use a nonbreaking word joiner');
assert.doesNotMatch(styles,
  /\.overview-grid\s*>\s*\.card\s*\{[^}]*height:\s*100%/,
  'Overview cards must rely on grid stretch instead of overflowing into the next section');
assert.match(styles,
  /\.overview-section-secondary\s*\{[\s\S]*?padding:\s*18px 0 0;[\s\S]*?border-top:/,
  'More insights must align to the full content width with only a quiet top divider');
assert.match(styles,
  /\.overview-allocation-card,\s*\.overview-operations-card\s*\{\s*grid-column:\s*span 6;/,
  'More insights cards must use a balanced 50/50 desktop split');
assert.match(render, /overview-positive-state[\s\S]*?No issues need attention/,
  'A healthy Overview must show a compact positive Issues state');

const healthContext = vm.createContext({
  Date,
  Math,
  Number,
  String,
  isNaN,
  parseInt,
  round2_: value => Math.round(Number(value) * 100) / 100,
  fmtCurrency_: value => `$${Number(value).toFixed(2)}`,
  parseMonthHeader_: value => {
    const match = String(value || '').match(/^([A-Za-z]{3})-(\d{2})$/);
    if (!match) return null;
    const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(match[1]);
    return month < 0 ? null : new Date(2000 + Number(match[2]), month, 1);
  }
});
vm.runInContext(dashboardData, healthContext);
vm.runInContext(
  'getPriorMonthPlannerHistoryMetrics_ = function() { return { metrics: null, label: "" }; };',
  healthContext
);
const healthFns = vm.runInContext(
  '({ buildFinancialHealthReadiness_, buildFinancialHealthScore_, computeFinancialHealthScoreNumber_ })',
  healthContext
);
const currentHealthMetrics = {
  runDate: '2026-07-27',
  runLabel: 'Current validation run',
  month: 'Jul-26',
  projectedCashFlow: 5000,
  usableCash: 50000,
  ccDebt: 0,
  totalDebt: 0,
  totalAssets: 100000,
  payoffAll: 0
};
const setupIncompleteHealth = healthFns.buildFinancialHealthScore_(
  currentHealthMetrics,
  null,
  {
    setupReadiness: { ready: false, completeCount: 1, total: 5 },
    now: new Date(2026, 6, 27)
  }
);
assert.equal(setupIncompleteHealth.score, null,
  'Financial Health must withhold a score while required Setup is incomplete');
assert.equal(setupIncompleteHealth.label, 'Setup incomplete',
  'Financial Health must explain that required Setup is incomplete');
assert.match(setupIncompleteHealth.summary, /1 of 5 required setup areas are ready/,
  'Financial Health must make prerequisite progress actionable');
const blankFirstRunHealth = healthFns.buildFinancialHealthScore_(
  null,
  null,
  {
    setupReadiness: { ready: false, completeCount: 0, total: 5 },
    now: new Date(2026, 6, 27)
  }
);
assert.equal(blankFirstRunHealth.label, 'Setup incomplete',
  'A blank first-run workbook must prioritize the required Setup action over missing planner history');

const staleHealth = healthFns.buildFinancialHealthScore_(
  { ...currentHealthMetrics, runDate: '2026-06-30', month: 'Jun-26' },
  null,
  {
    setupReadiness: { ready: true, completeCount: 5, total: 5 },
    now: new Date(2026, 6, 27)
  }
);
assert.equal(staleHealth.score, null,
  'Financial Health must withhold a score when the planner baseline is stale');
assert.equal(staleHealth.label, 'Needs refresh',
  'Financial Health must identify a stale baseline');
assert.match(staleHealth.summary, /Refresh your Financial Plan for Jul-26/,
  'Financial Health must name the current baseline month in its refresh action');

const contradictoryHealth = healthFns.buildFinancialHealthScore_(
  { ...currentHealthMetrics, projectedCashFlow: -300, usableCash: 0 },
  null,
  {
    setupReadiness: { ready: true, completeCount: 5, total: 5 },
    now: new Date(2026, 6, 27)
  }
);
assert.ok(contradictoryHealth.score <= 84,
  'Negative cash flow or non-positive usable cash must cap Financial Health below Strong');
assert.notEqual(contradictoryHealth.label, 'Strong',
  'Financial Health wording must not contradict the visible cash outlook');

const strongHealth = healthFns.buildFinancialHealthScore_(
  currentHealthMetrics,
  null,
  {
    setupReadiness: { ready: true, completeCount: 5, total: 5 },
    now: new Date(2026, 6, 27)
  }
);
assert.equal(strongHealth.label, 'Strong',
  'Financial Health must still show Strong for a complete, current, healthy baseline');
assert.equal(strongHealth.availability, 'ready',
  'Financial Health must expose its verified readiness state');
assert.match(dashboardData,
  /getOnboardingRequiredReadiness_\(ss,\s*['"]normal['"],\s*performanceTrace\)[\s\S]*?buildFinancialHealthScore_\(latestMetrics,\s*upcoming,\s*\{[\s\S]*?setupReadiness:/,
  'Overview must gate Financial Health with the shared required Setup contract');

for (const [pageId, title] of Object.entries({
  page_assets: 'Assets &amp; Liabilities',
  page_activity: 'Activity log',
  page_properties: 'Properties',
  page_planning: 'Planning'
})) {
  assert.match(
    body,
    new RegExp(`id=["']${pageId}["'][\\s\\S]*?class=["']workspace-page-intro["'][\\s\\S]*?<h2>${title}</h2>[\\s\\S]*?<p>[^<]+</p>`),
    `${title} must begin with the shared page title and purpose pattern`
  );
}
const cashFlowPageLead = body.slice(
  body.indexOf('id="page_cashflow"'),
  body.indexOf('id="payments"')
);
assert.doesNotMatch(cashFlowPageLead, /workspace-page-intro/,
  'Cash Flow must not repeat its selected top-level page title above the five action tabs');
assert.match(styles, /\.workspace-page-intro\s*\{[\s\S]*?margin:\s*0 0 var\(--cc-space-4\)/,
  'Workspace purpose lines must use the shared spacing rhythm');

const planning = body.slice(
  body.indexOf('<div id="page_planning"'),
  body.indexOf('<!--\n    Onboarding Phase 1')
);
assert.match(planning,
  /class="tabs planning-primary-tools"[\s\S]*?data-tab="capitalAllocationPreview"[\s\S]*?This week[\s\S]*?data-tab="rollingDebtPayoff"[\s\S]*?Rolling debt payoff[\s\S]*?data-tab="debtPayoff"[\s\S]*?Debt overview[\s\S]*?data-tab="retirement"[\s\S]*?Retirement[\s\S]*?data-tab="purchase"[\s\S]*?Purchase simulator/,
  'Planning must expose one five-tool primary selector with This Week first');
assert.match(planning,
  /role="tablist" aria-label="Planning tools"[\s\S]*?role="tab" aria-selected="true"[\s\S]*?aria-controls="capitalAllocationPreview"[\s\S]*?role="tabpanel" aria-labelledby="planning_tool_this_week"/,
  'Planning primary navigation must expose selected state and tab-to-panel relationships');
for (const tab of ['capitalAllocationPreview', 'rollingDebtPayoff', 'debtPayoff', 'retirement', 'purchase']) {
  assert.equal((planning.match(new RegExp(`data-tab=["']${tab}["']`, 'g')) || []).length, 1,
    `Planning must preserve exactly one navigation route for ${tab}`);
}
assert.doesNotMatch(planning, /planning-next-actions-feature|planning-tools-wrap|planning-tool-group--do-now|planning-tool-group--explore|data-tab="nextActions"/,
  'Planning must not expose the retired Start Here, grouped tool cards, or Next Actions navigation');
assert.doesNotMatch(planning, />\s*(?:Start here|Do now|Explore \/ model)\s*</i,
  'Planning must not retain obsolete grouping labels');
assert.match(planning, /id="nextActions" class="panel"/,
  'The legacy Next Actions panel must remain available for backend compatibility');
assert.doesNotMatch(planning,
  /data-tab="debts"/,
  'Planning navigation must not retain the balance-maintenance Debt accounts editor');
assert.match(planning,
  /id="debtPayoff"[\s\S]*?no account changes are made here\./,
  'Debt overview must clearly identify its read-only purpose');
assert.match(planning,
  /id="rollingDebtPayoff"[\s\S]*?actionable month-by-month payoff plan/,
  'Rolling debt payoff must clearly identify its action-planning purpose');
assert.equal((planning.match(/class="planning-advanced-details"/g) || []).length, 2,
  'Retirement and Purchase must each progressively disclose advanced assumptions');
assert.match(planning,
  /<details class="rolling-dp-json-wrap">[\s\S]*?Advanced: Raw JSON export/,
  'Rolling debt raw output must remain inside an explicitly advanced disclosure');
assert.match(styles,
  /\.tabs\.planning-primary-tools\s*\{[\s\S]*?grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/,
  'Planning primary tools must share one five-choice desktop selector');
assert.match(styles,
  /@media \(max-width:\s*760px\)[\s\S]*?\.tabs\.planning-primary-tools\s*\{[\s\S]*?overflow-x:\s*auto[\s\S]*?\.planning-primary-tools \.tab-btn\s*\{[\s\S]*?flex:\s*0 0 min\(210px,\s*72vw\)/,
  'Planning primary tools must remain readable in an accessible mobile scroll strip');
assert.match(render,
  /var legacyNextActionsRoute = name === 'nextActions'[\s\S]*?name = 'capitalAllocationPreview'[\s\S]*?__capitalAllocationActiveView = 'overview'/,
  'Legacy Next Actions routes must resolve to This Week Overview');
assert.match(render,
  /document\.querySelectorAll\('\.tab-btn'\)[\s\S]*?const tabBtn = document\.querySelector\('\.tab-btn\[data-tab="' \+ name \+ '\"\]'/,
  'Primary Planning selection must update the primary tab buttons without replacing This Week subview state');
assert.match(files['Dashboard_Script_Onboarding.html'],
  /function onboardingGoToThisWeek\(\)[\s\S]*?showTab\('capitalAllocationPreview'\)[\s\S]*?setCapitalAllocationView_\('overview'\)/,
  'Setup completion must route to This Week Overview');
assert.doesNotMatch(planning, /Go to Next Actions/,
  'Setup customer copy must not point to the retired Next Actions experience');

const assetsAndLiabilities = body.slice(
  body.indexOf('<div id="page_assets"'),
  body.indexOf('<div id="page_cashflow"')
);
assert.match(assetsAndLiabilities,
  /<h2>Assets &amp; Liabilities<\/h2>[\s\S]*?data-tab="bank"[^>]*>Bank accounts<\/button>[\s\S]*?data-tab="debts"[^>]*>Debts<\/button>[\s\S]*?data-tab="investments"[^>]*>Investments<\/button>[\s\S]*?data-tab="houses"[^>]*>Houses<\/button>/,
  'Assets & Liabilities must present Bank accounts, Debts, Investments, and Houses in the approved order');
assert.match(render,
  /function dashboardPageForTab_\(name\)[\s\S]*?name === 'investments' \|\| name === 'debts'\) return 'assets'/,
  'Debt accounts must belong to Assets & Liabilities navigation');
assert.match(render,
  /function mountDebtPanelInAssets_\(\)[\s\S]*?insertBefore\(panel, mount\)[\s\S]*?mountDebtPanelInAssets_\(\);/,
  'The unchanged Debt accounts subtree must mount into Assets & Liabilities before startup');
assert.match(render,
  /if \(name === 'houses' \|\| name === 'bank' \|\| name === 'investments' \|\| name === 'debts'\) \{\s*showPage\('assets'\)/,
  'Direct Debt account navigation must open Assets & Liabilities');
assert.match(body,
  /id="debt_panel_title">Debt accounts<[\s\S]*?showTab\('debtPayoff'\)[\s\S]*?showTab\('rollingDebtPayoff'\)/,
  'Debt accounts must link current source data to both Planning debt views');
assert.match(body,
  /id="debt_panel_title">Debt accounts<[\s\S]*?class="related-view-nav"[\s\S]*?View Debt Overview[\s\S]*?Open Rolling Payoff/,
  'Debt accounts must present related destinations as discoverable secondary buttons');
assert.match(planning,
  /id="debtPayoff"[\s\S]*?showTab\('debts'\)[\s\S]*?showTab\('rollingDebtPayoff'\)/,
  'Debt Overview must link to source Debt accounts and the monthly payoff plan');
assert.match(planning,
  /id="debtPayoff"[\s\S]*?class="related-view-nav"[\s\S]*?Manage Debt Accounts[\s\S]*?Open Rolling Payoff/,
  'Debt Overview must present both related destinations as secondary buttons');
assert.match(planning,
  /id="rollingDebtPayoff"[\s\S]*?showTab\('debts'\)[\s\S]*?showTab\('debtPayoff'\)/,
  'Rolling Debt Payoff must link to source Debt accounts and the read-only overview');
assert.match(planning,
  /id="rollingDebtPayoff"[\s\S]*?class="related-view-nav"[\s\S]*?Manage Debt Accounts[\s\S]*?View Debt Overview/,
  'Rolling Debt Payoff must present both related destinations as secondary buttons');
assert.equal((body.match(/class="related-view-nav"/g) || []).length, 3,
  'The three Debt surfaces must use the same related-view navigation pattern');
assert.match(files['Dashboard_Script_Onboarding.html'],
  /function onboardingOpenDebtsPage\(\)[\s\S]*?enterSetupEditorMode\('assets', 'debts', 'debts'\)/,
  'Setup Debt handoff must open Assets & Liabilities → Debt accounts');
assert.doesNotMatch(files['Dashboard_Script_Onboarding.html'],
  /enterSetupEditorMode\('planning', 'debts', 'debts'\)/,
  'Setup Debt handoff must not route through the obsolete Planning workspace');
assert.match(body,
  /onclick="onboardingOpenDebtsPage\(\)">Open Debt accounts<\/button>/,
  'Setup must name the Debt accounts destination explicitly');
assert.doesNotMatch(files['Dashboard_Help.html'],
  /Planning → Debts/,
  'Help must not direct users to the obsolete Planning → Debts path');
assert.ok(
  (files['Dashboard_Help.html'].match(/Assets &amp; Liabilities → Debt accounts/g) || []).length >= 4,
  'Help must consistently identify Assets & Liabilities → Debt accounts as the maintenance destination'
);
assert.match(files['Dashboard_Script_Activity.html'],
  /activityHeaderLabel_\('dueDate', 'Date'\)/,
  'Activity must label its generic Entry Date column as Date');
assert.doesNotMatch(files['Dashboard_Script_Activity.html'],
  /activityHeaderLabel_\('dueDate', 'Bill due date'\)/,
  'Activity must not describe every entry date as a Bill due date');

assert.match(styles, /\.status:not\(:empty\)\s*\{[\s\S]*?border:[\s\S]*?background:/,
  'Non-empty statuses must use the shared visible status surface');
assert.match(styles, /\.status\.error:not\(:empty\)\s*\{[\s\S]*?background:\s*#fff1f2/,
  'Error statuses must use the shared error treatment');
assert.match(body,
  /class="tabs cashflow-tabs"[\s\S]*?class="tab-btn active" data-tab="payments"[\s\S]*?data-tab="upcoming"[\s\S]*?data-tab="income"/,
  'Cash Flow must keep Quick add first within one compact navigation row');
assert.match(styles,
  /\.tabs\.cashflow-tabs\s*\{[\s\S]*?grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/,
  'Cash Flow must use the original balanced five-tab navigation row');
assert.match(styles,
  /\.cashflow-tabs \.tab-btn\s*\{[\s\S]*?min-height:\s*46px;[\s\S]*?font-size:\s*14px;[\s\S]*?font-weight:\s*700;/,
  'Cash Flow tabs must remain comfortably sized and readable');
assert.match(styles,
  /#page_cashflow \.info\s*\{[\s\S]*?font-size:\s*14px;[\s\S]*?line-height:\s*1\.6;/,
  'Cash Flow information panels must use readable body typography');
assert.match(styles,
  /#page_cashflow \.info \.cashflow-column-title\s*\{[\s\S]*?font-size:\s*16px;/,
  'Cash Flow information-panel headings must remain visually prominent');
assert.doesNotMatch(body, /cashflow-tools-label|cashflow-feature-description/,
  'Cash Flow must not reintroduce a second navigation label or banner description');
assert.doesNotMatch(body + '\n' + styles, /cashflow-primary-tab/,
  'Quick add must not use a competing featured-tab treatment');
assert.match(body,
  /Quick Add adds the entered amount to this payee’s total for the selected month\.[\s\S]*?It does not replace an amount already recorded\./,
  'Quick Add must explain that the entered amount is cumulative rather than a replacement');
assert.match(files['Dashboard_Help.html'],
  /Quick add<\/strong> adds an income or expense amount to the selected payee’s existing total for that month\. It does not replace an amount already recorded\./,
  'Quick Add Help must preserve the same cumulative-write contract');
assert.match(body,
  /<strong>Dismiss<\/strong> removes an item from active planning without recording a payment or changing Cash Flow\. Its Upcoming row and Activity history remain\./,
  'Upcoming must explain Dismiss consequences before the user acts');
assert.match(body,
  /id="upcoming_dismiss_guidance"[^>]*class="panel-purpose upcoming-dismiss-note"[^>]*><strong>Dismiss<\/strong>/,
  'Upcoming Dismiss consequences must use a distinct information treatment');
assert.match(styles,
  /\.upcoming-dismiss-note\s*\{[\s\S]*?color:\s*#7a4b00;[\s\S]*?background:\s*#fff8e1;[\s\S]*?border-left:\s*4px solid #d6a23d;/,
  'Upcoming Dismiss guidance must remain a calm amber notice rather than destructive red');
assert.match(files['Dashboard_Script_CashFlowUpcoming.html'],
  /Remove from active planning without recording a payment; history is preserved[\s\S]*?>Dismiss<\/button>/,
  'Each Upcoming Dismiss action must retain concise consequence guidance');
assert.match(files['upcoming_expenses.js'],
  /message:\s*'Dismissed from active planning\. No payment was recorded; history was preserved\.'/,
  'Upcoming Dismiss success must confirm that no payment was recorded and history remains');
assert.match(files['quick_add_payment.js'],
  /addCashFlowMoneyToCellPreserveRowFormat_\(sheet,\s*rowInfo\.row,\s*monthCol,\s*signedAmount,\s*3\)/,
  'Quick Add must remain cumulative so its customer-facing add-not-replace copy stays truthful');
for (const sourceUi of [body, files['QuickAddPaymentUI.html']]) {
  assert.match(sourceUi, /Payment source[\s\S]*?value="CASH"[\s\S]*?value="CREDIT_CARD"/,
    'Quick Add must offer Cash and Credit card when a new Expense row needs a source');
  assert.match(sourceUi, /Required for a new Expense or an existing Expense with no source\./,
    'Quick Add must explain why payment source is required');
}
assert.match(files['Dashboard_Script_Payments.html'],
  /updateQuickAddFlowSourceVisibility_\(\) && !flowSource[\s\S]*?Choose Cash or Credit card for this new expense/,
  'Dashboard Quick Add must block a new Expense until a source is selected');
assert.match(files['Dashboard_Script_Payments.html'], /flowSource:\s*flowSource/,
  'Dashboard Quick Add must send the selected source to the writer');
assert.match(files['quick_add_payment.js'],
  /!flowSource && isDirectQuickAdd && entryType === 'Expense'[\s\S]*?Payment source is required/,
  'The writer must reject stale direct clients that omit a new Expense source');
assert.match(files['quick_add_payment.js'],
  /!flowSource && entryType === 'Income'[\s\S]*?flowSource = 'CASH'/,
  'New Income rows must receive the canonical CASH source');
assert.match(files['quick_add_payment.js'],
  /preview:\s*\{[\s\S]*?existingFlowSource:\s*newFlowSource/,
  'Quick Add success must return the persisted source so the repaired prompt clears');
const quickAddNeedsFlowSource = Function(
  `${functionSource_(files['Dashboard_Script_Payments.html'], 'quickAddNeedsFlowSource_')}; return quickAddNeedsFlowSource_;`
)();
assert.equal(quickAddNeedsFlowSource('Expense', 'New expense', true, false, '', ''), true,
  'A new direct Expense must request a source');
assert.equal(quickAddNeedsFlowSource('Expense', 'Existing expense', true, true, 'CASH', ''), false,
  'An existing Expense must keep its stored source without prompting');
assert.equal(quickAddNeedsFlowSource('Expense', 'Incomplete expense', true, true, '', ''), true,
  'An existing Expense with a blank source must request a one-time repair');
assert.equal(quickAddNeedsFlowSource('Income', 'New income', true, false, '', ''), false,
  'Income must not ask for a credit-card funding source');
assert.equal(quickAddNeedsFlowSource('Expense', 'Linked bill', true, false, '', 'CASH'), false,
  'A linked workflow with an authoritative source must not prompt again');
assert.match(files['test_harness_scenarios_quick_add.js'],
  /Harness New Source Required[\s\S]*?missingSourceRow[\s\S]*?flowSource:\s*'CREDIT_CARD'[\s\S]*?incomeFlowSource/,
  'The disposable Quick Add harness must prove missing-source rejection and source persistence');
assert.match(files['planner_helpers.js'],
  /function addCashFlowMoneyToCellPreserveRowFormat_\([\s\S]*?cell\.setValue\(round2_\(currentValue \+ addValue\)\)/,
  'The Cash Flow add helper must retain its cumulative-value contract');
const upcomingServer = files['upcoming_expenses.js'];
const dismissUpcomingStart = upcomingServer.indexOf('function dismissUpcomingExpense(id)');
const dismissUpcomingEnd = upcomingServer.indexOf('/**', dismissUpcomingStart + 1);
assert.ok(dismissUpcomingStart >= 0 && dismissUpcomingEnd > dismissUpcomingStart,
  'Upcoming must expose a bounded Dismiss lifecycle function');
const dismissUpcomingSlice = upcomingServer.slice(dismissUpcomingStart, dismissUpcomingEnd);
assert.match(dismissUpcomingSlice, /\.setValue\('Dismissed'\)/,
  'Upcoming Dismiss must remain a status-only soft removal');
assert.match(dismissUpcomingSlice, /appendUpcomingActivityStatus_/,
  'Upcoming Dismiss must preserve an Activity lifecycle record');
assert.doesNotMatch(dismissUpcomingSlice,
  /quickAddPayment|addCashFlowMoneyToCellPreserveRowFormat_|setCashFlowMoneyCellPreserveRowFormat_/,
  'Upcoming Dismiss must never record a payment or change Cash Flow');
const addUpcomingStart = upcomingServer.indexOf('function addUpcomingExpense(payload)');
const addUpcomingEnd = upcomingServer.indexOf('function findUpcomingExpenseFormattingTemplateRow_', addUpcomingStart);
assert.ok(addUpcomingStart >= 0 && addUpcomingEnd > addUpcomingStart,
  'Upcoming must expose a bounded add workflow before its row-format helpers');
const addUpcomingSlice = upcomingServer.slice(addUpcomingStart, addUpcomingEnd);
assert.match(addUpcomingSlice,
  /const formatTemplateRow = findUpcomingExpenseFormattingTemplateRow_\(sheet\)[\s\S]*?\.setValues\([\s\S]*?applyNewUpcomingExpenseRowFormatting_\(sheet,\s*row,\s*formatTemplateRow\)[\s\S]*?setNumberFormat\('yyyy-mm-dd'\)[\s\S]*?applyCurrencyFormat_/,
  'Upcoming Add must format only the appended row and then reassert date/currency formats');
const upcomingFormatStart = upcomingServer.indexOf('function applyNewUpcomingExpenseRowFormatting_(');
const upcomingFormatEnd = upcomingServer.indexOf('/**\n * Dismiss an Upcoming row', upcomingFormatStart);
assert.ok(upcomingFormatStart >= 0 && upcomingFormatEnd > upcomingFormatStart,
  'Upcoming must expose a bounded new-row formatting helper');
const upcomingFormatSlice = upcomingServer.slice(upcomingFormatStart, upcomingFormatEnd);
assert.match(upcomingFormatSlice,
  /SpreadsheetApp\.CopyPasteType\.PASTE_FORMAT[\s\S]*?setRowHeight\(newRow,\s*sheet\.getRowHeight\(templateRow\)\)/,
  'Upcoming Add must inherit sibling formatting and row height without copying values');
assert.match(upcomingFormatSlice,
  /setFontSize\(CANON_FONT_BODY_\)[\s\S]*?setVerticalAlignment\(CANON_VERTICAL_ALIGNMENT_\)[\s\S]*?setRowHeight\(newRow,\s*CANON_ROW_HEIGHT_BODY_\)/,
  'The first Upcoming data row must receive the canonical body-row fallback');
assert.doesNotMatch(upcomingFormatSlice,
  /applyUpcomingExpensesSheetStyling_|applyOperationalFlatSheetStyling_|setValues\(|setValue\(|appendRow\(|insertRow/,
  'Upcoming row-format inheritance must not restyle the sheet or write workbook data');
const billsSheetServer = files['bills.js'];
const billsPreviousFormatStart = billsSheetServer.indexOf('function copyBillsRowFormattingFromPreviousRow_(');
const billsPreviousFormatEnd = billsSheetServer.indexOf('function findBillsSortedInsertRow_(', billsPreviousFormatStart);
assert.ok(billsPreviousFormatStart >= 0 && billsPreviousFormatEnd > billsPreviousFormatStart,
  'Bills must expose bounded append-row formatting helpers');
const billsAppendFormatSlice = billsSheetServer.slice(billsPreviousFormatStart, billsPreviousFormatEnd);
assert.match(billsAppendFormatSlice,
  /SpreadsheetApp\.CopyPasteType\.PASTE_FORMAT[\s\S]*?setRowHeight\(newRow,\s*sheet\.getRowHeight\(sourceRow\)\)/,
  'Appended Bills rows must inherit sibling format and row height');
const billsInsertFormatStart = billsSheetServer.indexOf('function copyBillsRowFormattingFromInsertSiblingRow_(');
const billsFallbackEnd = billsSheetServer.indexOf('// Canonical widen widths', billsInsertFormatStart);
assert.ok(billsInsertFormatStart >= 0 && billsFallbackEnd > billsInsertFormatStart,
  'Bills must expose sorted-insert and canonical fallback formatting');
const billsInsertFormatSlice = billsSheetServer.slice(billsInsertFormatStart, billsFallbackEnd);
assert.match(billsInsertFormatSlice,
  /SpreadsheetApp\.CopyPasteType\.PASTE_FORMAT[\s\S]*?setRowHeight\(newRow,\s*sheet\.getRowHeight\(sourceRow\)\)/,
  'Sorted Bills rows must inherit sibling format and row height');
assert.match(billsInsertFormatSlice,
  /function applyBillsNewRowCanonicalFallback_[\s\S]*?setFontSize\(CANON_FONT_BODY_\)[\s\S]*?setRowHeight\(newRow,\s*CANON_ROW_HEIGHT_BODY_\)/,
  'The first Bills data row must receive the canonical body-row fallback');
const debtsServer = files['debts.js'];
const addDebtStart = debtsServer.indexOf('function addDebtFromDashboard(');
const addDebtEnd = debtsServer.indexOf('function deactivateDebtFromDashboard(', addDebtStart);
assert.ok(addDebtStart >= 0 && addDebtEnd > addDebtStart,
  'Debts must expose a bounded Add workflow');
const addDebtSlice = debtsServer.slice(addDebtStart, addDebtEnd);
assert.match(addDebtSlice,
  /legacy\/header-only sheet with no summary row[\s\S]*?setFontSize\(CANON_FONT_BODY_\)[\s\S]*?setVerticalAlignment\(CANON_VERTICAL_ALIGNMENT_\)[\s\S]*?setRowHeight\(appendedRow,\s*CANON_ROW_HEIGHT_BODY_\)/i,
  'A first Debt row in a legacy header-only sheet must receive canonical body formatting');
assert.doesNotMatch(addDebtSlice,
  /leave default formatting/,
  'No Add Debt path may deliberately leave a new data row at Google Sheets defaults');
const donationsServer = files['donations.js'];
const addDonationStart = donationsServer.indexOf('function addDonation(');
const addDonationEnd = donationsServer.indexOf('function tryDeleteDonationRowForActivityUndo_(', addDonationStart);
assert.ok(addDonationStart >= 0 && addDonationEnd > addDonationStart,
  'Donations must expose a bounded Add workflow');
const addDonationSlice = donationsServer.slice(addDonationStart, addDonationEnd);
assert.match(addDonationSlice,
  /SpreadsheetApp\.CopyPasteType\.PASTE_FORMAT[\s\S]*?setRowHeight\(row1,\s*sheet\.getRowHeight\(formatSourceRow1\)\)/,
  'Donation rows must inherit sibling format and row height');
assert.match(addDonationSlice,
  /setFontSize\(CANON_FONT_BODY_\)[\s\S]*?setVerticalAlignment\(CANON_VERTICAL_ALIGNMENT_\)[\s\S]*?setRowHeight\(row1,\s*CANON_ROW_HEIGHT_BODY_\)/,
  'The first Donation row in a year block must receive canonical body formatting');
assert.match(addDonationSlice,
  /const dateCol[\s\S]*?setNumberFormat\('M\/d\/yyyy'\)[\s\S]*?setNumberFormat\('\$#,##0\.00'\)/,
  'Donation Add must reassert date and currency formats after row styling');
assert.match(addDonationSlice,
  /createActivityOperationContext_\(ss,\s*'donation'\)[\s\S]*?targetType:\s*'donation_row'[\s\S]*?activityOrigin:\s*'direct_donation'/,
  'New donations must receive a complete correctable operation envelope');
assert.match(donationsServer,
  /function correctDonationOperationInSpreadsheet_[\s\S]*?change_amount[\s\S]*?donation_correction::[\s\S]*?donation_replacement::/,
  'Donation correction must support linked amount replacement with immutable correction evidence');
assert.match(donationsServer,
  /donation_replacement::[\s\S]*?rollbackFailedActivityAppend_/,
  'A failed donation correction must compensate its exact in-flight Activity rows');
assert.match(donationsServer,
  /initialSheetRow[\s\S]*?donationDataRowMatchesActivityUndo_[\s\S]*?matches:\s*\[initialSheetRow\]/,
  'Donation correction must verify the recorded row before fingerprint fallback');
assert.match(donationsServer,
  /function donationSheetDateFromIso_[\s\S]*?getSpreadsheetTimeZone[\s\S]*?Utilities\.parseDate[\s\S]*?12:00:00/,
  'Donation dates must be written as calendar dates in the workbook timezone');
assert.match(donationsServer,
  /function donationActivityEntrySummary_[\s\S]*?targetEntryDate[\s\S]*?activityLogEntryDateToYyyyMmDd_/,
  'Donation correction previews must prefer the immutable calendar date target');
assert.match(files['test_harness_scenarios_quick_add.js'],
  /Harness Amount Edit[\s\S]*?change_amount[\s\S]*?40[\s\S]*?change_amount[\s\S]*?45[\s\S]*?'remove'/,
  'The disposable Quick Add harness must edit a middle amount repeatedly and then remove the current replacement');
assert.match(files['test_harness_scenarios.js'],
  /REGRESSION-DONATION-CORRECTION[\s\S]*?change_amount[\s\S]*?125[\s\S]*?change_amount[\s\S]*?150[\s\S]*?'remove'/,
  'The disposable donation harness must edit a donation repeatedly, remove it, and retain audit evidence');
assert.match(files['test_harness_scenarios.js'],
  /state\.identical[\s\S]*?Identical donation rows retain distinct correctable identities/,
  'The disposable donation harness must prove identical rows remain independently correctable');
assert.match(files['test_harness_scenarios.js'],
  /state\.storedDate[\s\S]*?Donation date remains the selected calendar day/,
  'The disposable donation harness must prove the selected date does not shift across timezones');
assert.match(files['Dashboard_Script_Payments.html'],
  /function setQuickAddSuccessStatus_\([\s\S]*?classList\.add\(['"]status-success['"]\)/,
  'Quick Add completion must use an explicit success treatment');
assert.match(styles, /\.status\.status-success:not\(:empty\)\s*\{[\s\S]*?background:\s*#f0fdf4/,
  'Successful Quick Add feedback must use the shared success surface');
assert.match(body,
  /id="pay_history_wrap"[^>]*hidden[\s\S]*?id="pay_history_chart"/,
  'Quick Add history must remain contextual and hidden until a known payee is previewed');
assert.match(files['Dashboard_Script_Payments.html'],
  /function renderPaymentHistoryChart_\([\s\S]*?Array\.isArray\(data\.history\)[\s\S]*?wrap\.hidden = false[\s\S]*?function renderQuickAddHistory_\([\s\S]*?renderPaymentHistoryChart_\('pay_history_wrap', 'pay_history_chart', data\)/,
  'Quick Add must render server-provided history inside its information panel');
const quickAddServer = files['quick_add_payment.js'];
const priorPreviewStart = quickAddServer.indexOf('function computeQuickAddPriorMonthPreview_(');
const priorPreviewEnd = quickAddServer.indexOf(
  'function computeQuickAddHistoryPreview_(', priorPreviewStart);
assert.ok(priorPreviewStart >= 0 && priorPreviewEnd > priorPreviewStart,
  'Quick Add prior-month preview must remain directly testable');
const priorPreviewSource = quickAddServer.slice(priorPreviewStart, priorPreviewEnd);
const makePriorPreview = function(getCashFlowSheet, findRow, getMonthColumn) {
  return Function(
    'Utilities',
    'Session',
    'getCashFlowSheet_',
    'findCashFlowRowByTypeAndPayee_',
    'getMonthColumnByDate_',
    'round2_',
    'toNumber_',
    `${priorPreviewSource}; return computeQuickAddPriorMonthPreview_;`
  )(
    { formatDate() { return 'Jun-26'; } },
    { getScriptTimeZone() { return 'America/Los_Angeles'; } },
    getCashFlowSheet,
    findRow,
    getMonthColumn,
    value => Number(value),
    value => Number(value)
  );
};
const missingPriorYear = makePriorPreview(
  () => { throw new Error('internal sheet missing'); },
  () => null,
  () => 3
)({}, 'Expense', 'New payee', new Date(2026, 6, 15));
assert.equal(
  missingPriorYear.priorMonthUnavailableMessage,
  'Previous-month data is not available because Cash Flow has not been set up for that year.',
  'Missing prior-year data must use customer language without an internal worksheet name');
const missingPriorPayee = makePriorPreview(
  () => ({ getRange() { return { getValue() { return 0; } }; } }),
  () => null,
  () => 3
)({}, 'Expense', 'New payee', new Date(2026, 6, 15));
assert.equal(
  missingPriorPayee.priorMonthUnavailableMessage,
  'No previous-month amount is available for this payee. This is expected for a new or renamed payee.',
  'A new payee must explain missing history without exposing a worksheet name');
const missingPriorColumn = makePriorPreview(
  () => ({ getRange() { return { getValue() { return 0; } }; } }),
  () => ({ row: 2 }),
  () => { throw new Error('internal month column missing'); }
)({}, 'Expense', 'Existing payee', new Date(2026, 6, 15));
assert.equal(
  missingPriorColumn.priorMonthUnavailableMessage,
  'The previous-month amount could not be read. Refresh the financial plan and try again.',
  'A missing prior-month column must use an actionable customer-safe message');
for (const preview of [missingPriorYear, missingPriorPayee, missingPriorColumn]) {
  assert.doesNotMatch(
    preview.priorMonthUnavailableMessage,
    /(?:INPUT|SYS|OUT|LOG)\s*-|sheet|tab|column/i,
    'Quick Add preview messages must not expose workbook implementation terminology');
}
const quickAddHistoryStart = quickAddServer.indexOf('function computeQuickAddHistoryPreview_(');
const quickAddHistoryEnd = quickAddServer.indexOf('function getQuickAddPreview(', quickAddHistoryStart);
assert.ok(quickAddHistoryStart >= 0 && quickAddHistoryEnd > quickAddHistoryStart,
  'Quick Add must expose a bounded history helper');
const quickAddHistorySlice = quickAddServer.slice(quickAddHistoryStart, quickAddHistoryEnd);
assert.match(quickAddHistorySlice,
  /entryType !== 'Expense' \|\| !currentRowExists\) return \[\]/,
  'Quick Add history must only load for a recognized Expense payee');
assert.doesNotMatch(quickAddHistorySlice,
  /\.setValue\(|\.setValues\(|\.appendRow\(|\.insertSheet\(|ensure[A-Z_]/,
  'Quick Add history must remain read-only');
assert.match(body, /id="bills_view_tab_due"[\s\S]*?>Due this period<\/button>[\s\S]*?id="bills_view_tab_add"[\s\S]*?>Add bill<\/button>[\s\S]*?id="bills_view_tab_manage"[\s\S]*?>Manage bills<\/button>/,
  'Bills must expose distinct Due, Add, and Manage modes in task order');
assert.match(body,
  /id="bills_view_due"[\s\S]*?id="bills_view_add"[\s\S]*?id="bills_add_wrap"[\s\S]*?id="bills_view_manage"/,
  'Bills Add form must live in its own view between Due and Manage');
assert.match(styles,
  /\.bills-view-switch\s*\{[\s\S]*?display:\s*inline-flex;[\s\S]*?max-width:\s*100%;/,
  'Bills Due, Add, and Manage controls must remain compact secondary controls');
assert.match(styles,
  /\.bills-view-btn\s*\{[\s\S]*?flex:\s*0 0 auto;[\s\S]*?width:\s*auto;/,
  'Bills secondary controls must override shared full-width button styling');
assert.doesNotMatch(styles,
  /\.bills-view-switch\s*\{[^}]*grid-template-columns:/,
  'Bills secondary controls must not expand into a full-width grid');
assert.match(styles,
  /\.bills-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(280px,\s*340px\)\);[\s\S]*?justify-content:\s*start;/,
  'Bill cards must use consistent non-stretching desktop columns');
assert.match(styles,
  /\.bills-grid \.bill-card-compact\s*\{[\s\S]*?height:\s*132px;/,
  'Bill cards must keep a consistent desktop height');
assert.match(files['Dashboard_Script_BillsDue.html'],
  /No active bills yet\.[\s\S]*?openBillsAddFormFromEmptyState\(\)/,
  'An empty Bills list must retain one centered Add action');
assert.match(files['Dashboard_Script_BillsDue.html'],
  /function setBillsView\(view\)[\s\S]*?view === 'add'[\s\S]*?bills_view_add[\s\S]*?bills_view_tab_add[\s\S]*?window\.__billsActiveView = target/,
  'Bills view switching must fully support the dedicated Add mode');
assert.match(files['Dashboard_Script_BillsDue.html'],
  /function openBillsAddForm_\(\)[\s\S]*?setBillsView\('add'\)[\s\S]*?resetBillsAddForm_\(\)[\s\S]*?setBillsFormModeToAdd_\(\)/,
  'Every fresh Bills Add entry must open a clean Add form');
assert.match(body,
  /id="upcoming_dismiss_guidance"[^>]*hidden/,
  'Upcoming Dismiss guidance must start hidden until an actionable row is confirmed');
assert.match(styles,
  /\.upcoming-dismiss-note\[hidden\]\s*\{\s*display:\s*none\s*!important;/,
  'Upcoming Dismiss guidance must remain visually hidden when it is not actionable');
assert.match(functionSource_(files['Dashboard_Script_CashFlowUpcoming.html'], 'renderUpcomingList'),
  /setUpcomingDismissGuidanceVisible_\(activeRows\.length > 0\)/,
  'Upcoming Dismiss guidance must follow the actionable-row count');
assert.match(functionSource_(files['Dashboard_Script_BillsDue.html'], 'loadActiveBillsManagementUi_'),
  /Array\.isArray\(rows\)[\s\S]*?renderActiveBillsList_\(rows\)[\s\S]*?routeBillsToAddIfAuthoritativelyEmpty_\(rows, viewGeneration\)/,
  'Bills must route only an authoritative active-bill response through empty-state handling');
assert.match(functionSource_(files['Dashboard_Script_BillsDue.html'], 'loadActiveBillsManagementUi_'),
  /renderSurfaceState_\([\s\S]*?actionLabel:\s*'Try again'/,
  'Malformed or failed Bills management reads must remain unavailable with a manual Retry');
const billsEmptyRoutes = [];
const billsEmptyContext = vm.createContext({
  window: { __billsActiveView: 'due', __billsViewSelectionGeneration: 4 },
  openBillsAddForm_: () => billsEmptyRoutes.push('add'),
  Array,
  Number
});
vm.runInContext(
  functionSource_(files['Dashboard_Script_BillsDue.html'], 'routeBillsToAddIfAuthoritativelyEmpty_'),
  billsEmptyContext
);
assert.equal(billsEmptyContext.routeBillsToAddIfAuthoritativelyEmpty_([], 4), true,
  'An authoritative empty active-bill response must open Add bill');
assert.deepEqual(billsEmptyRoutes, ['add'],
  'An empty active-bill response must open Add bill exactly once');
billsEmptyRoutes.length = 0;
assert.equal(billsEmptyContext.routeBillsToAddIfAuthoritativelyEmpty_([{ payee: 'Existing' }], 4), false,
  'A populated active-bill response must preserve Due this period');
assert.equal(billsEmptyContext.routeBillsToAddIfAuthoritativelyEmpty_({}, 4), false,
  'A malformed active-bill response must never be treated as empty');
billsEmptyContext.window.__billsViewSelectionGeneration = 5;
assert.equal(billsEmptyContext.routeBillsToAddIfAuthoritativelyEmpty_([], 4), false,
  'A late empty response must not override a newer manual Bills view choice');
assert.deepEqual(billsEmptyRoutes, [],
  'Only the current authoritative empty response may open Add bill');
assert.match(files['Dashboard_Script_BillsDue.html'],
  /function applyBillsFormModeUi_\(\)[\s\S]*?bills_view_tab_add[\s\S]*?isEdit \? 'Edit bill' : 'Add bill'[\s\S]*?bills_editor_purpose[\s\S]*?Update this recurring bill\. Existing payment history stays unchanged\./,
  'The Bills editor tab and purpose must identify Edit mode instead of presenting an edit as Add');
const onboardingBills = files['Dashboard_Script_Onboarding.html'];
const onboardingBillsOpenStart = onboardingBills.indexOf('function onboardingOpenBillsPage(mode)');
const onboardingBillsOpenEnd = onboardingBills.indexOf('// --------------------------------------------------------------------------\n// Step detail: Upcoming Expenses', onboardingBillsOpenStart);
assert.ok(onboardingBillsOpenStart >= 0 && onboardingBillsOpenEnd > onboardingBillsOpenStart,
  'Setup must define a bounded Bills editor handoff');
const onboardingBillsOpenSlice = onboardingBills.slice(onboardingBillsOpenStart, onboardingBillsOpenEnd);
assert.match(onboardingBills,
  /onclick="onboardingOpenBillsPage\(\\'add\\'\)">Add first bill/,
  'Empty Setup Bills must route directly to Add');
assert.match(onboardingBills,
  /onclick="onboardingOpenBillsPage\(\\'add\\'\)">Add bill[\s\S]*?onclick="onboardingOpenBillsPage\(\\'manage\\'\)">Manage bills/,
  'Populated Setup Bills must expose explicit Add and Manage actions');
assert.doesNotMatch(body,
  /id="onboarding_view_bills"[\s\S]*?<div class="onboarding-actions">[\s\S]*?onboardingOpenBillsPage/,
  'Setup Bills must not duplicate its Add or Manage actions in the footer');
assert.match(onboardingBillsOpenSlice,
  /target === 'manage'[\s\S]*?setBillsView\('manage'\)[\s\S]*?openBillsAddForm_\(\)/,
  'Setup Bills handoff must preserve the selected Add or Manage intent');
assert.doesNotMatch(onboardingBillsOpenSlice,
  /ONBOARDING_BILLS_HAS_TRACKED_|onboardingApplyFirstRunEditorMode_/,
  'Setup Bills routing must not depend on cached tracked-bill state');
assert.doesNotMatch(files['Dashboard_Script_BillsDue.html'],
  /updateBillsAddActionVisibility_|bills_add_toggle_btn/,
  'Dedicated Bills Add mode must not retain the removed conditional Add control');
assert.match(body, /Due day of month \(1–31\)/,
  'Bills must describe due day in plain language');
assert.match(body,
  /<label>Frequency[\s\S]*?id="bills_add_frequency"[\s\S]*?<label>Due day of month \(1–31\)[\s\S]*?id="bills_add_due_day"[\s\S]*?id="bills_add_weekday_field"[\s\S]*?id="bills_add_anchor_date_field"/,
  'Bills scheduling fields must read Frequency, Due day, Weekday, then Anchor date');
assert.match(body,
  /Choose the day this bill repeats\. Changes apply going forward; payment history stays unchanged\./,
  'Bills Weekday helper must explain its outcome and history safety');
assert.match(body,
  /Sets which every-other-week cycle to use\. Choose a date that falls on the selected weekday\./,
  'Bills Anchor date helper must explain cadence in customer language');
assert.match(body,
  /id="bd_recurringList"[\s\S]*?Loading recurring bills…/,
  'Bills Due recurring section must use descriptive initial loading copy');
assert.match(body,
  /id="bill_pay_drawer_backdrop"[\s\S]*?id="bill_pay_drawer"[\s\S]*?role="dialog"[\s\S]*?aria-modal="true"[\s\S]*?id="bill_pay_amount"[\s\S]*?id="bill_pay_date"[\s\S]*?id="bill_pay_submit_btn"/,
  'Bills Pay must open an accessible drawer with editable amount and payment date');
assert.match(body,
  /id="bill_skip_drawer_backdrop"[\s\S]*?id="bill_skip_drawer"[\s\S]*?role="dialog"[\s\S]*?aria-modal="true"[\s\S]*?id="bill_skip_name"[\s\S]*?id="bill_skip_due"[\s\S]*?id="bill_skip_submit_btn"/,
  'Bill Skip must use an accessible CashCompass drawer instead of a browser-native dialog');
assert.match(body,
  /No payment will be recorded\. This occurrence will be removed from Bills\. The recurring bill stays active and future occurrences will still appear\./,
  'Bill Skip drawer must explain every consequence before the customer confirms');
assert.match(body,
  /id="bill_pay_amount"[\s\S]{0,260}?onfocus="billPayAmountFocus_\(\)"/,
  'Bills Pay amount must retain customer-facing currency formatting while focused');
assert.match(body,
  /id="bill_pay_confirmation"[^>]*hidden[\s\S]*?id="bill_pay_confirmation_month"[\s\S]*?id="bill_pay_confirmation_previous"[\s\S]*?id="bill_pay_confirmation_added"[\s\S]*?id="bill_pay_confirmation_total"[\s\S]*?id="bill_pay_done_btn"[\s\S]*?hidden>Done<\/button>/,
  'Bills Pay must retain the drawer for a reviewed month-total receipt before Done closes it');
assert.match(body,
  /id="bill_pay_history_wrap"[^>]*hidden[\s\S]*?Previous payments[\s\S]*?id="bill_pay_history_status"[\s\S]*?aria-live="polite"[\s\S]*?id="bill_pay_history_chart"[^>]*aria-label="Six-month bill payment history"/,
  'Bills Pay receipt must include the shared six-month payment-history chart');
assert.match(body,
  /The amount entered here is recorded in Cash Flow\. Paying clears this bill occurrence even when the amount differs from the expected amount\./,
  'Bills Pay must explain changed-amount behavior before the user records it');
assert.match(files['Dashboard_Help.html'],
  /Done<\/strong> becomes available when that supplementary history settles, including if it safely times out/,
  'Bills Help must explain the bounded receipt-finishing sequence');
assert.match(styles,
  /\.bill-pay-drawer-backdrop\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?justify-content:\s*flex-end;/,
  'Bills Pay must preserve Bills context in a right-side overlay');
assert.match(styles,
  /\.bill-pay-drawer\s*\{[\s\S]*?width:\s*min\(560px,\s*100vw\);/,
  'Bills Pay drawer must provide enough desktop width for the receipt and six-month chart');
assert.match(styles,
  /\.bill-pay-history\s*\{[\s\S]*?margin-top:\s*18px;[\s\S]*?background:\s*#f8fbff;/,
  'Bills payment history must remain visually distinct below the receipt');
assert.match(styles,
  /\.quick-add-history-status\s*\{[\s\S]*?min-height:\s*132px;[\s\S]*?text-align:\s*center;/,
  'Bills payment history must reserve chart space while its supplementary read settles');
assert.match(styles,
  /@media \(max-width:\s*460px\)[\s\S]*?\.bill-pay-drawer\s*\{[\s\S]*?width:\s*100vw;/,
  'Bills Pay drawer must remain usable on a narrow screen');
const billsDueClient = files['Dashboard_Script_BillsDue.html'];
assert.match(billsDueClient,
  /function billPayAmountFocus_\(\)[\s\S]*?input\.value = fmtCurrency\(amount\)[\s\S]*?input\.select\(\)/,
  'Bills Pay focus must preserve $0.00 currency formatting while selecting the editable value');
const billPayFocusStart = billsDueClient.indexOf('function billPayAmountFocus_(');
const billPayFocusEnd = billsDueClient.indexOf('function updateBillPaySubmitLabel_(', billPayFocusStart);
assert.ok(billPayFocusStart >= 0 && billPayFocusEnd > billPayFocusStart,
  'Bills Pay amount focus must remain directly testable');
const billPayFocusInput = {
  value: '$550.00',
  selectCount: 0,
  select() { this.selectCount += 1; }
};
const billPayFocusDocument = {
  activeElement: billPayFocusInput,
  getElementById(id) { return id === 'bill_pay_amount' ? billPayFocusInput : null; }
};
const billPayAmountFocusForRegression = Function(
  'document',
  'setTimeout',
  'toNumber',
  'fmtCurrency',
  `${billsDueClient.slice(billPayFocusStart, billPayFocusEnd)}; return billPayAmountFocus_;`
)(
  billPayFocusDocument,
  (fn) => fn(),
  (value) => Number(String(value).replace(/[$,]/g, '')),
  (value) => `$${Number(value).toFixed(2)}`
);
billPayAmountFocusForRegression();
assert.equal(billPayFocusInput.value, '$550.00',
  'Focused Bills Pay amount must stay formatted as currency');
assert.ok(billPayFocusInput.selectCount >= 1,
  'Focused Bills Pay amount must remain fully selected for immediate replacement');
assert.match(billsDueClient,
  /function confirmAndSkipBill_[\s\S]*?openBillSkipDrawer_\(skipKey, bill\)/,
  'Bill Skip must route the selected current payload into the dedicated drawer');
const skipConfirmStart = billsDueClient.indexOf('function confirmAndSkipBill_(');
const skipSubmitEnd = billsDueClient.indexOf('function skipBillFromDashboard(', skipConfirmStart);
assert.ok(skipConfirmStart >= 0 && skipSubmitEnd > skipConfirmStart,
  'Bill Skip drawer flow must remain directly inspectable');
const skipDrawerFlowSlice = billsDueClient.slice(skipConfirmStart, skipSubmitEnd);
assert.doesNotMatch(skipDrawerFlowSlice, /window\.confirm/,
  'Bill Skip must never fall back to a browser-native confirmation dialog');
assert.match(skipDrawerFlowSlice,
  /function submitBillSkip\(\)[\s\S]*?if \(__billSkipDrawerBusy \|\| !__billSkipDrawerState\) return;[\s\S]*?setBillSkipDrawerBusy_\(true\)[\s\S]*?\.skipDashboardBill\(skipKey\)/,
  'Bill Skip must guard duplicate submits and call the existing writer with the original skip key');
assert.match(billsDueClient,
  /function setBillSkipDrawerBusy_[\s\S]*?close\.disabled = __billSkipDrawerBusy[\s\S]*?cancel\.disabled = __billSkipDrawerBusy[\s\S]*?submit\.disabled = __billSkipDrawerBusy/,
  'Bill Skip must prevent closing or resubmitting while the outcome is uncertain');
const skipControllerStart = billsDueClient.indexOf('var __billSkipDrawerState = null;');
const skipControllerEnd = billsDueClient.indexOf('function confirmAndSkipBill_(', skipControllerStart);
assert.ok(skipControllerStart >= 0 && skipControllerEnd > skipControllerStart,
  'Bill Skip drawer controller must remain directly executable in regression coverage');
const skipOrigin = { focusCount: 0, focus() { this.focusCount += 1; } };
const skipElements = {};
function skipElement(id) {
  return skipElements[id] || (skipElements[id] = {
    id,
    hidden: id === 'bill_skip_drawer_backdrop',
    disabled: false,
    textContent: '',
    offsetParent: {},
    focusCount: 0,
    focus() { this.focusCount += 1; skipDocument.activeElement = this; },
    querySelectorAll() {
      return [skipElement('bill_skip_close_btn'), skipElement('bill_skip_cancel_btn'), skipElement('bill_skip_submit_btn')];
    }
  });
}
let skipKeyHandler = null;
const skipDocument = {
  activeElement: skipOrigin,
  body: { classList: { add() {}, remove() {} } },
  documentElement: { contains: () => true },
  getElementById: skipElement,
  addEventListener(type, handler) { if (type === 'keydown') skipKeyHandler = handler; }
};
const skipController = Function(
  'document',
  'setTimeout',
  'setStatus',
  'setBillsStatus_',
  'fmtCurrency',
  `${billsDueClient.slice(skipControllerStart, skipControllerEnd)}; return {
    open: openBillSkipDrawer_, close: closeBillSkipDrawer,
    backdrop: onBillSkipDrawerBackdropClick, busy: setBillSkipDrawerBusy_
  };`
)(skipDocument, fn => fn(), () => {}, () => {}, value => `$${Number(value).toFixed(2)}`);
skipController.open('skip-key-1', { payee: 'Test bill', amount: 100, dueDate: '2026-08-01' });
assert.equal(skipElement('bill_skip_drawer_backdrop').hidden, false,
  'Opening Bill Skip must reveal the CashCompass drawer');
assert.equal(skipElement('bill_skip_cancel_btn').focusCount, 1,
  'Opening Bill Skip must move focus into the drawer');
skipController.backdrop({ target: skipElement('bill_skip_drawer_backdrop'), currentTarget: skipElement('bill_skip_drawer_backdrop') });
assert.equal(skipElement('bill_skip_drawer_backdrop').hidden, true,
  'An idle Bill Skip backdrop click must close without submitting');
assert.equal(skipOrigin.focusCount, 1,
  'Closing Bill Skip must return focus to the originating control');
skipDocument.activeElement = skipOrigin;
skipController.open('skip-key-2', { payee: 'Test bill', amount: 100, dueDate: '2026-08-01' });
let escapePrevented = false;
skipKeyHandler({ key: 'Escape', preventDefault() { escapePrevented = true; } });
assert.equal(escapePrevented, true,
  'Escape must be handled by the open Bill Skip drawer');
assert.equal(skipElement('bill_skip_drawer_backdrop').hidden, true,
  'Escape must close an idle Bill Skip drawer');
skipDocument.activeElement = skipOrigin;
skipController.open('skip-key-3', { payee: 'Test bill', amount: 100, dueDate: '2026-08-01' });
skipController.busy(true);
skipController.close();
assert.equal(skipElement('bill_skip_drawer_backdrop').hidden, false,
  'Bill Skip must not close while the write outcome is uncertain');
skipController.busy(false);
skipController.close();
assert.match(skipDrawerFlowSlice,
  /withFailureHandler\(function\(err\)[\s\S]*?setBillSkipDrawerBusy_\(false\)[\s\S]*?setBillSkipDrawerStatus_/,
  'Bill Skip failure must keep the drawer available and restore retry controls');
assert.match(skipDrawerFlowSlice,
  /customerSafeErrorMessage_\([\s\S]*?Could not skip this bill\. Please check whether it is still due, then try again\./,
  'Bill Skip must keep internal Apps Script details behind the customer-safe error boundary');
const skipRpcCalls = [];
let skipRpcSuccess = null;
let skipRpcFailure = null;
const skipRpcRunner = {
  withSuccessHandler(handler) { skipRpcSuccess = handler; return this; },
  withFailureHandler(handler) { skipRpcFailure = handler; return this; },
  skipDashboardBill(skipKey) { skipRpcCalls.push(skipKey); return this; }
};
const skipActionElements = {};
const skipActionOrigin = { focus() {} };
function skipActionElement(id) {
  return skipActionElements[id] || (skipActionElements[id] = {
    id,
    hidden: id === 'bill_skip_drawer_backdrop',
    disabled: false,
    textContent: '',
    offsetParent: {},
    focus() { skipActionDocument.activeElement = this; },
    querySelectorAll() {
      return [skipActionElement('bill_skip_close_btn'), skipActionElement('bill_skip_cancel_btn'), skipActionElement('bill_skip_submit_btn')];
    }
  });
}
let skipActionKeyHandler = null;
const skipActionDocument = {
  activeElement: skipActionOrigin,
  body: { classList: { add() {}, remove() {} } },
  documentElement: { contains: () => true },
  getElementById: skipActionElement,
  addEventListener(type, handler) { if (type === 'keydown') skipActionKeyHandler = handler; }
};
const skipRefreshCounts = { bills: 0, snapshot: 0, preview: 0 };
const skipActionController = Function(
  'document', 'setTimeout', 'setStatus', 'setBillsStatus_', 'fmtCurrency',
  'customerSafeErrorMessage_', 'google', 'loadDashboardActionSections',
  'refreshSnapshot', 'loadPaymentPreview',
  `${billsDueClient.slice(skipControllerStart, skipSubmitEnd)}; return {
    open: openBillSkipDrawer_, close: closeBillSkipDrawer,
    backdrop: onBillSkipDrawerBackdropClick, submit: submitBillSkip
  };`
)(
  skipActionDocument, fn => fn(), () => {}, () => {}, value => `$${Number(value).toFixed(2)}`,
  () => 'Safe skip failure', { script: { run: skipRpcRunner } },
  () => { skipRefreshCounts.bills += 1; },
  () => { skipRefreshCounts.snapshot += 1; },
  () => { skipRefreshCounts.preview += 1; }
);
skipActionController.open('skip-dismiss', { payee: 'Dismiss', amount: 5, dueDate: '2026-08-01' });
skipActionController.close();
skipActionController.open('skip-backdrop', { payee: 'Backdrop', amount: 5, dueDate: '2026-08-01' });
skipActionController.backdrop({ target: skipActionElement('bill_skip_drawer_backdrop'), currentTarget: skipActionElement('bill_skip_drawer_backdrop') });
skipActionController.open('skip-escape', { payee: 'Escape', amount: 5, dueDate: '2026-08-01' });
skipActionKeyHandler({ key: 'Escape', preventDefault() {} });
assert.equal(skipRpcCalls.length, 0,
  'Cancel, backdrop, and Escape must never call the Bill Skip writer');
skipActionController.open('skip-exactly-once', { payee: 'Exact once', amount: 5, dueDate: '2026-08-01' });
skipActionController.submit();
skipActionController.submit();
assert.deepEqual(skipRpcCalls, ['skip-exactly-once'],
  'Repeated Bill Skip submission while busy must issue exactly one writer call');
skipActionController.close();
assert.equal(skipActionElement('bill_skip_drawer_backdrop').hidden, false,
  'Bill Skip must remain visible while the first writer outcome is uncertain');
skipRpcFailure(new Error('Exception: INPUT - Bills required column missing'));
assert.equal(skipActionElement('bill_skip_submit_btn').disabled, false,
  'A failed Bill Skip must restore the submit control for a deliberate retry');
assert.equal(skipActionElement('bill_skip_drawer_backdrop').hidden, false,
  'A failed Bill Skip must stay open so the customer can review and retry');
skipActionController.submit();
assert.deepEqual(skipRpcCalls, ['skip-exactly-once', 'skip-exactly-once'],
  'A deliberate retry after failure must preserve the original occurrence key');
skipRpcSuccess({ ok: true });
assert.equal(skipActionElement('bill_skip_drawer_backdrop').hidden, true,
  'A successful Bill Skip must close the drawer');
assert.deepEqual(skipRefreshCounts, { bills: 1, snapshot: 1, preview: 1 },
  'A successful Bill Skip must refresh Bills, snapshot, and payment preview exactly once');

assert.match(body,
  /id="bill_stop_dialog"[\s\S]*?role="dialog"[\s\S]*?aria-modal="true"[\s\S]*?id="bill_stop_cancel_btn"[\s\S]*?Keep tracking[\s\S]*?id="bill_stop_submit_btn"[\s\S]*?Stop tracking/,
  'Bill Stop tracking must use a branded accessible confirmation with explicit action labels');
assert.match(body,
  /id="bill_stop_dialog_help"[\s\S]*?leave your active Bills list[\s\S]*?Past payments and Activity history stay available[\s\S]*?schedule details are preserved/,
  'Bill Stop tracking must explain both the active-view effect and preserved history');
assert.match(body,
  /id="bills_show_inactive_btn"[\s\S]*?Show inactive bills[\s\S]*?id="bills_inactive_wrap"[\s\S]*?Reactivate restores the existing bill without creating a duplicate/,
  'Manage bills must expose the preserved inactive inventory and explain true reactivation');
assert.match(billsDueClient,
  /function refreshInactiveBills_[\s\S]*?getInactiveBillsForManagementFromDashboard[\s\S]*?function renderInactiveBillsList_[\s\S]*?Reactivate[\s\S]*?function reactivateBillFromManage_/,
  'Bills must load and render inactive rows with an explicit Reactivate action');
assert.match(billsDueClient,
  /function reactivateBillFromManage_[\s\S]*?sheetRow[\s\S]*?openDashboardConfirm_[\s\S]*?No duplicate bill will be created[\s\S]*?reactivateBillFromDashboard\(\{ sheetRow: sheetRow, payee: payee \}\)/,
  'Bill Reactivate must use the CashCompass confirmation and preserve the stable row guard');
assert.match(files['bills.js'],
  /function getInactiveBillsForManagementFromDashboard\(optionalSs\)[\s\S]*?getBillsForManagementByState_\('no', optionalSs\)/,
  'The inactive Bills inventory must read only preserved Active=No rows');
assert.match(files['bills.js'],
  /function reactivateBillFromDashboard\(payload, optionalSs\)[\s\S]*?LockService\.getUserLock\(\)[\s\S]*?actualPayee !== expectedPayee[\s\S]*?active bill named[\s\S]*?setValue\('Yes'\)[\s\S]*?eventType: 'bill_reactivate'/,
  'Bill Reactivate must lock, reject stale or duplicate identity, restore the existing row, and log lifecycle evidence');
assert.match(files['bills.js'],
  /function addBillFromDashboard\(payload\)[\s\S]*?LockService\.getUserLock\(\)[\s\S]*?Show inactive bills[\s\S]*?already tracked/,
  'Bill Add must refuse active and inactive duplicate identities under the user lock');
assert.match(files['activity_log.js'],
  /bill_reactivate[\s\S]*?Bill reactivated[\s\S]*?et === 'bill_reactivate'/,
  'Activity must classify Bill Reactivate as a non-monetary lifecycle event');
assert.match(styles,
  /\.bill-stop-dialog-backdrop[\s\S]*?place-items:\s*center[\s\S]*?\.bill-stop-dialog[\s\S]*?border-radius:\s*16px/,
  'Bill Stop tracking must render as a centered CashCompass dialog rather than browser chrome');
const billStopStart = billsDueClient.indexOf('var __billStopDialogState = null;');
const billStopEnd = billsDueClient.indexOf('function loadRecurringBillsUi_(', billStopStart);
assert.ok(billStopStart >= 0 && billStopEnd > billStopStart,
  'Bill Stop tracking controller must remain directly executable in regression coverage');
const billStopSlice = billsDueClient.slice(billStopStart, billStopEnd);
assert.doesNotMatch(billStopSlice, /window\.confirm|\bconfirm\s*\(/,
  'Bill Stop tracking must never fall back to a browser-native confirmation dialog');
assert.match(billStopSlice,
  /function confirmStopTrackingBill_\(\)[\s\S]*?if \(__billStopDialogBusy \|\| !__billStopDialogState\) return;[\s\S]*?setBillStopDialogBusy_\(true\)[\s\S]*?\.deactivateBillFromDashboard/,
  'Bill Stop tracking must guard duplicate submits before calling the existing writer');
assert.match(billStopSlice,
  /function setBillStopDialogBusy_[\s\S]*?close\.disabled = __billStopDialogBusy[\s\S]*?cancel\.disabled = __billStopDialogBusy[\s\S]*?submit\.disabled = __billStopDialogBusy/,
  'Bill Stop tracking must prevent dismissing or resubmitting while its write is uncertain');

const billStopRpcCalls = [];
let billStopRpcSuccess = null;
let billStopRpcFailure = null;
const billStopRpcRunner = {
  withSuccessHandler(handler) { billStopRpcSuccess = handler; return this; },
  withFailureHandler(handler) { billStopRpcFailure = handler; return this; },
  deactivateBillFromDashboard(payload) { billStopRpcCalls.push(payload); return this; }
};
const billStopElements = {};
const billStopOrigin = { focusCount: 0, focus() { this.focusCount += 1; } };
function billStopElement(id) {
  return billStopElements[id] || (billStopElements[id] = {
    id,
    hidden: id === 'bill_stop_dialog_backdrop',
    disabled: false,
    textContent: '',
    offsetParent: {},
    focusCount: 0,
    focus() { this.focusCount += 1; billStopDocument.activeElement = this; },
    querySelectorAll() {
      return [billStopElement('bill_stop_close_btn'), billStopElement('bill_stop_cancel_btn'),
        billStopElement('bill_stop_submit_btn')];
    }
  });
}
let billStopKeyHandler = null;
const billStopDocument = {
  activeElement: billStopOrigin,
  body: { classList: { add() {}, remove() {} } },
  documentElement: { contains: () => true },
  getElementById: billStopElement,
  addEventListener(type, handler) { if (type === 'keydown') billStopKeyHandler = handler; }
};
const billStopRefreshCounts = { bills: 0, inactive: 0, snapshot: 0, preview: 0 };
const billStopStatuses = [];
const billStopController = Function(
  'document', 'window', 'setTimeout', 'setStatus', 'setBillsStatus_', 'google',
  'loadDashboardActionSections', 'refreshInactiveBills_', 'refreshSnapshot', 'loadPaymentPreview',
  `${billStopSlice}; return {
    open: openBillStopDialog_, close: closeBillStopDialog_,
    backdrop: onBillStopDialogBackdropClick_, submit: confirmStopTrackingBill_
  };`
)(
  billStopDocument, { __dashboardActiveBills: {} }, fn => fn(), () => {},
  (message, isError) => billStopStatuses.push({ message, isError }),
  { script: { run: billStopRpcRunner } },
  () => { billStopRefreshCounts.bills += 1; },
  () => { billStopRefreshCounts.inactive += 1; },
  () => { billStopRefreshCounts.snapshot += 1; },
  () => { billStopRefreshCounts.preview += 1; }
);
billStopController.open('cancel', { payee: 'Keep me' }, 12);
assert.equal(billStopElement('bill_stop_dialog_backdrop').hidden, false,
  'Opening Bill Stop tracking must reveal the CashCompass dialog');
assert.equal(billStopElement('bill_stop_cancel_btn').focusCount, 1,
  'Bill Stop tracking must initially focus the safe Keep tracking action');
billStopController.close();
billStopController.open('backdrop', { payee: 'Backdrop' }, 13);
billStopController.backdrop({ target: billStopElement('bill_stop_dialog_backdrop'),
  currentTarget: billStopElement('bill_stop_dialog_backdrop') });
billStopController.open('escape', { payee: 'Escape' }, 14);
billStopKeyHandler({ key: 'Escape', preventDefault() {} });
assert.equal(billStopRpcCalls.length, 0,
  'Keep tracking, backdrop, and Escape must never call the Bill deactivate writer');
billStopController.open('write', { payee: 'M1 Investment' }, 15);
billStopController.submit();
billStopController.submit();
assert.deepEqual(billStopRpcCalls, [{ sheetRow: 15, payee: 'M1 Investment' }],
  'Repeated Stop tracking submission while busy must issue exactly one writer call');
billStopController.close();
assert.equal(billStopElement('bill_stop_dialog_backdrop').hidden, false,
  'Bill Stop tracking must stay visible while the writer outcome is uncertain');
billStopRpcFailure(new Error('That bill moved on the sheet. Please refresh.'));
assert.equal(billStopElement('bill_stop_submit_btn').disabled, false,
  'A failed Stop tracking attempt must restore the deliberate retry action');
assert.equal(billStopElement('bill_stop_dialog_backdrop').hidden, false,
  'A failed Stop tracking attempt must keep its explanation visible');
billStopController.submit();
assert.equal(billStopRpcCalls.length, 2,
  'A deliberate Stop tracking retry must preserve the original row and payee guard');
billStopRpcSuccess({ message: 'Tracking stopped' });
assert.equal(billStopElement('bill_stop_dialog_backdrop').hidden, true,
  'A successful Stop tracking attempt must close the dialog');
assert.deepEqual(billStopRefreshCounts, { bills: 1, inactive: 1, snapshot: 1, preview: 1 },
  'Successful Stop tracking must refresh active/inactive Bills, snapshot, and payment preview exactly once');
assert.ok(billStopStatuses.some(row => row.isError && /moved on the sheet/i.test(row.message)),
  'A failed Stop tracking attempt must preserve its stale-row explanation');

const sharedConfirmStart = render.indexOf('var __dashboardConfirmState = null;');
const sharedConfirmEnd = render.indexOf('function isDebugMode()', sharedConfirmStart);
assert.ok(sharedConfirmStart >= 0 && sharedConfirmEnd > sharedConfirmStart,
  'The shared CashCompass confirmation controller must remain directly executable');
const sharedConfirmSlice = render.slice(sharedConfirmStart, sharedConfirmEnd);
const sharedConfirmElements = {};
function sharedConfirmElement(id) {
  return sharedConfirmElements[id] || (sharedConfirmElements[id] = {
    id,
    hidden: id === 'dashboard_confirm_backdrop' || id === 'dashboard_confirm_subject_wrap',
    disabled: false,
    textContent: '',
    children: [],
    classList: { toggle() {}, add() {}, remove() {} },
    focus() { sharedConfirmDocument.activeElement = this; },
    replaceChildren() { this.children = []; },
    appendChild(child) { this.children.push(child); },
    querySelectorAll() {
      return [sharedConfirmElement('dashboard_confirm_close_btn'),
        sharedConfirmElement('dashboard_confirm_cancel_btn'),
        sharedConfirmElement('dashboard_confirm_submit_btn')].filter(el => !el.disabled);
    }
  });
}
let sharedConfirmKeyHandler = null;
const sharedConfirmOrigin = { focusCount: 0, focus() { this.focusCount += 1; } };
const sharedConfirmDocument = {
  activeElement: sharedConfirmOrigin,
  body: { classList: { add() {}, remove() {}, contains() { return false; } } },
  getElementById: sharedConfirmElement,
  createElement() { return sharedConfirmElement(`created-${Math.random()}`); },
  addEventListener(type, handler) { if (type === 'keydown') sharedConfirmKeyHandler = handler; }
};
let sharedConfirmWrites = 0;
const sharedConfirmController = Function(
  'document',
  `${sharedConfirmSlice}; return { open: openDashboardConfirm_, close: closeDashboardConfirm_,
    submit: confirmDashboardAction_, backdrop: onDashboardConfirmBackdropClick_ };`
)(sharedConfirmDocument);
sharedConfirmController.open({
  title: 'Cancel test', consequences: ['History is preserved.'],
  onConfirm: () => { sharedConfirmWrites += 1; }
});
assert.equal(sharedConfirmDocument.activeElement.id, 'dashboard_confirm_cancel_btn',
  'The shared confirmation must initially focus its safe action');
sharedConfirmController.close(false);
sharedConfirmController.open({ onConfirm: () => { sharedConfirmWrites += 1; } });
sharedConfirmController.backdrop({ target: sharedConfirmElement('dashboard_confirm_backdrop') });
sharedConfirmController.open({ onConfirm: () => { sharedConfirmWrites += 1; } });
sharedConfirmKeyHandler({ key: 'Escape', preventDefault() {} });
assert.equal(sharedConfirmWrites, 0,
  'Button cancel, backdrop cancel, and Escape must never execute a shared confirmed action');
sharedConfirmController.open({ onConfirm: () => { sharedConfirmWrites += 1; } });
sharedConfirmController.submit();
sharedConfirmController.submit();
assert.equal(sharedConfirmWrites, 1,
  'The shared confirmation must execute an accepted action exactly once');
assert.equal(sharedConfirmElement('dashboard_confirm_backdrop').hidden, true,
  'The shared confirmation must close after acceptance');

assert.match(billsDueClient,
  /Skipped "[\s\S]*?No payment was recorded; future occurrences remain scheduled/,
  'Skip success must explain the outcome without exposing the internal zero-cell mechanism');
assert.match(billsDueClient,
  /function loadBillsDueUi_[\s\S]*?window\.__billsDueLoadGeneration = Number[\s\S]*?const loadGeneration[\s\S]*?window\.__dashboardBills = \{\};/,
  'Bills Due must invalidate old action payloads as soon as a replacement load starts');
assert.match(billsDueClient,
  /withSuccessHandler\(function\(data\)\s*\{[\s\S]*?if \(loadGeneration !== window\.__billsDueLoadGeneration\) return;[\s\S]*?renderBillsList_\('bd_overdueList'[\s\S]*?renderBillsList_\('bd_next7List'/,
  'Bills Due must reject a stale success response so it cannot restore a skipped card');
assert.match(billsDueClient,
  /withFailureHandler\(function\(err\)\s*\{[\s\S]*?if \(loadGeneration !== window\.__billsDueLoadGeneration\) return;/,
  'Bills Due must reject a stale failure response so it cannot replace newer cards with an old error');
assert.match(files['dashboard_data.js'],
  /function skipDashboardBill[\s\S]*?No payment was recorded; future occurrences remain scheduled/,
  'The server Skip response must preserve the customer consequence contract');
assert.match(files['dashboard_data.js'],
  /skippedOccurrenceKey[\s\S]*?'bill_skip::' \+ buildDashboardBillSkipKey_[\s\S]*?activityLogDedupeKeyExists_\(ss, skippedOccurrenceKey\)/,
  'Monthly Bills Due must honor the same durable per-occurrence Skip marker as expanded recurrence');
assert.match(files['dashboard_data.js'],
  /const hasCashFlowTarget[\s\S]*?getInputBillsPayeeMap_\(ss\)[\s\S]*?if \(!hasCashFlowTarget && !isActiveInputBill\)[\s\S]*?throw new Error\('Could not resolve bill skip target\.'\)/,
  'Marker-only Skip must remain gated to a verified active tracked bill when no Cash Flow row exists');
assert.match(files['dashboard_data.js'],
  /cashFlowSheet:\s*hasCashFlowTarget \? info\.sheet\.getName\(\) : ''[\s\S]*?cashFlowTargetResolved:\s*hasCashFlowTarget/,
  'Marker-only Skip must record whether a Cash Flow target was resolved without inventing a ledger target');
assert.match(files['dashboard_data.js'],
  /if \(hasCashFlowTarget\)[\s\S]*?if \(isBlank\)[\s\S]*?cell\.setValue\(0\)/,
  'Skip must keep its zero write behind both a resolved Cash Flow target and the existing blank-cell guard');
assert.match(files['dashboard_data.js'],
  /const activeInputBillPayees = getInputBillsPayeeMap_\(ss\)[\s\S]*?filterDebtBillsShadowedByTrackedBills_\([\s\S]*?const allRows = visibleDebtRows\.concat\(inputBillRows\)/,
  'Bills Due must give active tracked Bills authority over matching Debt-derived cards');
const billsData = files['dashboard_data.js'];
const precedenceStart = billsData.indexOf('function filterDebtBillsShadowedByTrackedBills_(');
const precedenceEnd = billsData.indexOf('function getDebtPayeeMap_(', precedenceStart);
assert.ok(precedenceStart >= 0 && precedenceEnd > precedenceStart,
  'Bills Due cross-source precedence must remain a directly testable pure helper');
const filterDebtBillsForRegression = Function(
  'normalizeBillName_',
  `${billsData.slice(precedenceStart, precedenceEnd)}; return filterDebtBillsShadowedByTrackedBills_;`
)(name => String(name || '').toLowerCase().replace(/&/g, 'and').replace(/['".,]/g, '').replace(/\s+/g, ' ').trim());
const debtOnly = { payee: 'Debt Only', amount: 99, sourceType: 'debt' };
const shadowedToyota = { payee: '  TOYOTA Financial Services  ', amount: 1902, sourceType: 'debt' };
const filteredDebtRows = filterDebtBillsForRegression(
  [shadowedToyota, debtOnly],
  { 'toyota financial services': true }
);
assert.deepEqual(filteredDebtRows, [debtOnly],
  'An active tracked Bill must suppress a normalized matching Debt card while unrelated Debt cards remain');
assert.deepEqual(filterDebtBillsForRegression([shadowedToyota], {}), [shadowedToyota],
  'An inactive or absent tracked Bill must not suppress a Debt-derived card');
const payBillStart = billsDueClient.indexOf('function payBillFromDashboard(');
const skipBillStart = billsDueClient.indexOf('function skipBillFromDashboard(', payBillStart);
assert.ok(payBillStart >= 0 && skipBillStart > payBillStart,
  'Bills must retain a dedicated Pay action');
const payBillSlice = billsDueClient.slice(payBillStart, skipBillStart);
assert.match(payBillSlice, /openBillPayDrawer_\(bill,\s*billOccurrencePaid\)/,
  'Bills Pay must open the Bills-only drawer');
assert.match(payBillSlice,
  /var billOccurrencePaid = bill\.dueDate[\s\S]*?dueDate:\s*bill\.dueDate/,
  'Every dated bill must carry an explicit paid-occurrence marker context');
assert.doesNotMatch(payBillSlice,
  /bill\.isExpandedRecurrence\s*&&\s*bill\.dueDate/,
  'Monthly bill dismissal must not depend only on an immediate Cash Flow reread');
assert.doesNotMatch(payBillSlice, /prefillQuickPayment|showTab\(['"]payments['"]\)/,
  'Bills Pay must not navigate to or visually merge with Quick Add');
const drawerSaveStart = billsDueClient.indexOf('function saveBillPaymentFromDrawer_(');
const billsViewStart = billsDueClient.indexOf('Internal Bills view switch', drawerSaveStart);
assert.ok(drawerSaveStart >= 0 && billsViewStart > drawerSaveStart,
  'Bills drawer must retain a dedicated save flow');
const drawerSaveSlice = billsDueClient.slice(drawerSaveStart, billsViewStart);
assert.match(drawerSaveSlice,
  /\.quickAddPayment\(\{[\s\S]*?entryType:\s*'Expense'[\s\S]*?createIfMissing:\s*true/,
  'Bills drawer must reuse the guarded Cash Flow payment writer');
assert.doesNotMatch(drawerSaveSlice, /registerQuickAddWriteReceipt_/,
  'A completed Bills payment must not create a later Quick Add warning');
const drawerSubmitSlice = billsDueClient.slice(
  billsDueClient.indexOf('function submitBillPayment()'),
  drawerSaveStart
);
assert.doesNotMatch(drawerSubmitSlice,
  /loadQuickAddWriteReceipts_|verifyPendingQuickAddWrites_|Checking the previous payment/,
  'Bills Pay must not inherit Quick Add browser-session receipt warnings');
assert.match(drawerSaveSlice,
  /withSuccessHandler\(function\(res\)[\s\S]*?markDashboardBillOccurrencePaid\(occurrence\)/,
  'Expanded bill occurrences must only be cleared after the payment succeeds');
assert.match(drawerSaveSlice,
  /withSuccessHandler\(function\(markerResult\)[\s\S]*?markerResult\.ok\s*!==\s*true[\s\S]*?could not confirm that this occurrence cleared/,
  'Bills Pay must not show a cleared receipt when the handled marker is unverified');
assert.match(drawerSaveSlice,
  /state\.paymentRecorded\s*=\s*true[\s\S]*?submit\.disabled\s*=\s*true[\s\S]*?It did not repeat the payment/,
  'A marker failure must prevent duplicate payment submission and explain partial success');
assert.doesNotMatch(drawerSaveSlice,
  /runReadOnlyRpcWithRetry_|setTimeout\([\s\S]*?quickAddPayment/,
  'Bills payment writes must never use automatic transport retry');
assert.match(drawerSaveSlice,
  /could not confirm whether the payment finished\. It did not retry\. Check Bills and Cash Flow before trying again\./,
  'An uncertain payment response must use explicit no-retry guidance');
assert.match(drawerSaveSlice,
  /if \(uncertain\)[\s\S]*?submit\.disabled\s*=\s*true[\s\S]*?Check before retrying/,
  'An uncertain payment response must disable immediate duplicate submission');
const drawerConfirmationStart = billsDueClient.indexOf('function showBillPaymentConfirmation_(');
const drawerSubmitStart = billsDueClient.indexOf('function submitBillPayment(', drawerConfirmationStart);
assert.ok(drawerConfirmationStart >= 0 && drawerSubmitStart > drawerConfirmationStart,
  'Bills Pay must retain a dedicated post-write receipt state');
const drawerConfirmationSlice = billsDueClient.slice(drawerConfirmationStart, drawerSubmitStart);
assert.match(drawerConfirmationSlice,
  /snapshot\.previousValue[\s\S]*?preview\.currentValue[\s\S]*?bill_pay_confirmation_previous[\s\S]*?bill_pay_confirmation_added[\s\S]*?bill_pay_confirmation_total/,
  'Bills Pay receipt must use the authoritative writer response for before, added, and new totals');
assert.match(drawerConfirmationSlice,
  /loadBillPaymentHistory_\(state\)/,
  'Bills Pay receipt must load its post-payment history after the writer succeeds');
assert.match(drawerConfirmationSlice,
  /loadBillPaymentHistory_\(state\)[\s\S]*?submit\.hidden\s*=\s*true[\s\S]*?cancel\.hidden\s*=\s*true/,
  'A successful payment must retain the receipt while supplementary history settles');
assert.doesNotMatch(drawerConfirmationSlice, /closeBillPayDrawer\(/,
  'Bills Pay confirmation must not close itself before the customer reviews it');
const billHistoryControllerStart = billsDueClient.indexOf('function beginBillPaymentHistory_(');
const billHistoryStart = billsDueClient.indexOf('function loadBillPaymentHistory_(', billHistoryControllerStart);
assert.ok(billHistoryControllerStart >= 0 && billHistoryStart > billHistoryControllerStart &&
  billHistoryStart < drawerConfirmationStart,
  'Bills Pay must retain a dedicated read-only history loader');
const billHistorySlice = billsDueClient.slice(billHistoryControllerStart, drawerConfirmationStart);
assert.match(billHistorySlice,
  /entryType:\s*'Expense'[\s\S]*?state\.paymentDate\s*\|\|\s*state\.entryDate/,
  'Bills Pay history must use the actual submitted payment date');
assert.match(billHistorySlice,
  /runReadOnlyRpcWithRetry_\([\s\S]*?\.getQuickAddPreview\(payload\)/,
  'Bills Pay history must use the retry-safe read-only preview endpoint');
assert.match(billHistorySlice,
  /__billPayDrawerState\s*===\s*targetState[\s\S]*?targetState\.paymentRecorded\s*===\s*true/,
  'A stale Bill Pay history response must not update a different drawer');
assert.match(billHistorySlice,
  /renderPaymentHistoryChart_\([\s\S]*?'bill_pay_history_wrap'[\s\S]*?'bill_pay_history_chart'[\s\S]*?data\s*\|\|\s*\{\}[\s\S]*?onSuccess:[\s\S]*?finishBillPaymentHistory_\(targetState, 'success', data\s*\|\|\s*\{\}\)/,
  'Bills Pay history must render the shared six-month payment chart');
assert.doesNotMatch(billHistorySlice, /quickAddPayment|markDashboardBillOccurrencePaid/,
  'The supplementary Bill Pay history read must never repeat a payment write');
assert.match(billsDueClient,
  /BILL_PAYMENT_HISTORY_WAIT_MS_\s*=\s*15000/,
  'Bills Pay history completion must reserve fifteen seconds for a normal Apps Script read');
assert.match(billHistorySlice,
  /done\.disabled\s*=\s*true[\s\S]*?done\.textContent\s*=\s*'Finishing…'[\s\S]*?finishBillPaymentHistory_\(state, 'timeout'\)/,
  'Done must remain visibly disabled while payment history is still loading');
assert.match(billHistorySlice,
  /outcome === 'timeout'[\s\S]*?You can safely close this receipt[\s\S]*?done\.disabled\s*=\s*false[\s\S]*?done\.textContent\s*=\s*'Done'/,
  'History timeout must explain the delay and release Done without changing payment success');

function createBillHistoryControllerRegression_(options = {}) {
  const elements = {
    bill_pay_history_wrap: { hidden: true },
    bill_pay_history_chart: { innerHTML: '' },
    bill_pay_history_status: { hidden: true, textContent: '' },
    bill_pay_done_btn: {
      hidden: true,
      disabled: false,
      textContent: 'Done',
      focusCount: 0,
      focus() { this.focusCount += 1; }
    }
  };
  const timers = [];
  const cleared = new Set();
  const retryCalls = [];
  const renderCalls = [];
  const controller = Function(
    'document',
    'setTimeout',
    'clearTimeout',
    'runReadOnlyRpcWithRetry_',
    'renderPaymentHistoryChart_',
    'google',
    `var __billPayDrawerState = null;
     var BILL_PAYMENT_HISTORY_WAIT_MS_ = 15000;
     ${billHistorySlice}
     return {
       setState: function(state) { __billPayDrawerState = state; },
       load: loadBillPaymentHistory_
     };`
  )(
    { getElementById(id) { return elements[id] || null; } },
    (fn, ms) => {
      const timer = { id: timers.length + 1, fn, ms: Number(ms) || 0 };
      timers.push(timer);
      return timer.id;
    },
    (id) => { cleared.add(id); },
    (options) => { retryCalls.push(options); },
    (wrapId, chartId, data) => {
      renderCalls.push({ wrapId, chartId, data });
      if (options.throwOnRender) throw new Error('Controlled chart render failure');
    },
    { script: { run: {} } }
  );
  return { controller, elements, timers, cleared, retryCalls, renderCalls };
}

function billHistoryState_() {
  return {
    paymentRecorded: true,
    payee: 'Toyota Financial Services',
    paymentDate: '2026-08-08'
  };
}

const billHistorySuccess = createBillHistoryControllerRegression_();
const billHistorySuccessState = billHistoryState_();
billHistorySuccess.controller.setState(billHistorySuccessState);
billHistorySuccess.controller.load(billHistorySuccessState);
assert.equal(billHistorySuccess.elements.bill_pay_done_btn.disabled, true,
  'Done must start disabled while Bill payment history loads');
assert.equal(billHistorySuccess.elements.bill_pay_done_btn.textContent, 'Finishing…',
  'The disabled Bill payment action must explain that receipt finishing is in progress');
assert.equal(billHistorySuccess.elements.bill_pay_history_status.textContent,
  'Loading payment history…',
  'The receipt must explain the supplementary history load');
const billHistoryData = { history: [{ label: 'Aug', amount: 1901.75, hasValue: true }] };
const billHistorySuccessWaitTimer = billHistorySuccess.timers.find((timer) => timer.ms === 15000);
billHistorySuccess.retryCalls[0].onSuccess(billHistoryData);
assert.equal(billHistorySuccess.renderCalls.length, 1,
  'Successful Bill payment history must render exactly once');
assert.equal(billHistorySuccess.elements.bill_pay_done_btn.disabled, false,
  'Done must enable only after successful chart rendering settles');
assert.equal(billHistorySuccess.elements.bill_pay_done_btn.textContent, 'Done');
assert.ok(billHistorySuccess.cleared.has(billHistorySuccessWaitTimer.id),
  'Successful history rendering must clear the bounded wait timer');

const billHistoryRenderFailure = createBillHistoryControllerRegression_({ throwOnRender: true });
const billHistoryRenderFailureState = billHistoryState_();
billHistoryRenderFailure.controller.setState(billHistoryRenderFailureState);
billHistoryRenderFailure.controller.load(billHistoryRenderFailureState);
billHistoryRenderFailure.retryCalls[0].onSuccess(billHistoryData);
assert.equal(billHistoryRenderFailure.elements.bill_pay_done_btn.disabled, false,
  'A chart-render failure must never trap a recorded payment receipt');
assert.match(billHistoryRenderFailure.elements.bill_pay_history_status.textContent,
  /unavailable right now.*payment is recorded/i,
  'Chart-render failure must fall back to authoritative receipt guidance');

const billHistoryFailure = createBillHistoryControllerRegression_();
const billHistoryFailureState = billHistoryState_();
billHistoryFailure.controller.setState(billHistoryFailureState);
billHistoryFailure.controller.load(billHistoryFailureState);
billHistoryFailure.retryCalls[0].onFailure(new Error('Controlled history failure'));
assert.equal(billHistoryFailure.elements.bill_pay_done_btn.disabled, false,
  'A supplementary history failure must never trap a recorded payment receipt');
assert.match(billHistoryFailure.elements.bill_pay_history_status.textContent,
  /unavailable right now.*payment is recorded/i,
  'History failure must preserve confidence in the recorded payment');

const billHistoryTimeout = createBillHistoryControllerRegression_();
const billHistoryTimeoutState = billHistoryState_();
billHistoryTimeout.controller.setState(billHistoryTimeoutState);
billHistoryTimeout.controller.load(billHistoryTimeoutState);
const billHistoryWaitTimer = billHistoryTimeout.timers.find((timer) => timer.ms === 15000);
assert.ok(billHistoryWaitTimer, 'Bill payment history must schedule its bounded wait');
billHistoryWaitTimer.fn();
assert.equal(billHistoryTimeout.elements.bill_pay_done_btn.disabled, false,
  'History timeout must release Done');
assert.match(billHistoryTimeout.elements.bill_pay_history_status.textContent,
  /taking longer than expected.*safely close/i,
  'History timeout must provide safe, nonblocking guidance');
billHistoryTimeout.retryCalls[0].onSuccess(billHistoryData);
assert.equal(billHistoryTimeout.renderCalls.length, 1,
  'A valid response arriving after timeout must still render in the same open receipt');
assert.equal(billHistoryTimeout.elements.bill_pay_history_status.hidden, true,
  'A late valid chart must replace the timeout guidance');

const billHistoryStale = createBillHistoryControllerRegression_();
const staleHistoryState = billHistoryState_();
billHistoryStale.controller.setState(staleHistoryState);
billHistoryStale.controller.load(staleHistoryState);
billHistoryStale.controller.setState(billHistoryState_());
billHistoryStale.retryCalls[0].onSuccess(billHistoryData);
assert.equal(billHistoryStale.renderCalls.length, 0,
  'A stale history response must not render into a different Bill Pay drawer');
assert.equal(billHistoryStale.elements.bill_pay_done_btn.disabled, true,
  'A stale response must not release controls belonging to a different drawer state');
assert.match(drawerSaveSlice, /state\.paymentDate\s*=\s*entryDate/,
  'Bills Pay must retain the submitted date for its post-payment history request');
assert.match(billsDueClient,
  /function updateBillPaymentFollowup_\(data\)[\s\S]*?candidateDueDate\s*!==\s*paidDueDate[\s\S]*?Another [\s\S]*?occurrence due [\s\S]*?is still awaiting action/,
  'Bills Pay must distinguish a cleared occurrence from another occurrence that is also due');
assert.match(billsDueClient,
  /renderBillsDueSummary_\(data \|\| \{\}\);[\s\S]*?updateBillPaymentFollowup_\(data \|\| \{\}\);/,
  'Bills Pay follow-up must use the refreshed Bills response');
const billsServer = files['dashboard_data.js'];
const billsWriter = files['bills.js'];
const addBillWriterStart = billsWriter.indexOf('function addBillFromDashboard(payload)');
const updateBillWriterStart = billsWriter.indexOf('function updateTrackedBillFromDashboard', addBillWriterStart);
assert.ok(addBillWriterStart >= 0 && updateBillWriterStart > addBillWriterStart,
  'Bills must retain a dedicated add writer');
const addBillWriterSlice = billsWriter.slice(addBillWriterStart, updateBillWriterStart);
assert.match(addBillWriterSlice,
  /new Date\(billCreatedOn\.getFullYear\(\),\s*billCreatedOn\.getMonth\(\),\s*1\)[\s\S]*?setIfPresent\('Schedule Effective Date',\s*newBillScheduleEffectiveDate\)/,
  'New bills must start in their creation month and never generate a prior-month occurrence');
assert.match(addBillWriterSlice,
  /scheduleEffectiveDate:\s*newBillScheduleEffectiveDate/,
  'Bill-add Activity evidence must record the creation-month schedule floor');
assert.match(billsServer,
  /function readBillCreationEffectiveDatesFromActivity_[\s\S]*?bill_add[\s\S]*?parseDateOnlySheetCell_[\s\S]*?new Date\(addedOn\.getFullYear\(\), addedOn\.getMonth\(\), 1\)/,
  'Blank schedule floors must recover the bill creation month from immutable bill_add evidence');
assert.match(billsServer,
  /if \(!scheduleEffectiveDate\)[\s\S]*?readBillCreationEffectiveDatesFromActivity_[\s\S]*?billCreationEffectiveDates\[normPayee\] \|\| null/,
  'Bills Due must apply the Activity creation floor before generating occurrences');
const billsHarness = files['test_harness_scenarios_bills.js'];
const creationFloorStart = billsHarness.indexOf('function getHarnessBillsNewCreationFloorScenario_()');
const weeklyScenarioStart = billsHarness.indexOf('function getHarnessBillsWeeklyScenario_()', creationFloorStart);
assert.ok(creationFloorStart >= 0 && weeklyScenarioStart > creationFloorStart,
  'Bills must retain a bounded new-creation-floor regression scenario');
const creationFloorSlice = billsHarness.slice(creationFloorStart, weeklyScenarioStart);
assert.match(creationFloorSlice,
  /expectedSheets:\s*\[settingsName,\s*sysMetaName\][\s\S]*?ctx\.assertWritable\(\)[\s\S]*?runMinimalBootstrap_\(ctx\.ss\)/,
  'Every Bills PURE harness scenario must provision its disposable vehicle before suite validation');
const monthlyBillsStart = billsServer.indexOf('if (!isExpandedFreq) for (let i = 0; i < candidates.length; i++)');
const expandedBillsStart = billsServer.indexOf('// ---- Weekly / biweekly:', monthlyBillsStart);
assert.ok(monthlyBillsStart >= 0 && expandedBillsStart > monthlyBillsStart,
  'Bills must retain a distinct single-occurrence schedule path');
const monthlyBillsSlice = billsServer.slice(monthlyBillsStart, expandedBillsStart);
assert.match(monthlyBillsSlice,
  /bill_paid::['"]?\s*\+\s*buildDashboardBillPaidKey_\(payee,\s*candDueIso\)[\s\S]*?activityLogDedupeKeyExists_\(ss,\s*paidOccurrenceKey\)[\s\S]*?continue;/,
  'Monthly bills must honor the explicit paid-occurrence marker before showing a due card');
assert.match(billsServer,
  /var wroteMarker = appendActivityLog_\(ss,[\s\S]*?var markerExists = activityLogDedupeKeyExists_\(ss,\s*paidDedupeKey\);[\s\S]*?if \(!markerExists\)[\s\S]*?ok:\s*false/,
  'Bills Pay marker writer must verify durable evidence before reporting success');
const quickAddClient = files['Dashboard_Script_Payments.html'];
assert.match(quickAddServer,
  /function quickAddWorkbookIdentity_\(ss\)\s*\{\s*return activityWorkbookIdentity_\(ss\);\s*\}/,
  'Quick Add receipts must reuse the shared opaque Activity workbook identity');
assert.match(activityServer,
  /function activityOpaqueIdentity_\(prefix,\s*rawValue\)[\s\S]*?Utilities\.DigestAlgorithm\.SHA_256/,
  'The shared Activity workbook identity must remain opaque');
assert.match(quickAddServer,
  /workbookIdentity:\s*quickAddWorkbookIdentity_\(ss\)/,
  'Quick Add writer responses must scope receipts to their source workbook');
assert.match(quickAddServer,
  /receipt\.workbookIdentity\s*!==\s*currentWorkbookIdentity[\s\S]*?status:\s*'WORKBOOK_CHANGED'/,
  'Quick Add verification must detect a receipt from a replaced workbook before reading a cell');
assert.match(quickAddClient,
  /cashcompass\.quickAddWriteReceipts\.v2/,
  'Legacy unscoped Quick Add receipts must be retired by a storage-version bump');
assert.match(quickAddClient,
  /function reconcileQuickAddWriteVerificationResults_[\s\S]*?result\.status\s*===\s*'WORKBOOK_CHANGED'[\s\S]*?currentReceipts\.filter/,
  'Receipts from another workbook must be retired silently');
assert.match(body,
  /id="bills_manage_list"[\s\S]*?Loading recurring bills…/,
  'Manage bills must use descriptive initial loading copy');
assert.match(files['Dashboard_Script_BillsDue.html'],
  /loadingIndicatorHtml\('Loading bills…'\)/,
  'Overview Bills loading copy must identify what is loading');
assert.match(body,
  /<label>Due day of month<\/label>\s*<input[^>]*id="debt_edit_due_date"/,
  'Debt editor must describe the day number as Due day of month');
assert.match(files['Dashboard_Script_PlanningDebts.html'],
  /Due day of month must be a whole number between 1 and 31\./,
  'Debt validation must use the same plain-language due-day wording');
assert.doesNotMatch(body, /Due Date \(day of month\)/,
  'Debt editor must not restore the ambiguous Due Date label');
assert.doesNotMatch(files['Dashboard_Script_PlanningDebts.html'],
  /onclick="openDebtRenameForm\(/,
  'Debt Manage rows must not expose a separate Rename action');
assert.match(body,
  /id="debt_edit_wrap"[\s\S]*?id="debt_edit_account_name"[\s\S]*?id="debt_edit_save_btn"[^>]*onclick="submitDebtEdit_\(\)"/,
  'Debt account name must be part of the single Edit save surface');
assert.doesNotMatch(body, /debt_rename_save_btn|>Rename account</,
  'Debt Edit must not require a separate Rename account action');
assert.match(files['Dashboard_Script_PlanningDebts.html'],
  /newAccountName:\s*accountName[\s\S]*?\.saveTrackedDebtFromDashboard\(payload\)/,
  'Debt Save changes must submit the account name through the unified server coordinator');
assert.match(files['debts.js'],
  /function saveTrackedDebtFromDashboard\(payload\)[\s\S]*?LockService\.getUserLock\(\)[\s\S]*?lock\.waitLock\(30000\)[\s\S]*?cashFlowTargets[\s\S]*?updateTrackedDebtFromDashboard\(detailPayload\)[\s\S]*?were not saved and were rolled back/,
  'Unified Debt Edit must retain one lock, linked Cash Flow updates, detail writes, and rollback');
assert.doesNotMatch(files['debts.js'],
  /function (?:renameDebtFromDashboard|saveTrackedDebtFromDashboard)\(payload\)[\s\S]{0,900}?LockService\.getDocumentLock\(\)/,
  'Debt rename writers must not use a null document lock in standalone Central');
assert.doesNotMatch(files['Dashboard_Script_PlanningDebts.html'], /function submitDebtRename_\(/,
  'Debt Edit must not retain a second client-side rename submission path');
assert.doesNotMatch(body, /renaming coming in a later update/i,
  'Debt Edit must not claim that its existing rename capability is unavailable');
assert.match(files['Dashboard_Help.html'],
  /one <strong>Save changes<\/strong> action[\s\S]*?updates linked Cash Flow references/,
  'Debt Help must describe the one-action Edit workflow');
assert.match(body,
  /id="bank_edit_wrap"[\s\S]*?id="bank_edit_account_name"[\s\S]*?id="bank_edit_save_btn"[^>]*onclick="submitBankEdit_\(\)"/,
  'Bank Account Name must be part of the single Manage Edit save surface');
assert.match(files['Dashboard_Script_AssetsBankInvestments.html'],
  /updateLabel:\s*'Edit'[\s\S]*?openBankEditForm_\(accountName\)[\s\S]*?\.saveTrackedBankAccountFromDashboard\(payload\)/,
  'Bank Manage must expose Edit and submit one coordinated account-details save');
assert.match(files['Dashboard_Script_AssetsBankInvestments.html'],
  /function renderInactiveBankAccounts_\([\s\S]*?Reactivate[\s\S]*?reactivateBankAccountFromDashboard/,
  'Bank Manage must expose existing inactive accounts through Reactivate');
assert.match(files['bank_accounts.js'],
  /function saveTrackedBankAccountFromDashboard\(payload\)[\s\S]*?LockService\.getUserLock\(\)[\s\S]*?historyTargets[\s\S]*?externalLinkPreserved:\s*true[\s\S]*?were not saved and were rolled back/,
  'Bank Edit must coordinate all history names and the SYS row under one Central-safe lock with rollback');
assert.match(files['bank_accounts.js'],
  /Existing legacy blanks may remain blank during a name-only edit[\s\S]*?if \(!typeStr && oldType\)[\s\S]*?if \(!policyStr && oldPolicy\)[\s\S]*?priorityText === '' && oldPriority/,
  'Bank name-only edits must preserve legacy blank metadata instead of forcing unrelated choices');
assert.match(files['bank_accounts.js'],
  /addBankAccountFromDashboard\(payload\)[\s\S]*?addBankFitTargets[\s\S]*?addAccountsFitMap\.balanceCol[\s\S]*?fitContentColumnsToContents_[\s\S]*?function updateBankAccountValueByDate\(payload\)[\s\S]*?bankValueFitTargets[\s\S]*?fitContentColumnsToContents_[\s\S]*?function saveTrackedBankAccountFromDashboard\(payload\)[\s\S]*?bankEditFitTargets[\s\S]*?fitContentColumnsToContents_/,
  'Bank add, balance save, and account edit must fit every text or numeric column they change');
assert.match(files['planner_helpers.js'],
  /function fitContentColumnToContents_\(sheet, column, context\)[\s\S]*?autoResizeColumn\(col\)[\s\S]*?getColumnWidth\(col\)[\s\S]*?CONTENT_COLUMN_FIT_GUTTER_PX_[\s\S]*?function fitContentColumnsToContents_\(targets, context\)/,
  'Customer-editable data columns must share one content-fit helper with a rendering gutter');
assert.match(files['bills.js'],
  /function addBillFromDashboard\(payload\)[\s\S]*?billFitCol[\s\S]*?fitContentColumnsToContents_\(billFitTargets[\s\S]*?function updateTrackedBillFromDashboard\(payload, optionalSs\)[\s\S]*?appliedBillCells[\s\S]*?billEditFitTargets[\s\S]*?fitContentColumnsToContents_/,
  'Bill add and edit must fit all changed text and numeric columns');
assert.match(files['debts.js'],
  /function renameDebtFromDashboard\(payload\)[\s\S]*?fitContentColumnsToContents_\([\s\S]*?function saveTrackedDebtFromDashboard\(payload\)[\s\S]*?fitContentColumnsToContents_\([\s\S]*?function updateDebtField\(payload\)[\s\S]*?debtFieldFitTargets[\s\S]*?fitContentColumnsToContents_[\s\S]*?function addDebtFromDashboard\(payload\)[\s\S]*?fitContentColumnsToContents_\(debtFitTargets/,
  'Debt add/edit and both rename coordinators must fit changed Debt and linked Cash Flow columns');
assert.match(files['investments.js'],
  /function updateInvestmentValueByDate\(payload\)[\s\S]*?changed-column fit[\s\S]*?function addInvestmentAccountFromDashboard\(payload\)[\s\S]*?fitContentColumnsToContents_\(\[[\s\S]*?balanceCol/,
  'Investment add and value update must fit INPUT and SYS text and currency columns');
assert.match(body,
  /id="inv_edit_wrap"[\s\S]*?id="inv_edit_account_name"[\s\S]*?id="inv_edit_type"[\s\S]*?id="inv_edit_save_btn"[^>]*onclick="submitInvestmentEdit_\(\)"/,
  'Investment Account Name and Type must share one Manage Edit save surface');
assert.match(files['Dashboard_Script_AssetsBankInvestments.html'],
  /function renderInvestmentManageList_\([\s\S]*?updateLabel:\s*'Edit'[\s\S]*?openInvestmentEditForm_\(accountName\)[\s\S]*?\.saveTrackedInvestmentAccountFromDashboard\(/,
  'Investment Manage must expose Edit and submit one coordinated account-details save');
assert.match(files['Dashboard_Script_AssetsBankInvestments.html'],
  /function renderInactiveInvestmentAccounts_\([\s\S]*?Reactivate[\s\S]*?reactivateInvestmentAccountFromDashboard/,
  'Investment Manage must expose existing inactive investments through Reactivate');
assert.match(files['investments.js'],
  /function saveTrackedInvestmentAccountFromDashboard\(payload, optionalSs\)[\s\S]*?LockService\.getUserLock\(\)[\s\S]*?historyTargets[\s\S]*?investment_account_update[\s\S]*?were not saved and were rolled back/,
  'Investment Edit must coordinate every history block and the SYS row under one lock with rollback');
assert.match(files['investments.js'],
  /function setInvestmentTrackingStateFromDashboard_\(payload, activeValue, optionalSs\)[\s\S]*?LockService\.getUserLock\(\)[\s\S]*?inputTargets[\s\S]*?investment_reactivate[\s\S]*?Tracking change failed and was rolled back/,
  'Investment Stop and Reactivate must share stable identity, lock, duplicate guard, and rollback behavior');
assert.match(files['investments.js'],
  /function getInvestmentUiData\(\)[\s\S]*?currentYearNames[\s\S]*?!!currentYearNames\[key\][\s\S]*?!!managementByName\[key\][\s\S]*?historicalOnly:\s*!currentYearNames\[key\][\s\S]*?canReactivate:/,
  'Historical-only Investments must render as inactive instead of masquerading as current editable accounts');
assert.match(files['Dashboard_Script_AssetsBankInvestments.html'],
  /Historical investment — not tracked this year[\s\S]*?if \(row\.canReactivate\)/,
  'Investment inactive inventory must explain historical-only rows and avoid a non-working Reactivate action');
assert.match(files['activity_log.js'],
  /investment_account_update[\s\S]*?Account details updated[\s\S]*?investment_reactivate[\s\S]*?Account reactivated/,
  'Activity must distinguish Investment metadata edits and reactivation from dated value snapshots');
assert.match(files['house_values.js'],
  /function updateHouseValueByDate\(payload\)[\s\S]*?changed-column fit[\s\S]*?function addHouseFromDashboardLocked_\(payload\)[\s\S]*?fitContentColumnsToContents_\(\[[\s\S]*?valueCol/,
  'House add and value update must fit INPUT and SYS text and currency columns');
assert.match(body,
  /id="house_mode_manage_wrap"[\s\S]*?class="tracked-editor-manage-head"[\s\S]*?class="tracked-editor-actions"[\s\S]*?id="house_show_inactive_btn" class="small-btn debt-inactive-toggle"[^>]*aria-controls="house_inactive_wrap"[\s\S]*?id="house_manage_list"[\s\S]*?id="house_inactive_wrap" class="debt-inactive-section"[\s\S]*?id="house_inactive_list"/,
  'House Manage must place its counted inactive toggle in the same top-right action area as Bank, Investment, and Debt Manage');
assert.match(files['Dashboard_Script_AssetsHouseValues.html'],
  /function renderInactiveHouses_\([\s\S]*?Reactivate[\s\S]*?function reactivateHouseFromManage_\([\s\S]*?openDashboardConfirm_[\s\S]*?reactivateHouseFromDashboard/,
  'House Manage must reactivate preserved rows through the CashCompass confirmation surface');
assert.match(files['Dashboard_Script_AssetsHouseValues.html'],
  /setHousePanelMode\(__houseInactiveRows\.length \? 'manage' : 'add'\)/,
  'A workbook with only inactive Houses must route to recovery instead of Add');
assert.match(files['house_values.js'],
  /function getHouseUiDataForSpreadsheet_\(ss\)[\s\S]*?sysHouseAssetsRow:\s*r \+ 1[\s\S]*?inactiveHouses[\s\S]*?historyNames/,
  'House UI data must return only preserved inactive identities backed by House Values history');
assert.match(files['house_values.js'],
  /function reactivateHouseFromDashboard\(payload, optionalSs\)[\s\S]*?LockService\.getUserLock\(\)[\s\S]*?sysHouseAssetsRow[\s\S]*?expectedHouseName[\s\S]*?House identity is ambiguous[\s\S]*?getHouseValuesLifecycleTargets_[\s\S]*?HOUSES - [\s\S]*?changes were rolled back[\s\S]*?house_reactivate/,
  'House Reactivate must lock, stale-check, reconcile every preserved identity surface, roll back partial writes, and log lifecycle evidence');
assert.match(files['house_values.js'],
  /function validateNewHouseName_\(raw, optionalSs\)[\s\S]*?getHousesFromHouseValues_\(ss\)[\s\S]*?houseExistsInHouseAssetsSheet_\(name, ss\)[\s\S]*?HOUSES - /,
  'House Add must continue reserving active and inactive identities across every House store');
assert.match(files['activity_log.js'],
  /house_reactivate[\s\S]*?Tracking resumed/,
  'House Reactivate must render as non-monetary lifecycle evidence in Activity');
assert.match(files['income_sources.js'],
  /function addIncomeSourceFromDashboard\(payload\)[\s\S]*?incomeFitTargets[\s\S]*?headerMap\.payeeCol[\s\S]*?monthCol[\s\S]*?fitContentColumnsToContents_/,
  'Income add/reactivation must fit Cash Flow text and amount columns');
assert.match(files['Dashboard_Script_AssetsBankInvestments.html'],
  /Not set \(legacy account\)[\s\S]*?typeExact:\s*row\.type[\s\S]*?usePolicyExact:\s*row\.usePolicy/,
  'Bank Edit must visibly preserve legacy blank metadata in the one-save form');
assert.match(files['bank_accounts.js'],
  /function reactivateBankAccountFromDashboard\(payload\)[\s\S]*?setBankAccountActiveInAllBlocks_[\s\S]*?setAccountsActiveValue_[\s\S]*?bank_account_reactivate/,
  'Bank Reactivate must restore both Bank history blocks and SYS lifecycle state');
assert.match(files['activity_log.js'],
  /updateKind\s*\|\|\s*''\)\s*===\s*'account_details'[\s\S]*?Account renamed[\s\S]*?bank_account_reactivate/,
  'Activity must distinguish Bank metadata edits and reactivation from balance snapshots');
assert.doesNotMatch(body, /Stop tracking uses the Active column/i,
  'Debt lifecycle guidance must describe customer outcomes instead of stored state');
assert.doesNotMatch(files['Dashboard_Script_Income.html'], /Active=NO/i,
  'Income lifecycle controls must not expose an internal stored token');
assert.doesNotMatch(files['Dashboard_Script_AssetsHouseValues.html'], /The HOUSES - /,
  'House stop-tracking confirmation must not expose an internal property tab name');
assert.doesNotMatch(files['house_values.js'],
  /const message = alreadyInactive[\s\S]{0,300}?HOUSES - /,
  'House stop-tracking success must not expose an internal property tab name');
assert.match(body,
  /data-body="upcoming"[\s\S]{0,300}?Checking upcoming expenses…/,
  'Optional Upcoming Setup card must identify its initial loading state');
assert.match(body,
  /data-body="houses"[\s\S]{0,300}?Checking houses…/,
  'Optional Houses Setup card must identify its initial loading state');
assert.match(files['Dashboard_Script_Onboarding.html'],
  /onboardingLoadHousesSummary_[\s\S]*?Checking houses…[\s\S]*?Couldn’t check[\s\S]*?onboardingRenderHousesSummary_[\s\S]*?Couldn’t check[\s\S]*?None yet/,
  'Houses summary must distinguish loading, failure, and empty states');
assert.match(files['Dashboard_Script_Onboarding.html'],
  /onboardingLoadUpcomingSummary_[\s\S]*?Checking upcoming expenses…[\s\S]*?Couldn’t check[\s\S]*?onboardingRenderUpcomingSummary_[\s\S]*?Couldn’t check[\s\S]*?None yet/,
  'Upcoming summary must distinguish loading, failure, and empty states');
assert.match(files['Dashboard_Script_Onboarding.html'],
  /onboardingRenderHousesSummary_[\s\S]*?onboardingSetOptionalCardState_\('houses', active > 0\)[\s\S]*?onboardingRenderUpcomingSummary_[\s\S]*?onboardingSetOptionalCardState_\('upcoming', planned > 0\)[\s\S]*?onboardingRenderFamilyInvestingSummary_[\s\S]*?onboardingSetOptionalCardState_\('familyInvesting', count > 0\)/,
  'Every optional Setup card must distinguish Configured data from an unused Optional feature');
assert.match(styles,
  /\.onboarding-optional-tag-configured\s*\{[\s\S]*?background:\s*#dcfce7[\s\S]*?color:\s*#166534/,
  'Configured optional cards must use the established green completion treatment');
assert.match(files['Dashboard_Script_CashFlowUpcoming.html'],
  /saveBtn\.textContent\s*=\s*['"]Add upcoming expense['"]/,
  'Upcoming must preserve its sentence-case action label after form reset');
assert.match(body, /id="bills_add_weekday_field" style="display:none;"/,
  'Weekday must remain hidden until its frequency requires it');
assert.match(body, /id="bills_add_anchor_date_field" style="display:none;"/,
  'Anchor date must remain hidden until its frequency requires it');
assert.match(files['Dashboard_Script_BillsDue.html'],
  /weekdayField\.style\.display\s*=\s*\(isWeekly\s*\|\|\s*isBiweekly\)\s*\?\s*''\s*:\s*'none'/,
  'Weekly and biweekly schedules must reveal Weekday');
assert.match(files['Dashboard_Script_BillsDue.html'],
  /anchorField\.style\.display\s*=\s*isBiweekly\s*\?\s*''\s*:\s*'none'/,
  'Only biweekly schedules must reveal Anchor date');
assert.match(styles, /\.empty-state,[\s\S]*?\.bills-empty-state,[\s\S]*?\.income-empty-state/,
  'Daily-use empty states must share one visual pattern');
assert.doesNotMatch(
  [
    files['Dashboard_Script_BillsDue.html'],
    files['Dashboard_Script_Income.html'],
    files['Dashboard_Script_PlanningDebts.html']
  ].join('\n'),
  /class=["'](?:bills|income)-empty-state["'][^>]*style=/,
  'Daily-use empty states must not reintroduce one-off inline presentation'
);
assert.match(files['Dashboard_Script_Income.html'], /class="small-btn danger"[\s\S]*?Stop tracking/,
  'Income Stop tracking must remain visually destructive');
for (const id of [
  'house_stop_btn',
  'bank_update_stop_btn',
  'inv_update_stop_btn',
  'debt_update_stop_btn',
  'debt_update_stop_zone'
]) {
  assert.doesNotMatch(body, new RegExp(`id=['"]${id}['"]`),
    `${id} must stay out of the Save-only Update panels`);
}
assert.doesNotMatch(styles, /\.debt-danger-zone/,
  'The retired Debt danger-zone presentation must not return');
for (const handler of ['stopTrackingHouse', 'stopTrackingBank', 'stopTrackingInvestment']) {
  assert.doesNotMatch(
    files['PlannerDashboard.html'],
    new RegExp(`<button[^>]*onclick=['"]${handler}\\(\\)['"][^>]*>Stop tracking<\\/button>`),
    `The legacy sidebar Update panel must not duplicate ${handler}`
  );
}
assert.match(files['Dashboard_Script_TrackedEditors.html'],
  /stopButton\.textContent\s*=\s*['"]Stop tracking['"]/,
  'Shared tracked-editor Manage inventories must retain Stop tracking');
assert.match(files['Dashboard_Script_PlanningDebts.html'],
  /debt_manage_list[\s\S]*?bill-stop-tracking-btn[\s\S]*?Stop tracking/,
  'Debt Manage must retain its confirmed Stop tracking action');
for (const id of [
  'bank_update_save_btn',
  'inv_update_save_btn',
  'debt_update_save_btn',
  'hx_add_btn'
]) {
  assert.match(body, new RegExp(`id=['\"]${id}['\"][^>]*\\sdisabled`), `${id} must start disabled`);
}
assert.doesNotMatch(
  body,
  /A Year block for the current calendar year must already exist/,
  'First-run account copy must not require manual year-block setup'
);

const assetScript = files['Dashboard_Script_AssetsBankInvestments.html'];
assert.match(assetScript, /function updateBankUpdateAvailability_\(/);
assert.match(assetScript, /function updateInvestmentUpdateAvailability_\(/);
assert.match(files['Dashboard_Script_PlanningDebts.html'], /function updateDebtUpdateAvailability_\(/);
assert.match(files['Dashboard_Script_PropertiesHouseExpenses.html'], /function updateHouseExpenseAvailability_\(/);
assert.match(assetScript,
  /var bankUpdateDetailsReady_ = false;[\s\S]*?const hasLoadedSelection = hasSelection && bankUpdateDetailsReady_;/,
  'Bank writers must depend on loaded account details, not selection alone');
assert.match(assetScript,
  /const requestId = \+\+bankUpdateDetailsRequestId_;[\s\S]*?bankUpdateDetailsReady_ = false;[\s\S]*?requestId !== bankUpdateDetailsRequestId_[\s\S]*?bankUpdateDetailsReady_ = true;/,
  'Bank detail loads must reject stale responses before enabling writers');
const debtScript = files['Dashboard_Script_PlanningDebts.html'];
assert.match(debtScript,
  /var debtUpdateDetailsReady_ = false;[\s\S]*?const hasLoadedSelection = hasSelection && debtUpdateDetailsReady_;/,
  'Debt writers must depend on loaded debt details, not selection alone');
assert.match(debtScript,
  /const requestId = \+\+debtUpdateDetailsRequestId_;[\s\S]*?debtUpdateDetailsReady_ = false;[\s\S]*?requestId !== debtUpdateDetailsRequestId_[\s\S]*?debtUpdateDetailsReady_ = true;/,
  'Debt detail loads must reject stale responses before enabling writers');

assert.doesNotMatch(body,
  /section on sheet|same house expense writer|Acct PCT Avail/,
  'Normal dashboard copy must not expose sheet mechanics, writers, sidebars, or debt abbreviations');
assert.match(body, /<label for="don_taxYear">Tax year<\/label>/,
  'Donation tax year must use direct customer language');
assert.match(body, /Available credit %/,
  'Debt credit availability must use a readable label');
assert.match(assetScript,
  /function formatBankUsePolicyLabel_\(value\)[\s\S]*?USE_FOR_BILLS:\s*'Use for bills'/,
  'Stored Bank policy tokens must render as customer-facing labels');

const retirementScript = files['Dashboard_Script_PlanningRetirement.html'];
const retirementServer = files['retirement.js'];
assert.match(body,
  /id="ret_scenario_cards"[^>]*hidden[\s\S]*?id="ret_results_panel"[^>]*hidden/,
  'Retirement results must start hidden instead of flashing dash-only output');
assert.match(retirementScript,
  /function showRetirementEmptyState_[\s\S]*?scenarioCards\.hidden = true;[\s\S]*?resultsPanel\.hidden = true;/,
  'Retirement guidance states must hide unavailable result panels');
assert.match(retirementScript,
  /function hideRetirementEmptyState_[\s\S]*?scenarioCards\.hidden = false;[\s\S]*?resultsPanel\.hidden = false;/,
  'Ready Retirement data must reveal the real result panels');
assert.match(retirementServer,
  /function getRetirementScenarioRow_\(sheet, label\)[\s\S]*?findLabelValueCell_\(sheet, label\)[\s\S]*?valueCell\.getRow\(\)/,
  'Retirement scenario reads and writes must resolve rows by label for compact and legacy workbook layouts');
assert.doesNotMatch(retirementServer,
  /function getRetirementScenarioRow_[\s\S]*?['"]Target Retirement Age['"]:\s*\d+/,
  'Retirement scenario access must not depend on stale fixed row numbers');
assert.match(styles,
  /#ret_scenario_cards\[hidden\],[\s\S]*?#ret_results_panel\[hidden\]\s*\{[\s\S]*?display:\s*none !important;/,
  'Retirement hidden result panels must stay hidden despite grid styles');
assert.match(styles, /--cc-muted:\s*#526173;/,
  'Secondary text must use the strengthened contrast token');
assert.match(styles,
  /\.updated\s*\{\s*font-size:\s*13px;\s*color:\s*var\(--cc-muted\);/,
  'Freshness and contextual helper text must remain readable');
assert.match(styles,
  /@media \(max-width:\s*460px\)[\s\S]*?\.page-nav\s*\{\s*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/,
  'Narrow navigation must use readable two-column rows');
assert.match(styles,
  /@media \(max-width:\s*460px\)[\s\S]*?\.top-actions-buttons\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/,
  'Narrow header actions must use an intentional compact grid');

const propertyPerformance = files['Dashboard_Script_PropertyPerformance.html'];
for (const id of ['pp_port_loan_payments', 'pp_port_net_cash_flow']) {
  assert.ok(body.includes(`id="${id}"`), `Property Performance must expose ${id}`);
  assert.ok(propertyPerformance.includes(`'${id}'`), `Property Performance must populate ${id}`);
}
assert.match(body, /Operating Expenses[\s\S]*Loan Payments[\s\S]*Net Cash Flow/,
  'Property Performance table must show expenses, financing, and final cash flow');
assert.doesNotMatch(body, />Operating Net</,
  'Property Performance must not expose the redundant Operating Net summary or column');
assert.doesNotMatch(propertyPerformance, /['"]pp_port_net['"]/,
  'Property Performance must not populate the removed Operating Net summary');
assert.match(body, /id="pp_table"[^>]*min-width:1000px/,
  'Property Performance table must remain compact while preserving a safe scroll floor');
for (const heading of ['Loan Balance', 'Operating Expenses', 'Loan Payments', 'Net Cash Flow']) {
  assert.match(body, new RegExp(`<th[^>]*white-space:normal[^>]*>${heading}</th>`),
    `${heading} must be allowed to wrap onto two lines`);
}
assert.match(propertyPerformance, /colspan="9"/,
  'Property Performance empty and loading states must span the compact table');
assert.doesNotMatch(propertyPerformance, /colspan="10"/,
  'Property Performance must not retain the removed table column span');
assert.doesNotMatch(files['Dashboard_Script_PropertyPerformance.html'], /INPUT\s*-|SYS\s*-|OUT\s*-|LOG\s*-/,
  'Property Performance client copy must not expose internal workbook tab names');
assert.match(files['Dashboard_Styles.html'], /\.currency-negative\s*\{\s*color:\s*#b91c1c\s*!important;/,
  'Property Performance negative currency must use the established danger red');
assert.match(propertyPerformance, /classList\.toggle\(['"]currency-negative['"],\s*Number\(v\) < 0\)/,
  'Property Performance summary cards must mark negative values');
assert.match(propertyPerformance, /return Number\(value\) < 0 \? ' class="currency-negative"' : '';/,
  'Property Performance rows must mark negative values');
assert.match(body,
  /class="property-performance-overview"[\s\S]*?class="property-performance-controls"[\s\S]*?id="pp_year"[\s\S]*?class="property-performance-refresh"[\s\S]*?class="property-performance-kpis"/,
  'Property Performance must keep compact Year and Refresh controls beside the KPI area');
assert.match(styles,
  /\.property-performance-overview\s*\{[\s\S]*?grid-template-columns:\s*minmax\(210px, 1fr\) minmax\(0, 3fr\);/,
  'Property Performance controls must occupy one quarter of the wide layout');
assert.match(styles,
  /\.property-performance-kpis\s*\{[\s\S]*?grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\);/,
  'Property Performance must give all five portfolio KPIs a clean full summary row');
assert.match(styles,
  /\.property-performance-kpi--net\.is-negative\s*\{[\s\S]*?background:\s*#fef2f2;/,
  'Negative Net cash flow must receive a distinct but calm summary treatment');
assert.match(propertyPerformance,
  /id === 'pp_port_net_cash_flow'[\s\S]*?card\.classList\.toggle\('is-negative', Number\(v\) < 0\)[\s\S]*?card\.classList\.toggle\('is-positive', Number\(v\) > 0\)/,
  'Net cash flow styling must reflect its loaded financial sign');
assert.match(styles,
  /@media \(max-width:\s*1180px\)[\s\S]*?\.property-performance-overview\s*\{\s*grid-template-columns:\s*1fr;\s*\}[\s\S]*?\.property-performance-kpis\s*\{\s*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\);\s*\}/,
  'Property Performance controls and KPIs must reflow cleanly below wide desktop');

const onboardingClient = files['Dashboard_Script_Onboarding.html'];
assert.doesNotMatch(onboardingClient, /step\.sheetName/, 'Setup cards must not render internal sheet names');
assert.doesNotMatch(onboardingClient, /Error reading setup status:/, 'Setup must not render raw server errors');

const onboardingServer = files['onboarding.js'];
for (const leakedCopy of [
  'Bank Accounts sheet not found.',
  'Debts sheet not found.',
  'Bills sheet not found.',
  "'No income detected on ' +"
]) {
  assert.ok(!onboardingServer.includes(leakedCopy), `Setup copy must not include: ${leakedCopy}`);
}
const incomeServer = files['income_sources.js'];
assert.match(incomeServer, /var INCOME_MIN_MONTHS_FOR_RECURRING_ = 1;/,
  'A source explicitly added for the current month must immediately remain manageable');
assert.match(incomeServer,
  /function classifyIncomeGroupsInSheet_\(sheet, optionalDisplay, optionalHeaderMap\)[\s\S]*?incomeGroupQualifiesAsRecurring_\(groups\[i\]\)/,
  'Income must expose one shared recurring/other classifier');
assert.match(incomeServer,
  /getActiveIncomeSourcesForManagementFromDashboard\(\)[\s\S]*?classifyIncomeGroupsInSheet_\(sheet\)\.recurring/,
  'Income management must use the shared recurring bucket');
assert.match(incomeServer,
  /getOtherDetectedIncomeFromLatestCashFlowFromDashboard\(\)[\s\S]*?classifyIncomeGroupsInSheet_\(sheet\)\.other/,
  'Other detected income must use the complementary shared bucket');
const incomeClassifierStart = incomeServer.indexOf('function incomeGroupQualifiesAsRecurring_(');
const incomeClassifierEnd = incomeServer.indexOf('/*  Dashboard: list active income sources', incomeClassifierStart);
assert.ok(incomeClassifierStart >= 0 && incomeClassifierEnd > incomeClassifierStart,
  'Shared Income classification must remain directly testable');
const classifyIncome = Function(
  'analyzeIncomeGroupsInSheet_',
  `${incomeServer.slice(incomeClassifierStart, incomeClassifierEnd)}
   var INCOME_MIN_MONTHS_FOR_RECURRING_ = 1;
   return classifyIncomeGroupsInSheet_;`
)(() => [
  { displayName: 'Salary', monthsHit: 1, avgNonZero: 5000, excluded: false, hasNegativeMonth: false },
  { displayName: 'Annual Bonus', monthsHit: 1, avgNonZero: 1200, excluded: true, hasNegativeMonth: false },
  { displayName: 'Adjustment', monthsHit: 2, avgNonZero: 300, excluded: false, hasNegativeMonth: true }
]);
const classifiedIncome = classifyIncome({});
assert.deepEqual(classifiedIncome.recurring.map((group) => group.displayName), ['Salary'],
  'A one-month non-excluded source must be tracked immediately');
assert.deepEqual(classifiedIncome.other.map((group) => group.displayName), ['Annual Bonus', 'Adjustment'],
  'Excluded and negative-month groups must remain Other detected');
assert.ok((onboardingServer.match(/classifyIncomeGroupsInSheet_\(.*?\)/g) || []).length >= 2,
  'Setup status and detail must use the same shared Income classifier');
assert.doesNotMatch(onboardingServer, /g\.months\s*>=\s*1/,
  'Setup must not retain its own duplicated month-threshold classifier');

const help = files['Dashboard_Help.html'];
assert.doesNotMatch(help, /loadOnboardingSection\(\)|Dashboard_Script_Onboarding\.html|status === 'missing'/);
assert.doesNotMatch(help, /The workbook must already have that Year block/);
assert.doesNotMatch(help, /(?:INPUT|SYS|OUT|LOG)\s*-/,
  'Customer Help must not expose internal workbook tab names');
assert.doesNotMatch(help, /Advanced sheet reference|details JSON|planner_core\.js/,
  'Customer Help must not read like an engineering reference');

const customerCopy = [
  body,
  render,
  files['Dashboard_Script_PlanningNextActions.html'],
  files['Dashboard_Script_RollingDebtPayoff.html'],
  files['QuickAddPaymentUI.html'],
  files['dashboard_data.js']
].join('\n');
for (const leakedCopy of [
  'No rows in OUT - History',
  'No OUT - History rows',
  'No bank accounts found in <code>SYS - Accounts</code>',
  'Current SYS - Assets balance',
  '<strong>Sheet:</strong>',
  '<strong>Current value in cell:</strong>',
  '<strong>Existing row:</strong>'
]) {
  assert.ok(!customerCopy.includes(leakedCopy), `Customer UI must not include: ${leakedCopy}`);
}
assert.match(render, /function customerSafeErrorMessage_\(/,
  'Dashboard must keep raw workbook and stack details out of customer error states');
assert.match(render,
  /function isTransientRpcTransportError_\([\s\S]*?HTTP\\s\*0[\s\S]*?NetworkError[\s\S]*?Connection failure/,
  'Dashboard must recognize the observed Apps Script HTTP 0 transport failure');
assert.match(render,
  /function runReadOnlyRpcWithRetry_\([\s\S]*?const maxAttempts = 2;[\s\S]*?isTransientRpcTransportError_[\s\S]*?setTimeout\(invoke_, retryDelayMs\)/,
  'Read-only dashboard RPCs must use one bounded retry for transient transport failures');
assert.match(render,
  /isTransientRpcTransportError_\(raw\)[\s\S]*?CashCompass did not repeat the action/,
  'Uncertain writer outcomes must hide raw transport details and explain that the action was not repeated');

const retryStart = render.indexOf('function isTransientRpcTransportError_(');
const retryEnd = render.indexOf('/**\n * Keep implementation details', retryStart);
assert.ok(retryStart >= 0 && retryEnd > retryStart,
  'Transport recovery helpers must remain dynamically testable');
const retryCtx = vm.createContext({
  setTimeout: function(fn) { fn(); },
  Error,
  Number,
  String
});
vm.runInContext(render.slice(retryStart, retryEnd), retryCtx);
assert.equal(retryCtx.isTransientRpcTransportError_(
  new Error('NetworkError: Connection failure due to HTTP 0')), true,
  'The observed HTTP 0 error must be classified as transient');
assert.equal(retryCtx.isTransientRpcTransportError_(
  new Error("We're sorry, a server error occurred while reading from storage. Error code FAILED_PRECONDITION.")), true,
  'The observed Apps Script storage precondition failure must be classified as transient');
assert.equal(retryCtx.isTransientRpcTransportError_(
  new Error('FAILED_PRECONDITION: workbook setup is incomplete.')), false,
  'Unrelated precondition failures must never be classified as transient');
assert.equal(retryCtx.isTransientRpcTransportError_(
  new Error('Account name is required.')), false,
  'Business validation failures must never be classified as transport retries');

let retryInvocations = 0;
let retryNotices = 0;
let recoveredNotices = 0;
let retryResult = '';
retryCtx.runReadOnlyRpcWithRetry_({
  invoke: function(success, failure) {
    retryInvocations += 1;
    if (retryInvocations === 1) {
      failure(new Error('NetworkError: Connection failure due to HTTP 0'));
    } else {
      success('recovered');
    }
  },
  onRetry: function() { retryNotices += 1; },
  onRecovered: function() { recoveredNotices += 1; },
  onSuccess: function(value) { retryResult = value; },
  onFailure: function() { retryResult = 'failed'; }
});
assert.equal(retryInvocations, 2, 'A transient read must run exactly one retry');
assert.equal(retryNotices, 1, 'A transient read must expose one calm retry transition');
assert.equal(recoveredNotices, 1, 'A recovered read must clear its temporary retry transition');
assert.equal(retryResult, 'recovered', 'The bounded retry must deliver the successful read result');

let businessInvocations = 0;
let businessFailure = false;
retryCtx.runReadOnlyRpcWithRetry_({
  invoke: function(_success, failure) {
    businessInvocations += 1;
    failure(new Error('Account name is required.'));
  },
  onFailure: function() { businessFailure = true; }
});
assert.equal(businessInvocations, 1, 'A business failure must not be retried');
assert.equal(businessFailure, true, 'A business failure must be delivered immediately');

let persistentStorageInvocations = 0;
let persistentStorageFailures = 0;
retryCtx.runReadOnlyRpcWithRetry_({
  invoke: function(_success, failure) {
    persistentStorageInvocations += 1;
    failure(new Error(
      "We're sorry, a server error occurred while reading from storage. Error code FAILED_PRECONDITION."
    ));
  },
  onFailure: function() { persistentStorageFailures += 1; }
});
assert.equal(persistentStorageInvocations, 2,
  'A persistent storage failure must stop after exactly one retry');
assert.equal(persistentStorageFailures, 1,
  'A persistent storage failure must surface once after bounded recovery is exhausted');

const customerErrorStart = render.indexOf('function customerSafeErrorMessage_(');
const customerErrorEnd = render.indexOf('\nfunction toNumber(', customerErrorStart);
assert.ok(customerErrorStart >= 0 && customerErrorEnd > customerErrorStart,
  'Customer-safe error formatting must remain dynamically testable');
retryCtx.window = { console: { error: function() {} } };
vm.runInContext(render.slice(customerErrorStart, customerErrorEnd), retryCtx);
const safeTransportMessage = retryCtx.customerSafeErrorMessage_(
  new Error('NetworkError: Connection failure due to HTTP 0')
);
assert.doesNotMatch(safeTransportMessage, /NetworkError|HTTP\s*0|Connection failure/i,
  'Raw Apps Script transport details must never reach the customer');
assert.match(safeTransportMessage, /did not repeat the action/i,
  'An uncertain write outcome must tell the customer that CashCompass did not repeat it');

for (const [source, writerName] of [
  [render, 'runPlannerNow'],
  [files['Dashboard_Script_AssetsBankInvestments.html'], 'saveBank'],
  [files['Dashboard_Script_AssetsBankInvestments.html'], 'saveInvestment'],
  [files['Dashboard_Script_PlanningDebts.html'], 'saveDebt'],
  [files['Dashboard_Script_Income.html'], 'submitNewIncomeSource']
]) {
  const start = source.indexOf(`function ${writerName}(`);
  const next = source.indexOf('\nfunction ', start + 1);
  const body = source.slice(start, next >= 0 ? next : source.length);
  assert.ok(start >= 0, `${writerName} must exist`);
  assert.doesNotMatch(body, /runReadOnlyRpcWithRetry_/,
    `${writerName} must never auto-retry after an uncertain write outcome`);
}
for (const [source, loaderName] of [
  [render, 'refreshSnapshot'],
  [files['Dashboard_Script_BillsDue.html'], 'loadBillsDueUi_'],
  [files['Dashboard_Script_BillsDue.html'], 'loadRecurringBillsUi_'],
  [files['Dashboard_Script_BillsDue.html'], 'loadActiveBillsManagementUi_'],
  [files['Dashboard_Script_CashFlowUpcoming.html'], 'loadUpcomingSection'],
  [files['Dashboard_Script_PlanningRetirement.html'], 'loadRetirementSection'],
  [files['Dashboard_Script_PlanningPurchaseSim.html'], 'loadPurchaseSimulatorSection']
]) {
  const start = source.indexOf(`function ${loaderName}(`);
  const next = source.indexOf('\nfunction ', start + 1);
  const body = source.slice(start, next >= 0 ? next : source.length);
  assert.ok(start >= 0, `${loaderName} must exist`);
  assert.doesNotMatch(body, /runReadOnlyRpcWithRetry_/,
    `${loaderName} has an idempotent write/create side effect and must not auto-retry`);
}

const trackedEditors = files['Dashboard_Script_TrackedEditors.html'];
const webShell = files['PlannerDashboardWeb.html'];
assert.ok(
  webShell.indexOf("includeHtml_('Dashboard_Script_TrackedEditors')") <
    webShell.indexOf("includeHtml_('Dashboard_Script_AssetsHouseValues')"),
  'Shared tracked-editor primitives must load before feature-specific editors'
);
for (const helper of [
  'setTrackedEditorMode_',
  'trackedEditorItemsFromSelect_',
  'openTrackedEditorItemForUpdate_',
  'stopTrackedEditorItem_',
  'renderTrackedEditorManageList_'
]) {
  assert.match(trackedEditors, new RegExp(`function ${helper}\\(`),
    `Shared tracked-editor helper missing: ${helper}`);
}
for (const [prefix, label] of [
  ['bank', 'Bank Accounts'],
  ['house', 'Houses'],
  ['inv', 'Investments']
]) {
  for (const mode of ['update', 'add', 'manage']) {
    assert.match(body, new RegExp(`id=["']${prefix}_mode_${mode}_btn["']`),
      `${label} must expose the ${mode} mode`);
    assert.match(body, new RegExp(`id=["']${prefix}_mode_${mode}_wrap["']`),
      `${label} must preserve a dedicated ${mode} surface`);
  }
}
for (const [prefix, setter, statusId, label] of [
  ['house', 'setHousePanelMode', 'house_status', 'Houses'],
  ['bank', 'setBankPanelMode', 'bank_status', 'Bank Accounts'],
  ['inv', 'setInvestmentPanelMode', 'inv_status', 'Investments']
]) {
  const manageStart = body.indexOf(`id="${prefix}_mode_manage_wrap"`);
  const manageEnd = body.indexOf(`id="${statusId}"`, manageStart);
  const manageSurface = body.slice(manageStart, manageEnd);
  assert.ok(manageStart >= 0 && manageEnd > manageStart,
    `${label} must retain a bounded Manage surface`);
  assert.doesNotMatch(manageSurface, new RegExp(`${setter}\\('add'\\)`),
    `${label} Manage must not duplicate the primary Add new mode`);
}
for (const [source, setter, renderer] of [
  [files['Dashboard_Script_AssetsBankInvestments.html'], 'setBankPanelMode', 'renderBankManageList_'],
  [files['Dashboard_Script_AssetsBankInvestments.html'], 'setInvestmentPanelMode', 'renderInvestmentManageList_'],
  [files['Dashboard_Script_AssetsHouseValues.html'], 'setHousePanelMode', 'renderHouseManageList_']
]) {
  assert.match(source, new RegExp(`function ${setter}\\([\\s\\S]*?setTrackedEditorMode_\\(`),
    `${setter} must reuse the shared mode controller`);
  assert.match(source, new RegExp(`function ${renderer}\\([\\s\\S]*?renderTrackedEditorManageList_\\(`),
    `${renderer} must reuse the shared manage-list renderer`);
}
const bankTabs = body.slice(
  body.indexOf('aria-label="Bank account mode"'),
  body.indexOf('id="bank_mode_update_wrap"')
);
assert.doesNotMatch(bankTabs, /Review imports|Paste CSV/,
  'Bank import utilities must remain secondary tools under Manage accounts');
assert.match(body,
  /id=["']bank_mode_manage_wrap["'][\s\S]*?Review pending imports[\s\S]*?id=["']bank_mode_import_btn["']/,
  'Bank Manage must retain both guarded import utilities');
assert.ok(
  files['Dashboard_Script_Onboarding.html'].includes("onboardingOpenBankAccountsPage(\\'add\\')") &&
    files['Dashboard_Script_Onboarding.html'].includes("onboardingOpenBankAccountsPage(\\'manage\\')"),
  'Populated Bank Setup detail must offer explicit Add and Manage handoffs'
);
assert.ok(
  files['Dashboard_Script_Onboarding.html'].includes("onboardingOpenHousesPage(\\'add\\')") &&
    files['Dashboard_Script_Onboarding.html'].includes("onboardingOpenHousesPage(\\'manage\\')"),
  'Populated Houses Setup detail must offer explicit Add and Manage handoffs'
);
assert.match(styles,
  /@media \(max-width:\s*460px\)[\s\S]*?\.tracked-editor-row[\s\S]*?flex-direction:\s*column/,
  'Tracked-editor inventory rows must stack on narrow screens');

assert.match(render,
  /function setSelectLoading\([\s\S]*?opt\.disabled = true[\s\S]*?sel\.disabled = true[\s\S]*?function setSelectLoadFailure/,
  'Async pickers must share a disabled loading and failure presentation');
assert.match(render,
  /function setSelectLoading\([\s\S]*?sel\.dataset\.loadState = 'loading'[\s\S]*?function setSelectLoadFailure\([\s\S]*?sel\.dataset\.loadState = 'error'/,
  'Async pickers must distinguish unresolved loading from an authoritative empty result');
for (const [name, source, id, loading, failure] of [
  ['House', files['Dashboard_Script_AssetsHouseValues.html'], 'house_house', 'Loading houses…', 'Couldn’t load houses'],
  ['Bank', files['Dashboard_Script_AssetsBankInvestments.html'], 'bank_account', 'Loading bank accounts…', 'Couldn’t load bank accounts'],
  ['Investment', files['Dashboard_Script_AssetsBankInvestments.html'], 'inv_account', 'Loading investment accounts…', 'Couldn’t load investment accounts'],
  ['House expense', files['Dashboard_Script_PropertiesHouseExpenses.html'], 'hx_house', 'Loading properties…', 'Couldn’t load properties'],
  ['Property year', files['Dashboard_Script_PropertyPerformance.html'], 'pp_year', 'Loading years…', 'Couldn’t load years'],
  ['Debt', files['Dashboard_Script_PlanningDebts.html'], 'debt_account', 'Loading debt accounts…', 'Couldn’t load debt accounts']
]) {
  assert.ok(source.includes(`setSelectLoading('${id}', '${loading}')`),
    `${name} picker must identify its loading state`);
  assert.ok(source.includes(`setSelectLoadFailure('${id}', '${failure}')`),
    `${name} picker must remain disabled with a contextual failure option`);
}
for (const [name, source, readyFunction, availabilityFunction, loading, empty] of [
  ['House', files['Dashboard_Script_AssetsHouseValues.html'], 'fillHouseDropdownFromData_',
    'updateHouseUpdateAvailability_', 'Loading houses…', 'Add your first house'],
  ['Bank', files['Dashboard_Script_AssetsBankInvestments.html'], 'fillBankAccountDropdownFromData_',
    'updateBankUpdateAvailability_', 'Loading bank accounts…', 'Add your first bank account'],
  ['Investment', files['Dashboard_Script_AssetsBankInvestments.html'], 'fillInvestmentAccountDropdownFromData_',
    'updateInvestmentUpdateAvailability_', 'Loading investment accounts…', 'Add your first investment account'],
  ['Debt', files['Dashboard_Script_PlanningDebts.html'], 'filterDebtAccounts',
    'updateDebtUpdateAvailability_', 'Loading debt accounts…', 'Add your first debt account']
]) {
  assert.ok(functionSource_(source, readyFunction).includes("dataset.loadState = 'ready'"),
    `${name} picker must mark successful data as authoritative before evaluating emptiness`);
  const availability = functionSource_(source, availabilityFunction);
  assert.ok(availability.includes("loadState === 'loading'") &&
    availability.indexOf(loading) < availability.indexOf(empty),
  `${name} Update guidance must show loading before considering the first-item empty state`);
  assert.ok(availability.includes("loadState === 'error'"),
    `${name} Update guidance must not present a load failure as an empty workbook`);
}
const trackedManageRenderer = functionSource_(
  files['Dashboard_Script_TrackedEditors.html'], 'renderTrackedEditorManageList_');
assert.match(trackedManageRenderer,
  /dataset\.loadState\s*\|\|\s*'loading'[\s\S]*?loadState === 'loading'[\s\S]*?loadingBlockHtml[\s\S]*?loadState === 'error'[\s\S]*?onRetry[\s\S]*?if \(!items\.length\)/,
  'Tracked Manage lists must resolve loading and failure before considering an authoritative empty result');
for (const [name, source, renderer, selectId, loading, failure, loader] of [
  ['House', files['Dashboard_Script_AssetsHouseValues.html'], 'renderHouseManageList_',
    'house_house', 'Loading houses…', 'Couldn’t load houses.', 'loadHouseSection'],
  ['Bank', files['Dashboard_Script_AssetsBankInvestments.html'], 'renderBankManageList_',
    'bank_account', 'Loading bank accounts…', 'Couldn’t load bank accounts.', 'loadBankSection'],
  ['Investment', files['Dashboard_Script_AssetsBankInvestments.html'], 'renderInvestmentManageList_',
    'inv_account', 'Loading investment accounts…', 'Couldn’t load investment accounts.', 'loadInvestmentSection']
]) {
  const manageSource = functionSource_(source, renderer);
  assert.ok(manageSource.includes(`selectId: '${selectId}'`) &&
    manageSource.includes(`loadingMessage: '${loading}'`) &&
    manageSource.includes(`failureMessage: '${failure}'`) &&
    manageSource.includes(`onRetry: ${loader}`),
  `${name} Manage must bind its loading truth and retry action to the authoritative selector`);
  assert.match(functionSource_(source, loader),
    new RegExp(`setSelectLoadFailure\\('${selectId}'[\\s\\S]*?${renderer}\\(\\)`),
    `${name} Manage must replace an unresolved loader with a failure state instead of a false empty state`);
}
assert.match(files['Dashboard_Script_CashFlowUpcoming.html'],
  /ov_upcoming_next7[\s\S]*?ov_upcoming_next30[\s\S]*?Loading upcoming expenses…/,
  'Overview Upcoming values must publish contextual loading state before data arrives');
assert.match(files['Dashboard_Script_PropertiesHouseExpenses.html'],
  /ov_house_thisMonth[\s\S]*?ov_house_ytd[\s\S]*?Loading property expenses…/,
  'Overview Property values must publish contextual loading state before data arrives');
assert.doesNotMatch(files['Dashboard_Script_PlanningDebtPayoff.html'],
  /setStatus\('debt_payoff_read_status', 'Loading…'/,
  'Debt Overview must not announce a duplicate generic loader');
assert.doesNotMatch(files['Dashboard_Script_RollingDebtPayoff.html'],
  /setStatus\('rolling_debt_payoff_status', 'Loading…'/,
  'Rolling Payoff must not announce a duplicate generic loader');
assert.match(files['Dashboard_Script_Onboarding.html'],
  /cls === 'dash-status-loading'[\s\S]*?loadingIndicatorHtml\(text/,
  'Setup status must use the shared accessible loading indicator');
assert.match(files['Dashboard_Script_PlanningDebts.html'],
  /loadingBlockHtml\('Loading active debts…'\)[\s\S]*?loadingBlockHtml\('Loading inactive debts…'\)/,
  'Debt Manage lists must use shared contextual loaders');
for (const label of [
  'Running self-test…',
  'Loading workbook audit…',
  'Loading financial integrity audit…',
  'Loading repair history…'
]) {
  assert.ok(files['AdminDiagnostics.html'].includes(label),
    `Admin Diagnostics must identify the ${label} state`);
}

function openHtmlAncestorsAtId_(source, targetId) {
  const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
  const stack = [];
  const html = source.replace(/<!--[\s\S]*?-->/g, '');
  const tagPattern = /<\/?([A-Za-z][\w:-]*)(?:\s[^<>]*?)?>/g;
  let match;
  while ((match = tagPattern.exec(html))) {
    const token = match[0];
    const tag = match[1].toLowerCase();
    if (/^<\//.test(token)) {
      const openIndex = stack.map((node) => node.tag).lastIndexOf(tag);
      if (openIndex >= 0) stack.splice(openIndex);
      continue;
    }

    const id = token.match(/\bid\s*=\s*["']([^"']+)["']/i)?.[1] || '';
    const classes = (token.match(/\bclass\s*=\s*["']([^"']*)["']/i)?.[1] || '')
      .split(/\s+/)
      .filter(Boolean);
    if (id === targetId) return stack.slice();
    if (!/\/>$/.test(token) && !voidTags.has(tag)) stack.push({ tag, id, classes });
  }
  assert.fail(`${targetId} must exist for HTML ancestor regression coverage`);
}

function functionSource_(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} must exist for behavioral regression coverage`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  assert.fail(`${name} must have a complete function body`);
}

const selectElements = {};
const selectContext = vm.createContext({
  document: {
    getElementById: (id) => selectElements[id] || null,
    createElement: () => ({ value: '', textContent: '', selected: false, disabled: false })
  }
});
selectElements.picker = {
  innerHTML: 'stale',
  disabled: false,
  dataset: {},
  options: [],
  appendChild(option) { this.options.push(option); }
};
vm.runInContext(
  functionSource_(render, 'setSelectLoading') + '\n' + functionSource_(render, 'setSelectLoadFailure'),
  selectContext
);
selectContext.setSelectLoading('picker', 'Loading choices…');
assert.equal(selectElements.picker.disabled, true,
  'A loading picker must be disabled immediately');
assert.equal(selectElements.picker.dataset.loadState, 'loading',
  'A loading picker must remain unresolved rather than appearing authoritatively empty');
assert.equal(selectElements.picker.options[0].textContent, 'Loading choices…',
  'A loading picker must explain what is loading');
selectContext.setSelectLoadFailure('picker', 'Couldn’t load choices');
assert.equal(selectElements.picker.disabled, true,
  'A failed picker must remain disabled');
assert.equal(selectElements.picker.dataset.loadState, 'error',
  'A failed picker must remain distinct from a successful empty result');
assert.equal(selectElements.picker.options.at(-1).textContent, 'Couldn’t load choices',
  'A failed picker must replace loading copy with a terminal failure state');

function overviewFailureContext_(source, functionName, elementIds) {
  const elements = Object.fromEntries(elementIds.map((id) => [id, { innerHTML: '', textContent: '' }]));
  elements.up_dueDate = { value: '' };
  let failureHandler = null;
  const runner = {
    withSuccessHandler() { return this; },
    withFailureHandler(handler) { failureHandler = handler; return this; },
    getUpcomingExpensesUiData() {},
    getHouseExpenseSummaryData() {}
  };
  const context = vm.createContext({
    document: { getElementById: (id) => elements[id] || null },
    google: { script: { run: runner } },
    loadingIndicatorHtml: (label, announce) => `${label}|${announce}`,
    loadingBlockHtml: (label) => label,
    setStatus() {},
    escapeHtml: String,
    customerSafeErrorMessage_: () => 'Could not load.',
    window: { __dashboardState: 'setUp' },
    startDashboardInitialLoadStage_: () => null,
    finishDashboardInitialLoadStage_: () => {}
  });
  const supportSource = functionName === 'loadUpcomingSection'
    ? functionSource_(source, 'setUpcomingDismissGuidanceVisible_') + '\n'
    : '';
  vm.runInContext(supportSource + functionSource_(source, functionName), context);
  context[functionName]();
  assert.equal(typeof failureHandler, 'function', `${functionName} must register a failure handler`);
  failureHandler(new Error('offline'));
  return elements;
}

const upcomingFailureElements = overviewFailureContext_(
  files['Dashboard_Script_CashFlowUpcoming.html'],
  'loadUpcomingSection',
  ['ov_upcoming_next7', 'ov_upcoming_next30']
);
assert.deepEqual(
  [upcomingFailureElements.ov_upcoming_next7.textContent, upcomingFailureElements.ov_upcoming_next30.textContent],
  ['—', '—'],
  'Upcoming failure must replace every Overview loading placeholder with a terminal value'
);

const upcomingListRoot = { innerHTML: '' };
const upcomingDismissGuidance = { hidden: false };
const upcomingListContext = vm.createContext({
  document: {
    getElementById(id) {
      if (id === 'upcoming_list') return upcomingListRoot;
      if (id === 'upcoming_dismiss_guidance') return upcomingDismissGuidance;
      return null;
    }
  },
  fmtCurrency: value => `$${Number(value).toFixed(2)}`,
  escapeHtml: String,
  escapeJs: String,
  String,
  Number
});
vm.runInContext(
  functionSource_(files['Dashboard_Script_CashFlowUpcoming.html'], 'upcomingBucketClass') + '\n' +
    functionSource_(files['Dashboard_Script_CashFlowUpcoming.html'], 'setUpcomingDismissGuidanceVisible_') + '\n' +
    functionSource_(files['Dashboard_Script_CashFlowUpcoming.html'], 'renderUpcomingList'),
  upcomingListContext
);
upcomingListContext.renderUpcomingList([]);
assert.equal(upcomingDismissGuidance.hidden, true,
  'Upcoming Dismiss guidance must be hidden when no active expense exists');
upcomingListContext.renderUpcomingList([{
  id: 'up-1', status: 'Planned', amount: 25, expenseName: 'Fixture', dueDate: '2026-08-01'
}]);
assert.equal(upcomingDismissGuidance.hidden, false,
  'Upcoming Dismiss guidance must appear when an active expense can be dismissed');

const houseSummaryFailureElements = overviewFailureContext_(
  files['Dashboard_Script_PropertiesHouseExpenses.html'],
  'loadHouseExpenseSummaries',
  [
    'ov_house_thisMonth',
    'ov_house_ytd',
    'hx_summaryThisMonthByHouse',
    'hx_summaryYtdByHouse',
    'hx_summaryYtdByType'
  ]
);
assert.deepEqual(
  [houseSummaryFailureElements.ov_house_thisMonth.textContent, houseSummaryFailureElements.ov_house_ytd.textContent],
  ['—', '—'],
  'Property-summary failure must replace every Overview loading placeholder with a terminal value'
);

const bankSource = files['Dashboard_Script_AssetsBankInvestments.html'];
const bankRequests = [];
const bankFailureEvents = [];
const bankContext = vm.createContext({
  document: { getElementById: () => ({ value: '' }) },
  setSelectLoading() {},
  setSelectLoadFailure: (...args) => bankFailureEvents.push(['picker', ...args]),
  updateBankUpdateAvailability_() {},
  renderBankManageList_() {},
  applyBankImportCsvPasteVisibility_() {},
  runReadOnlyRpcWithRetry_: (request) => bankRequests.push(request),
  setStatusLoading: (...args) => bankFailureEvents.push(['retry', ...args]),
  setStatus: (...args) => bankFailureEvents.push(['status', ...args]),
  renderSurfaceState_: (...args) => bankFailureEvents.push(['surface', ...args]),
  customerSafeErrorMessage_: (_value, fallback) => fallback,
  fillBankAccountDropdownFromData_() {},
  focusBankTarget_() {},
  loadBankData() {},
  startDashboardInitialLoadStage_: () => null,
  finishDashboardInitialLoadStage_: () => {},
  pendingFocus: null,
  String
});
vm.runInContext(
  'var bankUpdateDetailsReady_ = false; var bankSectionRequestId_ = 0;\n' +
    functionSource_(bankSource, 'loadBankSection'),
  bankContext
);
bankContext.loadBankSection();
bankContext.loadBankSection();
assert.equal(bankRequests.length, 2, 'Overlapping Bank section reads must remain independently tracked');
bankRequests[0].onFailure(new Error('stale failure'));
assert.equal(bankFailureEvents.length, 0,
  'An older Bank failure must not overwrite the newer picker or status');
bankRequests[1].onFailure(new Error('current failure'));
assert.equal(bankFailureEvents.some((event) => event[0] === 'picker'), true,
  'The current Bank failure must publish its terminal picker state');

const assetsEditors = files['Dashboard_Script_AssetsBankInvestments.html'];
const bankSaveSource = functionSource_(assetsEditors, 'saveBank');
assert.match(bankSaveSource,
  /setStatus\('bank_status',[\s\S]*?__cashCompassBankSaveDiagnosticListener[\s\S]*?__cashCompassSuppressBankSaveFollowUpForE2E === true\) return;[\s\S]*?loadBankData\(true\)[\s\S]*?runPlannerAndRefreshDashboardFromSave/,
  'The guarded Save diagnostic must observe shipping completion and suppress only later refresh work');
assert.match(functionSource_(assetsEditors, 'fillBankAccountDropdownFromData_'),
  /Array\.isArray\(data\.accounts\)\s*&&\s*data\.accounts\.length\s*===\s*0[\s\S]*?setBankPanelMode\('add'\)/,
  'A confirmed-empty Bank response must route to Add new');
assert.match(functionSource_(assetsEditors, 'fillInvestmentAccountDropdownFromData_'),
  /Array\.isArray\(data\.accounts\)\s*&&\s*data\.accounts\.length\s*===\s*0[\s\S]*?setInvestmentPanelMode\('add'\)/,
  'A confirmed-empty Investment response must route to Add new');
assert.match(functionSource_(files['Dashboard_Script_PlanningDebts.html'], 'loadDebtSection'),
  /Array\.isArray\(data\.debts\)\s*&&\s*data\.debts\.length\s*===\s*0[\s\S]*?setDebtPanelMode\('add'\)/,
  'A confirmed-empty Debt response must route to Add new');
for (const [label, source, loader, modeSetter] of [
  ['Bank', assetsEditors, 'loadBankSection', 'setBankPanelMode'],
  ['Investment', assetsEditors, 'loadInvestmentSection', 'setInvestmentPanelMode'],
  ['Debt', files['Dashboard_Script_PlanningDebts.html'], 'loadDebtSection', 'setDebtPanelMode']
]) {
  const loaderSource = functionSource_(source, loader);
  assert.match(loaderSource, /renderSurfaceState_\([\s\S]*?actionLabel:\s*'Try again'/,
    `${label} read failure must provide a visible Try again action`);
  assert.doesNotMatch(loaderSource,
    new RegExp(`onFailure:[\\s\\S]*?${modeSetter}\\('add'\\)`),
    `${label} failure must never be misclassified as an empty response`);
}

assert.match(render,
  /function renderSurfaceState_\([\s\S]*?document\.createElement\('strong'\)[\s\S]*?addEventListener\('click', config\.onAction\)/,
  'Shared surface states must use safe DOM construction and callable actions');
assert.doesNotMatch(functionSource_(render, 'renderSurfaceState_'), /innerHTML\s*=/,
  'Shared surface states must not interpolate customer or server text as HTML');

const purchaseSource = files['Dashboard_Script_PlanningPurchaseSim.html'];
const purchaseMarkupStart = files['Dashboard_Body.html'].indexOf('<div id="purchase"');
const purchaseMarkupEnd = files['Dashboard_Body.html'].indexOf('<div id="debtPayoff"', purchaseMarkupStart);
const purchaseMarkup = files['Dashboard_Body.html'].slice(purchaseMarkupStart, purchaseMarkupEnd);
const donationsMarkupStart = files['Dashboard_Body.html'].indexOf('<div id="donations"');
const donationsMarkupEnd = files['Dashboard_Body.html'].indexOf('<div id="billsDue"', donationsMarkupStart);
const donationsMarkup = files['Dashboard_Body.html'].slice(donationsMarkupStart, donationsMarkupEnd);
assert.match(purchaseMarkup, /id="ps_guidance"[\s\S]*?id="ps_results"[^>]*hidden/,
  'Purchase must begin with guidance and a hidden result wall');
assert.doesNotMatch(donationsMarkup, /id="ps_(?:guidance|results)"/,
  'Purchase guidance and results must never wrap Donations content');
assert.match(functionSource_(purchaseSource, 'loadPurchaseSimulatorSection'),
  /resetPurchaseSimulationResults_\(\)/,
  'Loading Purchase must clear stale results');
assert.match(functionSource_(purchaseSource, 'runPurchaseSimulationUi'),
  /resetPurchaseSimulationResults_\(\)[\s\S]*?withSuccessHandler[\s\S]*?showPurchaseSimulationResults_\(\)[\s\S]*?withFailureHandler[\s\S]*?resetPurchaseSimulationResults_\(\)/,
  'Purchase results must reveal only after success and hide again after failure');
const purchaseElements = {
  ps_guidance: { hidden: true },
  ps_results: { hidden: false }
};
const purchaseContext = vm.createContext({
  document: { getElementById: (id) => purchaseElements[id] || null }
});
vm.runInContext(
  functionSource_(purchaseSource, 'resetPurchaseSimulationResults_') + '\n' +
    functionSource_(purchaseSource, 'showPurchaseSimulationResults_'),
  purchaseContext
);
purchaseContext.resetPurchaseSimulationResults_();
assert.deepEqual([purchaseElements.ps_guidance.hidden, purchaseElements.ps_results.hidden], [false, true],
  'Purchase reset must show guidance and hide results');
purchaseContext.showPurchaseSimulationResults_();
assert.deepEqual([purchaseElements.ps_guidance.hidden, purchaseElements.ps_results.hidden], [true, false],
  'Purchase success must hide guidance and reveal results');

function trackedEditorSelect_() {
  return {
    disabled: true,
    dataset: {},
    options: [],
    set innerHTML(_value) { this.options = []; },
    appendChild(option) { this.options.push(option); }
  };
}
function verifyConfirmedEmptyRouting_(functionName, source, dataKey, modeSetterName) {
  const select = trackedEditorSelect_();
  const modeCalls = [];
  const context = vm.createContext({
    document: {
      getElementById: () => select,
      createElement: () => ({ value: '', textContent: '' })
    },
    populateBankAddDatalists_() {},
    populateInvestmentAddDatalists_() {},
    updateBankUpdateAvailability_() {},
    updateInvestmentUpdateAvailability_() {},
    renderBankManageList_() {},
    renderInvestmentManageList_() {},
    clearSurfaceState_() {},
    setBankPanelMode: (mode) => modeCalls.push(mode),
    setInvestmentPanelMode: (mode) => modeCalls.push(mode),
    Array
  });
  vm.runInContext(functionSource_(source, functionName), context);
  context[functionName]({ [dataKey]: [] });
  assert.deepEqual(modeCalls, ['add'], `${functionName} must route explicit empty data to Add`);
  modeCalls.length = 0;
  context[functionName]({ [dataKey]: ['Existing'] });
  assert.deepEqual(modeCalls, [], `${functionName} must preserve mode when records exist`);
  modeCalls.length = 0;
  context[functionName]({});
  assert.deepEqual(modeCalls, [], `${functionName} must not classify a malformed response as empty`);
}
verifyConfirmedEmptyRouting_('fillBankAccountDropdownFromData_', assetsEditors, 'accounts', 'setBankPanelMode');
verifyConfirmedEmptyRouting_('fillInvestmentAccountDropdownFromData_', assetsEditors, 'accounts', 'setInvestmentPanelMode');

const debtModeCalls = [];
const debtRequests = [];
const debtElements = {
  debt_typeFilter: trackedEditorSelect_(),
  debt_field: trackedEditorSelect_()
};
const debtEmptyContext = vm.createContext({
  document: { getElementById: (id) => debtElements[id] || trackedEditorSelect_(), createElement: () => ({}) },
  setSelectLoading() {},
  updateDebtUpdateAvailability_() {},
  runReadOnlyRpcWithRetry_: (request) => debtRequests.push(request),
  populateDebtAddDatalists_() {},
  populateDebtPropertyOptions_() {},
  filterDebtAccounts() {},
  clearSurfaceState_() {},
  setDebtPanelMode: (mode) => debtModeCalls.push(mode),
  focusDebtTarget_() {},
  setStatusLoading() {},
  setStatus() {},
  setSelectLoadFailure() {},
  renderSurfaceState_() {},
  customerSafeErrorMessage_: (_value, fallback) => fallback,
  startDashboardInitialLoadStage_: () => null,
  finishDashboardInitialLoadStage_: () => {},
  pendingFocus: null,
  Array,
  String
});
vm.runInContext('var debtSectionRequestId_ = 0; var debtUpdateDetailsReady_ = false; var allDebtRows = [];\n' +
  functionSource_(files['Dashboard_Script_PlanningDebts.html'], 'loadDebtSection'), debtEmptyContext);
for (const [payload, expected, label] of [
  [{ debts: [], types: ['All'], editableFields: [] }, ['add'], 'explicit empty'],
  [{ debts: [{ accountName: 'Existing' }], types: ['All'], editableFields: [] }, [], 'populated'],
  [{ types: ['All'], editableFields: [] }, [], 'malformed']
]) {
  debtModeCalls.length = 0;
  debtEmptyContext.loadDebtSection();
  debtRequests.at(-1).onSuccess(payload);
  assert.deepEqual(debtModeCalls, expected, `Debt ${label} response must apply the correct editor mode`);
}

for (const [label, source, loader] of [
  ['Bank focus', assetsEditors, 'loadBankSectionThenSelect_'],
  ['Investment focus', assetsEditors, 'loadInvestmentSectionThenSelect_'],
  ['Debt focus', files['Dashboard_Script_PlanningDebts.html'], 'loadDebtSectionThenSelect_']
]) {
  assert.match(functionSource_(source, loader),
    /renderSurfaceState_\([\s\S]*?actionLabel:\s*'Try again'/,
    `${label} read failure must preserve a manual Retry path`);
}

const debtFocusRequests = [];
const debtFocusEvents = [];
let debtFocusRetry = null;
const debtFocusElements = {
  debt_typeFilter: trackedEditorSelect_(),
  debt_field: trackedEditorSelect_(),
  debt_account: trackedEditorSelect_()
};
const debtFocusContext = vm.createContext({
  document: {
    getElementById: (id) => debtFocusElements[id] || trackedEditorSelect_(),
    createElement: () => ({})
  },
  setSelectLoading() {},
  updateDebtUpdateAvailability_() {},
  runReadOnlyRpcWithRetry_: (request) => debtFocusRequests.push(request),
  populateDebtAddDatalists_() {},
  populateDebtPropertyOptions_() {},
  filterDebtAccounts() {},
  clearSurfaceState_: (...args) => debtFocusEvents.push(['clear', ...args]),
  loadDebtFieldValue() {},
  setStatusLoading() {},
  setStatus() {},
  setSelectLoadFailure() {},
  renderSurfaceState_: (_id, config) => { debtFocusRetry = config.onAction; },
  customerSafeErrorMessage_: (_value, fallback) => fallback,
  Array,
  String
});
vm.runInContext('var debtSectionRequestId_ = 0; var debtUpdateDetailsReady_ = false; var allDebtRows = [];\n' +
  functionSource_(files['Dashboard_Script_PlanningDebts.html'], 'loadDebtSectionThenSelect_'), debtFocusContext);
debtFocusContext.loadDebtSectionThenSelect_('Existing');
debtFocusRequests.at(-1).onFailure(new Error('temporary'));
assert.equal(typeof debtFocusRetry, 'function', 'Debt focus failure must expose a Retry action');
debtFocusRetry();
debtFocusRequests.at(-1).onSuccess({
  debts: [{ accountName: 'Existing' }],
  types: ['All'],
  editableFields: []
});
assert.deepEqual(debtFocusEvents, [['clear', 'debt_status', 'status']],
  'Debt focus failure -> Retry -> success must clear the stale unavailable surface');

for (const [name, source, loader, availability] of [
  ['House', files['Dashboard_Script_AssetsHouseValues.html'], 'loadHouseSection', 'updateHouseUpdateAvailability_'],
  ['Investment', bankSource, 'loadInvestmentSection', 'updateInvestmentUpdateAvailability_'],
  ['House expense', files['Dashboard_Script_PropertiesHouseExpenses.html'], 'loadHouseExpensesSection', 'updateHouseExpenseAvailability_']
]) {
  const loaderSource = functionSource_(source, loader);
  assert.match(loaderSource,
    new RegExp(`setSelectLoading\\([\\s\\S]*?${availability}\\(\\)`),
    `${name} action availability must be recomputed immediately after loading clears its picker`);
  assert.match(loaderSource,
    new RegExp(`setSelectLoadFailure\\([\\s\\S]*?${availability}\\(\\)`),
    `${name} action availability must remain disabled after picker failure`);
}

assert.match(render,
  /function loadingIndicatorHtml\(label, announce\)[\s\S]*?announce === false/,
  'Shared inline loaders must support one visual-only duplicate without a second live announcement');
assert.match(files['Dashboard_Script_CashFlowUpcoming.html'],
  /loadingIndicatorHtml\('Loading upcoming expenses…', index === 0\)/,
  'Overview Upcoming must emit only one accessible announcement per paired load');
assert.match(files['Dashboard_Script_PropertiesHouseExpenses.html'],
  /loadingIndicatorHtml\('Loading property expenses…', index === 0\)/,
  'Overview Property totals must emit only one accessible announcement per paired load');

// Remaining UX closeout (3e-3i, 3m). These assertions lock the exact
// customer-facing gaps found by the advocate review without absorbing the
// broader keyboard, focus, contrast, and target-size audit reserved for 3j.
assert.match(body, /openHelpToSection\('help-activity'\)[\s\S]*?openHelpToSection\('help-properties'\)[\s\S]*?openHelpToSection\('help-setup'\)/,
  'Activity, Properties, and Setup must expose concise contextual Help links');
assert.match(files['Dashboard_Help.html'], /Getting started[\s\S]*?Advanced planning/,
  'Help must present common getting-started work before advanced planning');
assert.match(body, /id="act_activeFilters"/,
  'Activity must expose its applied filters');
assert.match(body, /id="act_clearFilters"[\s\S]*?>Clear filters<\/button>/,
  'Activity must expose a reversible Clear filters action');
assert.match(files['Dashboard_Script_Activity.html'], /function clearActivityFilters\(\)[\s\S]*?preserveBlankDates:\s*true/,
  'Clearing Activity filters must preserve an intentional all-time date range');
assert.match(files['Dashboard_Script_Activity.html'], /data-label="Logged at"[\s\S]*?data-label="Action"/,
  'Activity rows must retain labels for the narrow card layout');
assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*?\.activity-table thead\s*\{\s*display:\s*none;\s*\}[\s\S]*?content:\s*attr\(data-label\)/,
  'Activity must become a labeled card list at narrow widths');
assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*?\.activity-date-row\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto minmax\(0, 1fr\);[\s\S]*?input\.activity-date-input,[\s\S]*?min-width:\s*0;/,
  'Activity date filters must release desktop minimum widths at narrow sizes');
assert.match(body, /id="onboarding_progress_count"[\s\S]*?id="onboarding_recommended_next"[\s\S]*?id="onboarding_recommended_action"/,
  'Setup must show required progress and one recommended next action');
assert.match(onboardingClient, /function onboardingApplyProgressRecommendation_\([\s\S]*?step\.status !== 'complete'[\s\S]*?onboardingShowView\(next\.key\)/,
  'Setup recommendation must choose the first incomplete required area without writing data');
assert.match(styles, /@media \(min-width:\s*761px\) and \(max-width:\s*1180px\)[\s\S]*?\.topbar\s*\{[\s\S]*?flex-direction:\s*row;[\s\S]*?\.onboarding-steps-grid\s*\{[\s\S]*?repeat\(2,/,
  'Medium widths must retain a compact horizontal header and two-column Setup grid');
assert.match(body, /value="CASH" selected>Bank account<\/option>[\s\S]*?value="CREDIT_CARD">Credit card<\/option>/,
  'Bill payment sources must show customer labels while preserving stored tokens');
assert.doesNotMatch(body, />CASH \(pay from bank\)<|>CREDIT_CARD \(pay on a card\)</,
  'Bill form must not expose stored payment-source tokens');
assert.match(body, /id="bills_add_autopay"[^>]*onchange="syncBillsFormReadiness_\(\)"/,
  'Bill AutoPay changes must immediately re-evaluate Save readiness');
assert.match(body, /id="bills_add_varies"[^>]*onchange="syncBillsFormReadiness_\(\)"/,
  'Bill Varies changes must immediately re-evaluate Save readiness');
assert.match(files['Dashboard_Script_BillsDue.html'], /const editingCategory = __billsFormMode\.mode === 'edit'[\s\S]*?categoryValue \|\| editingCategory/,
  'Bill Edit must retain its verified category while asynchronous suggestions load');
assert.match(files['Dashboard_Script_BillsDue.html'], /setBillsFormModeToEdit_\(\{[\s\S]*?sheetRow:[\s\S]*?payee:[\s\S]*?category: bill\.category/,
  'Bill Edit state must carry the existing category for first-open readiness');
for (const id of ['pay_save_btn', 'up_save_btn', 'don_save_btn', 'bills_form_save_btn', 'hx_add_btn']) {
  assert.match(body, new RegExp(`id=["']${id}["'][^>]*\\sdisabled`),
    `${id} must start disabled until minimum valid input exists`);
}
for (const [sourceName, functionName] of [
  ['Dashboard_Script_Payments.html', 'syncQuickAddReadiness_'],
  ['Dashboard_Script_CashFlowUpcoming.html', 'syncUpcomingFormReadiness_'],
  ['Dashboard_Script_Donations.html', 'syncDonationFormReadiness_'],
  ['Dashboard_Script_BillsDue.html', 'syncBillsFormReadiness_'],
  ['Dashboard_Script_PropertiesHouseExpenses.html', 'updateHouseExpenseAvailability_']
]) {
  assert.match(files[sourceName], new RegExp(`function ${functionName}\\(`),
    `${functionName} must remain the client-side primary-action readiness guard`);
}
assert.match(files['Dashboard_Script_Donations.html'], /Tax year /,
  'Donation history must spell out Tax year');
assert.doesNotMatch(body, />Mgmt<|>YTD by/,
  'Normal Properties copy must not expose residual abbreviations');
assert.match(files['Dashboard_Script_PlanningRetirement.html'], /Profile needs your date of birth\.[\s\S]*?CashCompass uses it to calculate your current age/,
  'Retirement missing-profile guidance must state the prerequisite once');
assert.match(files['Dashboard_Script_PlanningRetirement.html'], /Retirement assumptions are not set yet\.[\s\S]*?Enter household retirement spending/,
  'Retirement assumption guidance must use one concise next step');
assert.doesNotMatch(files['Dashboard_Script_PlanningRetirement.html'], /From profile DOB/,
  'Retirement customer copy must spell out date of birth');

console.log('Dashboard UX regression checks passed.');
