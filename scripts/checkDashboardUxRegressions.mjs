import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const files = Object.fromEntries(await Promise.all([
  'Dashboard_Body.html',
  'Dashboard_Help.html',
  'Dashboard_Script_AssetsBankInvestments.html',
  'Dashboard_Script_AssetsHouseValues.html',
  'Dashboard_Script_BillsDue.html',
  'Dashboard_Script_CashFlowUpcoming.html',
  'Dashboard_Script_Income.html',
  'Dashboard_Script_Onboarding.html',
  'Dashboard_Script_Payments.html',
  'Dashboard_Script_PlanningDebts.html',
  'Dashboard_Script_PlanningNextActions.html',
  'Dashboard_Script_PropertyPerformance.html',
  'Dashboard_Script_PropertiesHouseExpenses.html',
  'Dashboard_Script_Render.html',
  'Dashboard_Script_RollingDebtPayoff.html',
  'Dashboard_Styles.html',
  'BankAccountsUI.html',
  'DebtsUI.html',
  'HouseValuesUI.html',
  'InvestmentsUI.html',
  'PlannerDashboard.html',
  'QuickAddPaymentUI.html',
  'dashboard_data.js',
  'onboarding.js'
].map(async (name) => [name, await readFile(new URL(`../${name}`, import.meta.url), 'utf8')])));

const render = files['Dashboard_Script_Render.html'];
for (const [page, tab] of Object.entries({
  assets: 'houses',
  cashflow: 'payments',
  properties: 'houseExpenses',
  planning: 'nextActions'
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
for (const source of [render, files['PlannerDashboard.html']]) {
  assert.match(source, /if \(num < 0\) return '-' \+ fmtCurrency\(Math\.abs\(num\)\);/,
    'Signed currency must place the minus sign before the dollar sign');
}
assert.match(render, /Change vs ['"] \+ label \+ ': ' \+ fmtSignedCurrency\(num\)/,
  'Overview month deltas must use the signed-currency formatter');

const body = files['Dashboard_Body.html'];
const styles = files['Dashboard_Styles.html'];
const overview = body.slice(
  body.indexOf('<div id="page_overview"'),
  body.indexOf('<div id="page_assets"')
);
const overviewSections = [
  'At a glance',
  'What needs your attention',
  'Financial outlook',
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
  /showPage\('planning'\);\s*showTab\('debts'\)/,
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
  /@media \(max-width:\s*460px\)[\s\S]*?\.snapshot-card-supporting\s*\{\s*grid-column:\s*span 12;/,
  'Supporting KPIs must stack at the narrowest width');
assert.match(styles,
  /@media \(max-width:\s*1180px\)[\s\S]*?\.tabs\.assets-tabs\s*\{\s*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/,
  'The three Assets tabs must not form an orphan row at medium widths');
assert.match(styles,
  /@media \(max-width:\s*460px\)[\s\S]*?\.tabs\.assets-tabs\s*\{\s*grid-template-columns:\s*1fr;/,
  'Assets tabs must stack deliberately at the narrowest width');
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

for (const [pageId, title] of Object.entries({
  page_assets: 'Assets',
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
assert.doesNotMatch(body, /cashflow-tools-label|cashflow-feature-description/,
  'Cash Flow must not reintroduce a second navigation label or banner description');
assert.doesNotMatch(body + '\n' + styles, /cashflow-primary-tab/,
  'Quick add must not use a competing featured-tab treatment');
assert.match(files['Dashboard_Script_Payments.html'],
  /function setQuickAddSuccessStatus_\([\s\S]*?classList\.add\(['"]status-success['"]\)/,
  'Quick Add completion must use an explicit success treatment');
assert.match(styles, /\.status\.status-success:not\(:empty\)\s*\{[\s\S]*?background:\s*#f0fdf4/,
  'Successful Quick Add feedback must use the shared success surface');
assert.match(body, /id="bills_view_tab_due"[\s\S]*?>Due this period<\/button>[\s\S]*?id="bills_view_tab_manage"[\s\S]*?>Manage bills<\/button>/,
  'Bills must lead with current due work before recurring-bill management');
assert.match(files['Dashboard_Script_BillsDue.html'],
  /renderActiveBillsList_\([\s\S]*?updateBillsAddActionVisibility_\(__billsManageRows\.length > 0\)/,
  'Bills must show the header Add action only when active bills exist');
assert.match(body, /id="bills_add_toggle_btn"[^>]*hidden/,
  'The Bills header Add action must stay hidden until active rows are confirmed');
assert.match(files['Dashboard_Script_BillsDue.html'],
  /No active bills yet\.[\s\S]*?openBillsAddFormFromEmptyState\(\)/,
  'An empty Bills list must retain one centered Add action');
assert.match(body, /Due day of month \(1–31\)/,
  'Bills must describe due day in plain language');
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
for (const id of ['house', 'bank_update', 'inv_update', 'debt_update']) {
  assert.match(
    body,
    new RegExp(`id=["']${id}_stop_btn["'][^>]*class=["'][^"']*danger[^>]*disabled[^>]*hidden`),
    `${id} Stop tracking must start hidden and unavailable until an item is selected`
  );
}
assert.match(files['Dashboard_Script_Income.html'], /class="small-btn danger"[\s\S]*?Stop tracking/,
  'Income Stop tracking must remain visually destructive');
assert.match(body, /id="debt_update_stop_zone"[^>]*hidden/,
  'The Debt danger zone must start hidden until a debt is selected');
assert.match(files['Dashboard_Script_PlanningDebts.html'],
  /getElementById\(['"]debt_update_stop_zone['"]\)[\s\S]*?stopZone\.hidden\s*=\s*!hasSelection/,
  'The Debt availability guard must reveal the whole danger zone only for a valid selection');
for (const [sourceName, functionName, stopId] of [
  ['Dashboard_Script_AssetsHouseValues.html', 'updateHouseUpdateAvailability_', 'house_stop_btn'],
  ['Dashboard_Script_AssetsBankInvestments.html', 'updateBankUpdateAvailability_', 'bank_update_stop_btn'],
  ['Dashboard_Script_AssetsBankInvestments.html', 'updateInvestmentUpdateAvailability_', 'inv_update_stop_btn'],
  ['Dashboard_Script_PlanningDebts.html', 'updateDebtUpdateAvailability_', 'debt_update_stop_btn']
]) {
  const source = files[sourceName];
  const start = source.indexOf(`function ${functionName}(`);
  const end = source.indexOf('\n}', start);
  const availabilityFunction = source.slice(start, end + 2);
  assert.ok(start >= 0, `${functionName} must exist`);
  assert.match(availabilityFunction, new RegExp(`getElementById\\(['"]${stopId}['"]\\)`),
    `${functionName} must control ${stopId}`);
  assert.match(availabilityFunction, /stopBtn\.hidden\s*=\s*!hasSelection/,
    `${functionName} must reveal Stop tracking only for a valid selection`);
}
for (const id of [
  'bank_update_save_btn',
  'bank_update_stop_btn',
  'inv_update_save_btn',
  'inv_update_stop_btn',
  'debt_update_save_btn',
  'debt_update_stop_btn',
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

console.log('Dashboard UX regression checks passed.');
