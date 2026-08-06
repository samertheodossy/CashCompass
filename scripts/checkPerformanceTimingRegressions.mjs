import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../performance_timing.js', import.meta.url), 'utf8');
const plannerSource = await readFile(new URL('../code.js', import.meta.url), 'utf8');
const dashboardSource = await readFile(new URL('../dashboard_data.js', import.meta.url), 'utf8');
const dashboardClient = await readFile(new URL('../Dashboard_Script_Render.html', import.meta.url), 'utf8');
const dashboardHost = await readFile(new URL('../PlannerDashboardWeb.html', import.meta.url), 'utf8');
const webappSource = await readFile(new URL('../webapp.js', import.meta.url), 'utf8');
const initialLoadClientSources = await Promise.all([
  'Dashboard_Script_AssetsHouseValues.html',
  'Dashboard_Script_PropertiesHouseExpenses.html',
  'Dashboard_Script_AssetsBankInvestments.html',
  'Dashboard_Script_PlanningDebts.html',
  'Dashboard_Script_Payments.html',
  'Dashboard_Script_CashFlowUpcoming.html',
  'Dashboard_Script_PlanningRetirement.html',
  'Dashboard_Script_PlanningPurchaseSim.html',
  'Dashboard_Script_BillsDue.html',
  'Dashboard_Script_Income.html'
].map(file => readFile(new URL('../' + file, import.meta.url), 'utf8')));
const performanceSamplingSource = await readFile(new URL('../performance_sampling.js', import.meta.url), 'utf8');
const performanceScenarioSource = await readFile(new URL('../test_harness_scenarios_performance.js', import.meta.url), 'utf8');
const bankAccountsSource = await readFile(new URL('../bank_accounts.js', import.meta.url), 'utf8');
const investmentsSource = await readFile(new URL('../investments.js', import.meta.url), 'utf8');
const houseValuesSource = await readFile(new URL('../house_values.js', import.meta.url), 'utf8');
const upcomingExpensesSource = await readFile(new URL('../upcoming_expenses.js', import.meta.url), 'utf8');
const retirementSource = await readFile(new URL('../retirement.js', import.meta.url), 'utf8');
const retirementClientSource = await readFile(new URL('../Dashboard_Script_PlanningRetirement.html', import.meta.url), 'utf8');
const populatedBrowserSource = await readFile(new URL('../Dashboard_Script_PopulatedDashboardE2E.html', import.meta.url), 'utf8');
const onboardingSource = await readFile(new URL('../onboarding.js', import.meta.url), 'utf8');
const incomeSourcesSource = await readFile(new URL('../income_sources.js', import.meta.url), 'utf8');
const quickAddSource = await readFile(new URL('../quick_add_payment.js', import.meta.url), 'utf8');
const configSource = await readFile(new URL('../config.js', import.meta.url), 'utf8');

assert.match(bankAccountsSource,
  /function updateBankAccountValueByDate\(payload\)[\s\S]*?startPerformanceTrace_\('bank\.ordinary_save'\)[\s\S]*?markPerformanceTrace_\(performanceTrace, 'resolve_workbook'\)[\s\S]*?markPerformanceTrace_\(performanceTrace, 'append_activity'\)[\s\S]*?finishPerformanceTrace_\(performanceTrace\)/,
  'Ordinary Bank Save must retain flag-gated privacy-safe server stage timing');
assert.match(bankAccountsSource,
  /catch \(err\) \{[\s\S]*?finishPerformanceTrace_\(performanceTrace,[\s\S]*?outcome: 'error'[\s\S]*?failedStage: failedStage[\s\S]*?throw err/,
  'Ordinary Bank Save timing must finish with an allow-listed failed stage and rethrow errors');
assert.match(bankAccountsSource,
  /previousSheet && previousBlock && previousRow !== -1 && previousCol !== -1[\s\S]*?setCurrencyCellPreserveRowFormat_\([\s\S]*?previousBlock\.firstMonthCol[\s\S]*?updateBankAccountsHistory_\(accountName, year, balanceDate, currentValue, ss\)/,
  'Ordinary Bank Save must reuse its prior Bank location with the authoritative lookup as fallback');
assert.match(bankAccountsSource,
  /bankDisplay = previousSheet\.getDataRange\(\)\.getDisplayValues\(\)[\s\S]*?getBankAccountsYearBlock_\(previousSheet, year, bankDisplay\)[\s\S]*?findBankAccountRowInBlock_\([\s\S]*?bankDisplay[\s\S]*?syncAllAccountsFromLatestCurrentYear_\(ss, bankDisplay\)/,
  'Ordinary Bank Save must reuse one Bank display snapshot across lookup and synchronization');
assert.match(bankAccountsSource,
  /const accountsContext = syncAllAccountsFromLatestCurrentYear_\(ss, bankDisplay\)[\s\S]*?updateAccountsSheetFields_\(accountName,[\s\S]*?}, ss, accountsContext\)/,
  'Ordinary Bank Save must reuse its resolved workbook and SYS Accounts read context');
assert.match(bankAccountsSource,
  /function updateBankAccountsHistory_\(accountName, year, balanceDate, currentValue, optionalSs\)[\s\S]*?optionalSs \|\| getUserSpreadsheet_\(\)/,
  'Bank history writes must preserve the no-argument resolver while accepting the same-call workbook');
assert.match(bankAccountsSource,
  /function syncAllAccountsFromLatestCurrentYear_\(optionalSs, optionalBankDisplay\)[\s\S]*?getLatestBankAccountValuesForYear_\([\s\S]*?optionalBankDisplay[\s\S]*?return \{[\s\S]*?sheet: targetSheet,[\s\S]*?display: targetDisplay,[\s\S]*?headerMap: targetHeaderMap/,
  'Bank synchronization must accept an optional same-call display and return reusable SYS Accounts context');
assert.match(bankAccountsSource,
  /function getLatestBankAccountValuesForYear_\(sheet, year, optionalDisplay\)[\s\S]*?optionalDisplay && optionalDisplay\.length[\s\S]*?: sheet\.getDataRange\(\)\.getDisplayValues\(\)/,
  'Latest Bank values must preserve the standalone display read while accepting a same-call snapshot');
assert.match(bankAccountsSource,
  /function updateAccountsSheetFields_\(accountName, options, optionalSs, optionalAccountsContext\)[\s\S]*?context && context\.sheet[\s\S]*?: ensureSysAccountsSheet_\(optionalSs\)[\s\S]*?context && context\.display[\s\S]*?: sheet\.getDataRange\(\)\.getDisplayValues\(\)/,
  'Optional Bank side-field writes must preserve the standalone resolver/read while accepting same-call context');

assert.match(performanceSamplingSource, /failedAssertions:\s*failedAssertions/,
  'Performance samples must retain privacy-safe failed assertion labels');
assert.match(performanceSamplingSource, /provisioning:\s*report\.gate\.provisioning/,
  'Performance samples must retain compact gate diagnostics');
assert.match(performanceSamplingSource, /firstStages:\s*psCompactStages_\(timing\.firstStages\)/,
  'Performance samples must retain privacy-safe first-run stage timing');
assert.match(performanceSamplingSource, /repeatStages:\s*psCompactStages_\(timing\.repeatStages\)/,
  'Performance samples must retain privacy-safe repeat-run stage timing');
assert.match(performanceSamplingSource, /snapshotStages:\s*psCompactStages_\(timing\.snapshotStages\)/,
  'Performance samples must retain privacy-safe snapshot stage timing');
assert.match(performanceScenarioSource, /createPerformanceTrace_\('planner\.harness_' \+ label\)/,
  'The guarded disposable scenario must capture stages without a project-wide flag');
assert.match(performanceScenarioSource, /performanceTrace:\s*trace/,
  'The disposable stage trace must be threaded through the exact planner call');
assert.match(performanceScenarioSource,
  /buildDashboardSnapshot_\(\s*ctx\.ss, snapshotTrace, repeatRun\.snapshotContext\.canonicalSnapshot\)/,
  'Snapshot profiling must stay on the exact marker-verified disposable workbook');
assert.match(performanceScenarioSource, /snapshotContext:\s*snapshotContext/,
  'Disposable planner timing must retain the same-call canonical snapshot handoff');
assert.ok(performanceScenarioSource.includes('Dashboard snapshot returned current totals'),
  'Disposable runtime must retain a snapshot behavior assertion');
assert.ok(performanceScenarioSource.includes('Dashboard snapshot returned selected retirement scenario'),
  'Disposable runtime must retain the Overview retirement payload assertion');
for (const formattingAssertion of [
  'Dashboard title remains merged',
  'Dashboard section style retained',
  'Dashboard table-header style retained',
  'Dashboard currency format retained',
  'Dashboard stability style retained',
  'Dashboard column widths retained'
]) {
  assert.ok(performanceScenarioSource.includes(formattingAssertion),
    `Disposable runtime must retain formatting assertion: ${formattingAssertion}`);
}
assert.match(configSource, /SpreadsheetApp\.openById\(exactId\)/,
  'Sheet retries must reopen the exact caller-supplied spreadsheet');
assert.doesNotMatch(configSource, /freshSs\s*=\s*[\s\S]{0,200}getUserSpreadsheet_\(/,
  'Sheet retries must never escape to the mapped user workbook');

assert.match(dashboardSource,
  /function buildDashboardSnapshot_\(optionalSs, performanceTrace, optionalCanonicalSnapshot, optionalCurrentPosition\)/,
  'Dashboard snapshot must accept an explicit disposable target and a local trace');
assert.match(plannerSource,
  /options\.snapshotContext\.canonicalSnapshot\s*=\s*canonicalHistorySnapshot/,
  'Planner must expose its fresh canonical position only through a same-call context');
assert.match(dashboardSource,
  /buildDashboardSnapshot_\(\s*null, performanceTrace, snapshotContext\.canonicalSnapshot\)/,
  'Refresh wrappers must reuse the canonical position already read by Planner');
assert.match(dashboardSource,
  /legacyHouseLoans\s*=\s*canonicalSources\.properties[\s\S]*?\?\s*0\s*:\s*sumColumnByHeaderForOptionalSheet_/,
  'Canonical-ready snapshots must not eagerly re-read legacy property-loan fallback');
assert.match(dashboardSource,
  /if \(!\(canonicalSources\.debts && canonicalSources\.debts\.available\)\)[\s\S]*?sumDebtBalances_/,
  'Canonical-ready snapshots must not eagerly re-read legacy debt fallback');
assert.match(dashboardSource, /const historyGrid = readDashboardHistoryGrid_\(ss\)/,
  'Dashboard snapshot must read History once for all downstream consumers');
for (const stage of [
  'snapshot_current_position',
  'snapshot_history',
  'snapshot_prior_month',
  'snapshot_latest_metrics',
  'snapshot_upcoming',
  'snapshot_retirement',
  'snapshot_readiness_bank',
  'snapshot_readiness_debts',
  'snapshot_readiness_bills',
  'snapshot_readiness_income',
  'snapshot_readiness_profile',
  'snapshot_health_actions',
  'snapshot_income_and_freshness'
]) {
  assert.ok((dashboardSource + onboardingSource).includes(`'${stage}'`),
    `Snapshot trace must retain stage ${stage}`);
}
assert.match(dashboardSource,
  /getOnboardingRequiredReadiness_\(ss,\s*['"]normal['"],\s*performanceTrace\)/,
  'Dashboard snapshot must thread its trace into setup readiness');
assert.match(quickAddSource,
  /function getCashFlowHeaderMap_\(sheet\)[\s\S]*?getCashFlowHeaderMapFromHeaders_\(headers\)/,
  'Cash Flow readers must support building a header map from an already-read grid');
assert.match(onboardingSource,
  /function probeIncomeStatus_\(ss, mode\)[\s\S]*?getDataRange\(\)\.getDisplayValues\(\)[\s\S]*?classifyIncomeGroupsInSheet_\(cashFlowSheet, display, headerMap\)/,
  'Income readiness must reuse one Cash Flow grid read for validation and classification');
assert.match(incomeSourcesSource,
  /function analyzeIncomeGroupsInSheet_\(sheet, optionalDisplay, optionalHeaderMap\)/,
  'Income classification must accept an already-read Cash Flow grid');
for (const [readSource, functionName] of [
  [bankAccountsSource, 'getPriorMonthCashTotalFromBankInput_'],
  [investmentsSource, 'getPriorMonthInvestmentsTotalFromInput_'],
  [houseValuesSource, 'getPriorMonthHouseValuesTotalFromHouseValuesInput_']
]) {
  const start = readSource.indexOf(`function ${functionName}(optionalSs)`);
  const end = readSource.indexOf('\nfunction ', start + 1);
  assert.ok(start >= 0, `${functionName} must preserve an optional explicit spreadsheet seam`);
  const body = readSource.slice(start, end === -1 ? readSource.length : end);
  assert.ok(body.includes('readRange.getValues()') && body.includes('readRange.getDisplayValues()'),
    `${functionName} must batch its prior-month row reads`);
  assert.ok(!/sheet\.getRange\(row,/.test(body),
    `${functionName} must not restore per-row spreadsheet calls`);
}
assert.match(upcomingExpensesSource, /function getUpcomingExpenseMetrics_\(optionalSs\)[\s\S]*getUpcomingExpensesUiData\(optionalSs\)/,
  'Snapshot Upcoming reads must stay on the explicit disposable workbook');
assert.match(retirementSource, /function getRetirementSummarySafe_\(optionalSs\)[\s\S]*getRetirementSummary_\(optionalSs\)/,
  'Snapshot Retirement reads must stay on the explicit disposable workbook');
assert.match(dashboardSource, /const retirement = getRetirementOverviewSummarySafe_\(ss\)/,
  'Overview snapshots must use the selected-scenario retirement reader');
assert.match(dashboardSource,
  /function getDashboardOverviewCoreSnapshot\(\)[\s\S]*?buildDashboardOverviewCoreSnapshot_\(ss, null, current\)/,
  'Initial Overview must expose a canonical core-only endpoint');
assert.match(dashboardSource,
  /function buildDashboardOverviewCoreSnapshot_\([\s\S]*?buildDashboardCurrentPosition_\([\s\S]*?phase:\s*['"]core['"]/,
  'Core Overview must reuse the canonical current-position builder');
const fullSnapshotEntry = functionSource_(dashboardSource, 'getDashboardSnapshot');
assert.ok(!fullSnapshotEntry.includes('ensureDebouncePlannerTrigger_'),
  'Full Overview reads must not perform trigger maintenance before rendering');
const fullSnapshotBuilder = functionSource_(dashboardSource, 'buildDashboardSnapshot_');
assert.ok(!fullSnapshotBuilder.includes('ensureActivityLogSheet_'),
  'Full Overview reads must not create or repair Activity before rendering');
const postRenderMaintenance = functionSource_(dashboardSource, 'runDashboardPostRenderMaintenance');
assert.ok(postRenderMaintenance.includes('ensureActivityLogSheet_') &&
  postRenderMaintenance.includes('ensureDebouncePlannerTrigger_'),
  'Existing Activity and debounce maintenance must remain available after render');
const overviewCoreEntry = functionSource_(dashboardSource, 'getDashboardOverviewCoreSnapshot');
assert.ok(overviewCoreEntry.includes('cacheDashboardOverviewCurrentPosition_(ss, current)'),
  'Core Overview must issue a server-side continuation for its verified aggregates');
const overviewDetailsEntry = functionSource_(dashboardSource, 'getDashboardOverviewDetails');
assert.ok(overviewDetailsEntry.includes('takeDashboardOverviewCurrentPosition_(ss, continuationId)') &&
  overviewDetailsEntry.includes('buildDashboardSnapshot_(ss, null, null, current)'),
  'Background Overview must reuse the verified continuation when available');
const continuationWriter = functionSource_(dashboardSource, 'cacheDashboardOverviewCurrentPosition_');
assert.ok(continuationWriter.includes('CacheService.getUserCache().put') &&
  continuationWriter.includes('DASHBOARD_OVERVIEW_CONTINUATION_TTL_SECONDS_'),
  'Overview continuations must be short-lived and isolated to the calling user');
assert.ok(!continuationWriter.includes('canonicalSnapshot') &&
  !continuationWriter.includes('rows:'),
  'Overview continuations must never cache canonical account-level rows');
{
  const cacheFailureContext = {
    CacheService: { getUserCache: () => { throw new Error('storage unavailable'); } },
    Utilities: { getUuid: () => '11111111-1111-4111-8111-111111111111' },
    JSON,
    String,
    round2_: value => Number(value) || 0,
    DASHBOARD_OVERVIEW_CONTINUATION_CACHE_PREFIX_: 'CORE_',
    DASHBOARD_OVERVIEW_CONTINUATION_TTL_SECONDS_: 120,
    DASHBOARD_OVERVIEW_DETAILS_CACHE_PREFIX_: 'DETAILS_',
    DASHBOARD_OVERVIEW_DETAILS_TTL_SECONDS_: 900
  };
  vm.createContext(cacheFailureContext);
  vm.runInContext([
    functionSource_(dashboardSource, 'dashboardOverviewDetailsCacheKey_'),
    functionSource_(dashboardSource, 'cacheDashboardOverviewDetails_'),
    functionSource_(dashboardSource, 'getCachedDashboardOverviewDetails_'),
    continuationWriter
  ].join('\n'), cacheFailureContext);
  const cacheFailureWorkbook = { getId: () => 'bounded-workbook' };
  const cacheFailureCurrent = {
    cash: 1,
    investments: 2,
    houseValues: 3,
    houseLoans: 4,
    houseEquity: -1,
    totalDebt: 5,
    netWorth: 0,
    snapshotState: 'ready',
    canonicalDashboard: {}
  };
  assert.equal(cacheFailureContext.cacheDashboardOverviewDetails_(
    cacheFailureWorkbook, { cash: 1 }), false,
  'A details-cache outage must not fail the authoritative Overview read');
  assert.equal(cacheFailureContext.getCachedDashboardOverviewDetails_(
    cacheFailureWorkbook), null,
  'A details-cache outage must fall back to no cached presentation payload');
  assert.equal(cacheFailureContext.cacheDashboardOverviewCurrentPosition_(
    cacheFailureWorkbook, cacheFailureCurrent), '',
  'A continuation-cache outage must fall back to a fresh background calculation');
}
const continuationReader = functionSource_(dashboardSource, 'takeDashboardOverviewCurrentPosition_');
assert.ok(continuationReader.includes('cache.remove(key)') &&
  continuationReader.includes('payload.workbookId !== ss.getId()'),
  'Overview continuations must be single-use and bound to the resolved workbook');
assert.ok(continuationReader.includes("typeof value !== 'number' || !isFinite(value)") &&
  continuationReader.includes("['ready', 'partial', 'notSetUp'].indexOf"),
  'Malformed continuation totals or readiness state must fail closed to a fresh calculation');
const retirementOverviewStart = retirementSource.indexOf('function getRetirementOverviewSummarySafe_');
const retirementOverviewEnd = retirementSource.indexOf('function getRetirementModelData_', retirementOverviewStart);
const retirementOverviewSource = retirementSource.slice(retirementOverviewStart, retirementOverviewEnd);
assert.ok(retirementOverviewSource.includes('RETIREMENT_SCENARIOS_.forEach'),
  'Overview retirement payload must preserve all three scenario inputs');
assert.equal((retirementOverviewSource.match(/calculateRetirementPlan_\(/g) || []).length, 1,
  'Overview must calculate only the selected retirement scenario');
assert.ok(retirementOverviewSource.includes('analyses[selectedScenario] = analysis'),
  'Overview must expose the selected analysis through the existing response shape');
const retirementModelStart = retirementSource.indexOf('function getRetirementModelData_');
const retirementModelEnd = retirementSource.indexOf('function buildRetirementModelRowMap_', retirementModelStart);
const retirementModelSource = retirementSource.slice(retirementModelStart, retirementModelEnd);
assert.ok(retirementModelSource.includes('sheet.getDataRange().getValues()'),
  'Retirement model must read the scenario grid once');
assert.ok(retirementModelSource.includes('getRetirementScenarioInputsFromGrid_'),
  'Retirement scenarios must be derived from the shared in-memory grid');
assert.ok(retirementModelSource.includes('currentInvestableAssets = getCurrentInvestableAssetsForRetirement_(optionalSs)'),
  'Retirement model must read current investable assets once per model');
assert.ok(retirementModelSource.includes('calculateRetirementPlan_(household, inputs, name, currentInvestableAssets)'),
  'Every scenario calculation must reuse the same current-assets value');
assert.ok(retirementModelSource.includes('RETIREMENT_SCENARIOS_.forEach'),
  'Planning Retirement must continue calculating every scenario on demand');
const retirementSelectedReader = functionSource_(retirementSource, 'getRetirementSelectedUiDataSafe');
assert.ok(retirementSelectedReader.includes('selectedOnly: true') &&
  retirementSelectedReader.includes('writeSelectedOutput: false'),
  'Current Retirement first paint must calculate only the selected scenario and remain read only');
const retirementComparisonReader = functionSource_(retirementSource, 'getRetirementComparisonAnalysesSafe');
assert.ok(retirementComparisonReader.includes("name !== selectedScenario") &&
  retirementComparisonReader.includes("state: 'stale'") &&
  retirementComparisonReader.includes('readRetirementScenariosFromGridSafe_'),
  'Retirement comparisons must exclude the selected calculation, batch-read inputs, and reject stale selection races');
assert.match(retirementClientSource,
  /retirementLoadGeneration_[\s\S]*?getRetirementSelectedUiDataSafe\(\)[\s\S]*?loadRetirementAlternativeAnalyses_[\s\S]*?getRetirementComparisonAnalysesSafe\(expectedSelectedScenario\)/,
  'Retirement client must paint the selected result first, then load stale-response-safe comparisons');
assert.match(retirementClientSource,
  /retirementOverviewUiData[\s\S]*?cached\.analysis[\s\S]*?renderRetirementPanelInfo\(cached\.analysis\)[\s\S]*?source: 'overview_cache'[\s\S]*?loadRetirementAlternativeAnalyses_/,
  'Common Retirement navigation must paint the authoritative Overview-selected payload before requesting comparisons');
assert.match(populatedBrowserSource,
  /performance_retirement_scenario_load[\s\S]*?selectedMeaningfulMs[\s\S]*?allComparisonsMs/,
  'Populated runtime evidence must capture selected meaningful content separately from all comparisons');

function functionSource_(text, name) {
  const start = text.indexOf(`function ${name}`);
  const end = text.indexOf('\nfunction ', start + 1);
  assert.ok(start >= 0, `Missing function ${name}`);
  return text.slice(start, end === -1 ? text.length : end);
}
const retirementGridContext = {
  String,
  toNumber_: value => Number(value) || 0
};
vm.createContext(retirementGridContext);
vm.runInContext([
  functionSource_(retirementSource, 'normalizeRetirementScenario_'),
  functionSource_(retirementSource, 'getRetirementScenarioColumn_'),
  functionSource_(retirementSource, 'buildRetirementModelRowMap_'),
  functionSource_(retirementSource, 'getRetirementScenarioInputsFromGrid_')
].join('\n'), retirementGridContext);
const retirementGrid = [
  ['Setting', 'Value', '', ''],
  ['Selected Scenario', 'Base', '', ''],
  ['Scenario Input', 'Conservative', 'Base', 'Aggressive'],
  ['Target Retirement Age', 65, 67, 69],
  ['Household Retirement Spending / Year', 60000, 70000, 80000],
  ['Your Social Security / Year', 10000, 11000, 12000],
  ['Spouse Social Security / Year', 9000, 10000, 11000],
  ['Other Retirement Income / Year', 1000, 2000, 3000],
  ['Annual Contributions', 12000, 15000, 18000],
  ['Expected Annual Return %', 4, 6, 8],
  ['Inflation %', 2.5, 2.5, 2.25],
  ['Safe Withdrawal Rate %', 4, 4, 4.25],
  ['One-Time Future Cash Needs', 0, 50000, 100000]
];
const retirementRows = retirementGridContext.buildRetirementModelRowMap_(retirementGrid);
const baseInputs = retirementGridContext.getRetirementScenarioInputsFromGrid_(retirementGrid, retirementRows, 'Base');
assert.equal(baseInputs.targetRetirementAge, 67);
assert.equal(baseInputs.householdRetirementSpendingPerYear, 70000);
assert.equal(baseInputs.annualContributions, 15000);
assert.equal(baseInputs.safeWithdrawalRatePct, 4);
assert.equal(baseInputs.oneTimeFutureCashNeeds, 50000);

function buildContext({ flag = 'false', propertyThrows = false, ticks = [] } = {}) {
  const logs = [];
  const RealDate = Date;
  function FakeDate(value) {
    return new RealDate(value);
  }
  FakeDate.now = () => {
    assert.ok(ticks.length, 'Test clock exhausted');
    return ticks.shift();
  };

  const context = {
    Date: FakeDate,
    JSON,
    Math,
    Object,
    String,
    Number,
    PropertiesService: {
      getScriptProperties() {
        if (propertyThrows) throw new Error('unavailable');
        return { getProperty: () => flag };
      }
    },
    console: { log: (line) => logs.push(line) },
    Logger: { log: (line) => logs.push(line) }
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return { context, logs };
}

const dashboardAllowedLoadStages = [
  'startup_routing', 'snapshot', 'overview_details', 'overview_bills',
  'overview_upcoming', 'overview_house_expenses',
  'houses', 'house_expenses', 'house_expense_recent',
  'house_expense_summary', 'bank_accounts', 'investments', 'debts',
  'quick_add', 'upcoming', 'retirement', 'purchase_simulator', 'bills_due',
  'recurring_bills', 'manage_bills', 'income_sources'
];
const dashboardInitialVisibleStages = [
  'startup_routing', 'snapshot', 'overview_details', 'overview_bills',
  'overview_upcoming', 'overview_house_expenses'
];

assert.match(webappSource,
  /dashboardPerformanceDebug[\s\S]*?e\.parameter\.debug[\s\S]*?dashboardPerformanceDebugJson\s*=\s*JSON\.stringify\(dashboardPerformanceDebug\)/,
  'The debug query flag must be server-rendered into the normal dashboard');
assert.match(dashboardHost,
  /__cashCompassPerformanceDebug\s*=\s*<\?!= dashboardPerformanceDebugJson \?>/,
  'The server-rendered debug flag must exist before dashboard bundles execute');
assert.match(dashboardHost,
  /function initDashboard\(\)[\s\S]*?beginDashboardInitialLoadPerformance_\(\);[\s\S]*?refreshSnapshot\(\{\s*progressive:\s*true\s*\}\);/,
  'Initial-load timing must begin before the first dashboard RPC');
assert.match(dashboardHost,
  /beginDashboardInitialLoadPerformance_\(\);\s*runStartupRouting_\(\);/,
  'Initial-load timing must include the startup-routing RPC');
for (const stage of dashboardInitialVisibleStages) {
  assert.ok(dashboardClient.includes(`'${stage}'`),
    `Client initial-load allow-list must retain visible stage ${stage}`);
}
for (const stage of dashboardAllowedLoadStages) {
  assert.ok(source.includes(`'${stage}'`),
    `Server timing allow-list must retain stage ${stage}`);
}
const initialLoadClientText = initialLoadClientSources.join('\n');
for (const stage of dashboardAllowedLoadStages.filter(stage =>
  dashboardInitialVisibleStages.indexOf(stage) < 0)) {
  assert.ok(initialLoadClientText.includes(`startDashboardInitialLoadStage_('${stage}')`),
    `Deferred loader instrumentation must retain stage ${stage}`);
}
const initDashboardSource = functionSource_(dashboardHost, 'initDashboard');
assert.match(initDashboardSource, /refreshSnapshot\(\{\s*progressive:\s*true\s*\}\)/,
  'Overview startup must hydrate the canonical core before background details');
for (const hiddenLoader of [
  'loadHouseSection', 'loadHouseExpensesSection', 'loadBankSection',
  'loadInvestmentSection', 'loadDebtSection', 'loadPaymentSection',
  'loadUpcomingSection', 'loadRetirementSection', 'loadPurchaseSimulatorSection',
  'loadDashboardActionSections', 'loadIncomeSourcesSection'
]) {
  assert.ok(!initDashboardSource.includes(`${hiddenLoader}(`),
    `Overview startup must defer hidden loader ${hiddenLoader}`);
}
assert.match(dashboardClient,
  /recordDashboardClientPerformance\(report\)/,
  'The browser must send one aggregate initial-load envelope to the server log sink');

{
  const helperStart = dashboardClient.indexOf('var APP_DEBUG_MODE');
  const helperEnd = dashboardClient.indexOf('let bankCurrentData');
  const clientLogs = [];
  const reports = [];
  let clock = 1000;
  const rpc = {
    withSuccessHandler() { return this; },
    withFailureHandler() { return this; },
    recordDashboardClientPerformance(report) { reports.push(report); }
  };
  const context = {
    Date: class extends Date {
      static now() { clock += 10; return clock; }
    },
    Math,
    Object,
    String,
    Number,
    Array,
    window: {
      __cashCompassPerformanceDebug: true,
      location: { search: '' },
      console: { info: (...args) => clientLogs.push(args) }
    },
    google: { script: { run: rpc } },
    setTimeout: () => 99,
    clearTimeout: () => {}
  };
  vm.createContext(context);
  vm.runInContext(dashboardClient.slice(helperStart, helperEnd), context);
  context.beginDashboardInitialLoadPerformance_();
  for (const stage of dashboardInitialVisibleStages) {
    const token = context.startDashboardInitialLoadStage_(stage);
    context.finishDashboardInitialLoadStage_(token, 'ok');
  }
  assert.equal(reports.length, 1, 'One complete page load must emit exactly one aggregate report');
  assert.equal(reports[0].operation, 'dashboard.initial_load');
  assert.equal(reports[0].outcome, 'ok');
  assert.equal(reports[0].stages.length, dashboardInitialVisibleStages.length);
  assert.deepEqual(Array.from(reports[0].stages, stage => stage.name), dashboardInitialVisibleStages);
  assert.equal(Object.prototype.hasOwnProperty.call(reports[0], 'user'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(reports[0], 'workbookId'), false);
}

{
  const logs = [];
  const cache = new Map();
  const context = {
    Date,
    JSON,
    Math,
    Object,
    String,
    Number,
    Array,
    CacheService: {
      getUserCache: () => ({
        put: (key, value) => cache.set(key, value),
        get: key => cache.get(key) || null
      })
    },
    isAdminUser_: () => true,
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'false' }) },
    console: { log: line => logs.push(line) },
    Logger: { log: line => logs.push(line) }
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  const stages = dashboardInitialVisibleStages.map((name, index) => ({
    name,
    durationMs: 100 + index,
    outcome: 'ok'
  }));
  const accepted = context.recordDashboardClientPerformance({
    schemaVersion: 1,
    runId: 'load-mockrun-abc123',
    operation: 'dashboard.initial_load',
    outcome: 'ok',
    totalMs: 2500,
    stages,
    workbookId: 'must-not-log',
    user: 'must-not-log@example.com'
  });
  assert.equal(accepted.ok, true);
  assert.equal(logs.length, 1);
  assert.match(logs[0], /^\[PERF-CLIENT\] /);
  assert.ok(!logs[0].includes('must-not-log'),
    'Server log sink must rebuild the envelope and discard arbitrary private metadata');
  assert.equal(JSON.parse(logs[0].replace(/^\[PERF-CLIENT\] /, '')).operation,
    'dashboard.initial_load');
  const latest = context.getLatestDashboardClientPerformance();
  assert.equal(latest.ok, true, 'The sanitized trace must be temporarily retrievable by the admin caller');
  assert.equal(latest.report.runId, 'load-mockrun-abc123');
  assert.equal(Object.prototype.hasOwnProperty.call(latest.report, 'workbookId'), false);

  const rejected = context.recordDashboardClientPerformance({
    schemaVersion: 1,
    runId: 'load-mockrun-abc123',
    operation: 'dashboard.initial_load',
    outcome: 'ok',
    totalMs: 2500,
    stages: stages.concat({ name: 'private_account_name', durationMs: 1, outcome: 'ok' })
  });
  assert.equal(rejected.ok, false);
  assert.equal(logs.length, 1, 'Malformed client timing must be rejected without a log record');
}

assert.match(source,
  /function getLatestDashboardClientPerformance\(\)[\s\S]*?!isAdminUser_\(\)[\s\S]*?CacheService\.getUserCache\(\)\.get/,
  'Temporary trace retrieval must remain read-only, per-user, and admin-gated');

{
  const { context, logs } = buildContext({ flag: 'false' });
  assert.equal(context.startPerformanceTrace_('planner.manual_refresh'), null);
  assert.deepEqual(logs, []);
}

{
  const { context, logs } = buildContext({ propertyThrows: true });
  assert.equal(context.startPerformanceTrace_('planner.manual_refresh'), null);
  assert.deepEqual(logs, []);
}

{
  const { context, logs } = buildContext({ flag: 'false', ticks: [3000, 3040, 3050] });
  const trace = context.createPerformanceTrace_('planner.harness_repeat');
  context.markPerformanceTrace_(trace, 'format_dashboard');
  const report = context.finishPerformanceTrace_(trace, { outcome: 'ok' });
  assert.equal(report.totalMs, 50);
  assert.equal(report.stages[0].name, 'format_dashboard');
  assert.equal(report.stages[0].durationMs, 40);
  assert.equal(logs.length, 1,
    'An explicit guarded harness trace must emit one privacy-safe record without enabling the project flag');
}

{
  const { context, logs } = buildContext({
    flag: 'true',
    ticks: [1000, 1030, 1080, 1090]
  });
  const trace = context.startPerformanceTrace_('planner.manual refresh/user@example.com');
  context.markPerformanceTrace_(trace, 'read_inputs');
  context.markPerformanceTrace_(trace, 'write_dashboard');
  const report = context.finishPerformanceTrace_(trace, { outcome: 'ok' });

  assert.equal(report.operation, 'operation');
  assert.equal(report.totalMs, 90);
  assert.equal(report.measuredStageMs, 80);
  assert.equal(report.unattributedMs, 10);
  assert.equal(report.slowestStage, 'write_dashboard');
  assert.equal(report.slowestStageMs, 50);
  assert.equal(report.outcome, 'ok');
  assert.equal(report.stages.length, 2);
  assert.equal(logs.length, 1, 'One structured log must be emitted per trace');
  assert.match(logs[0], /^\[PERF\] /);
  assert.ok(!logs[0].includes('@'), 'Timing logs must sanitize arbitrary names');

  const repeated = context.finishPerformanceTrace_(trace, { outcome: 'error' });
  assert.equal(repeated, report, 'Finishing twice must be idempotent');
  assert.equal(logs.length, 1, 'Idempotent finish must not duplicate logs');
}

{
  const { context } = buildContext({ flag: 'true', ticks: [2000, 2020] });
  const trace = context.startPerformanceTrace_('planner.run');
  const report = context.finishPerformanceTrace_(trace, {
    outcome: 'error',
    failedStage: 'planner / private detail'
  });
  assert.equal(report.outcome, 'error');
  assert.equal(report.failedStage, 'unknown');
  assert.equal(Object.prototype.hasOwnProperty.call(report, 'errorMessage'), false);
}

for (const stage of [
  'sync_inputs',
  'read_inputs',
  'build_payment_windows',
  'calculate_plan',
  'email'
]) {
  assert.ok(plannerSource.includes(`'${stage}'`), `Planner trace must retain stage ${stage}`);
}
const plannerOutput = await readFile(new URL('../planner_output.js', import.meta.url), 'utf8');
for (const stage of [
  'write_history',
  'cleanup_history_charts',
  'write_dashboard_data',
  'format_dashboard',
  'build_dashboard_charts'
]) {
  assert.ok(plannerOutput.includes(`'${stage}'`), `Planner output trace must retain stage ${stage}`);
}
const appendHistorySource = plannerOutput.slice(
  plannerOutput.indexOf('function appendHistory_'),
  plannerOutput.indexOf('function isDuplicateHistoryRow_')
);
assert.ok(
  appendHistorySource.includes('retireHistoryChartsAndSupportData_(sheet);'),
  'Planner must remove legacy History charts/support tables during the next History append'
);
assert.ok(
  !appendHistorySource.includes('buildHistoryCharts_('),
  'Planner must not rebuild legacy History charts'
);
assert.ok(!plannerOutput.includes('function buildHistoryCharts_'),
  'Obsolete History chart rollback builder must remain removed');
assert.ok(!plannerOutput.includes('.newChart('),
  'Planner output must not contain any embedded chart builders');
assert.ok(!plannerOutput.includes('.insertChart('),
  'Planner output must not insert any embedded charts');

const writeDashboardSource = plannerOutput.slice(
  plannerOutput.indexOf('function writeRecommendations_'),
  plannerOutput.indexOf('function removeAllCharts_')
);
assert.ok(
  writeDashboardSource.includes('retireDashboardCharts_(sheet);'),
  'Planner must retire its legacy Dashboard charts after writing the table'
);
assert.ok(
  !writeDashboardSource.includes('writeDashboardChartDataAndBuildCharts_'),
  'Planner must not write Dashboard chart-support tables or rebuild charts'
);
assert.ok(
  !plannerOutput.includes('function writeDashboardChartDataAndBuildCharts_'),
  'Legacy Dashboard chart writer must remain removed'
);

const retireDashboardStart = plannerOutput.indexOf('function retireDashboardCharts_');
const retireDashboardEnd = plannerOutput.indexOf('/** Remove retired History charts', retireDashboardStart);
assert.ok(retireDashboardStart >= 0 && retireDashboardEnd > retireDashboardStart,
  'Dashboard chart retirement helper must remain present');
const retireDashboardSource = plannerOutput.slice(retireDashboardStart, retireDashboardEnd);
const retiredDashboardTitles = [
  'Net Worth by Run',
  'Cash Flow by Run (Blue=Projected, Red=Previous Month)',
  'Assets vs Liabilities vs Net Worth',
  'Asset Allocation',
  'Liability Breakdown',
  'Credit Card Balances'
];
for (const title of retiredDashboardTitles) {
  assert.ok(retireDashboardSource.includes(`'${title}'`),
    `Dashboard chart retirement must retain the known title: ${title}`);
}
assert.ok(retireDashboardSource.includes('sheet.getCharts()'),
  'Dashboard chart retirement must inspect existing charts once');
assert.ok(retireDashboardSource.includes('sheet.removeChart(chart)'),
  'Dashboard chart retirement must remove matching planner-owned charts');
assert.ok(!retireDashboardSource.includes('removeAllCharts_'),
  'Dashboard cleanup must preserve unknown customer-added charts');

const removed = [];
const knownChart = {
  getOptions: () => ({ get: key => key === 'title' ? 'Asset Allocation' : '' })
};
const customChart = {
  getOptions: () => ({ get: key => key === 'title' ? 'My custom chart' : '' })
};
const unreadableChart = {
  getOptions: () => { throw new Error('metadata unavailable'); }
};
const retirementContext = { String };
vm.createContext(retirementContext);
vm.runInContext(retireDashboardSource, retirementContext);
retirementContext.retireDashboardCharts_({
  getCharts: () => [knownChart, customChart, unreadableChart],
  removeChart: chart => removed.push(chart)
});
assert.deepEqual(removed, [knownChart],
  'Dashboard cleanup must remove known planner charts and preserve unknown/unreadable charts');

const retireHistoryStart = plannerOutput.indexOf('function retireHistoryChartsAndSupportData_');
const retireHistoryEnd = plannerOutput.indexOf('function formatRecommendationsSheet_', retireHistoryStart);
assert.ok(retireHistoryStart >= 0 && retireHistoryEnd > retireHistoryStart,
  'History chart/support retirement helper must remain present');
const retireHistorySource = plannerOutput.slice(retireHistoryStart, retireHistoryEnd);
assert.ok(retireHistorySource.includes('removeAllCharts_(sheet);'),
  'History cleanup must remove all retired embedded chart objects');
assert.ok(retireHistorySource.includes("=== 'Run Label'"),
  'History cleanup must recognize the legacy support-table header');
assert.ok(retireHistorySource.includes('.clearContent()'),
  'History cleanup must clear recognized legacy support data');

let historyChartsRemoved = 0;
let historySupportCleared = 0;
const legacyHistorySheet = {
  getMaxColumns: () => 54,
  getMaxRows: () => 100,
  getCharts: () => [{}],
  removeChart: () => { historyChartsRemoved += 1; },
  getRange: (row, col, rows, cols) => ({
    getDisplayValues: () => [[...(col === 25 ? ['Run Label'] : []), ...Array(Math.max(0, cols - 1)).fill('')]],
    clearContent: () => { historySupportCleared += 1; }
  })
};
const historyRetirementContext = { Math, String };
historyRetirementContext.removeAllCharts_ = sheet => {
  sheet.getCharts().forEach(chart => sheet.removeChart(chart));
};
vm.createContext(historyRetirementContext);
vm.runInContext(retireHistorySource, historyRetirementContext);
historyRetirementContext.retireHistoryChartsAndSupportData_(legacyHistorySheet);
assert.equal(historyChartsRemoved, 1,
  'History cleanup must remove legacy chart objects');
assert.equal(historySupportCleared, 1,
  'History cleanup must clear a recognized legacy support table');

historySupportCleared = 0;
historyRetirementContext.retireHistoryChartsAndSupportData_({
  ...legacyHistorySheet,
  getCharts: () => [],
  getRange: (_row, _col, _rows, cols) => ({
    getDisplayValues: () => [Array(cols).fill('Customer data')],
    clearContent: () => { historySupportCleared += 1; }
  })
});
assert.equal(historySupportCleared, 0,
  'History cleanup must preserve unrecognized customer data outside canonical columns');

const formatRecommendationsStart = plannerOutput.indexOf('function formatRecommendationsSheet_');
const formatPlanStart = plannerOutput.indexOf('function buildRecommendationsFormatPlan_', formatRecommendationsStart);
const formatPlanEnd = plannerOutput.indexOf('function getHistoryHeaders_', formatPlanStart);
assert.ok(formatRecommendationsStart >= 0 && formatPlanStart > formatRecommendationsStart,
  'Dashboard formatting and its in-memory plan helper must remain present');
const formatRecommendationsSource = plannerOutput.slice(formatRecommendationsStart, formatPlanStart);
assert.ok(formatRecommendationsSource.includes('buildRecommendationsFormatPlan_(rows)'),
  'Dashboard formatting must derive targets from the existing row matrix');
assert.ok(formatRecommendationsSource.includes('sheet.getRangeList('),
  'Dashboard formatting must batch repeated styles with RangeList');
assert.ok(formatRecommendationsSource.includes('sheet.setColumnWidths('),
  'Dashboard formatting must batch equal-width columns');
assert.ok(!formatRecommendationsSource.includes('.getValue()'),
  'Dashboard formatting must not read individual cells after writing the row matrix');
assert.ok(!formatRecommendationsSource.includes('.getDataRange()'),
  'Dashboard formatting must not re-read the generated sheet');
assert.ok(!plannerOutput.includes('function formatSectionTable_'),
  'Dashboard formatting must not restore per-section full-sheet reads');

const formatPlanSource = plannerOutput.slice(formatPlanStart, formatPlanEnd);
const formatPlanContext = { Math, Number, Object, String };
vm.createContext(formatPlanContext);
vm.runInContext(formatPlanSource, formatPlanContext);
const padDashboardRow = values => values.concat(Array(Math.max(0, 11 - values.length)).fill(''));
const formatRows = [
  ['Debt Planner Dashboard'],
  [''],
  ['Visual Summary'],
  ['Charts are shown below the dashboard tables.'],
  [''],
  ['Key Metrics'],
  ['Metric', 'Value'],
  ['Monthly Stability', 'Stable'],
  ['Other Obligations', 0],
  ['Estimated Months To Pay Off Target', 12],
  ['Months of Minimum Coverage', 1.25],
  [''],
  ['Asset Breakdown'],
  ['Account', 'Type', 'Value'],
  ['Brokerage', 'Taxable', 1000],
  [''],
  ['Pay Now'],
  ['Account', 'Type', 'Due Date', 'Days Until Due', 'Minimum Payment', 'Balance', 'APR'],
  ['Visa', 'Credit Card', '2026-08-08', 3, 75, 500, 19.99],
  [''],
  ['Recommendation'],
  ['Strategy', 'Target Account', 'Target Type', 'Target APR', 'Target Balance', 'Suggested Extra Payment', 'Annual Interest Savings', 'Months To Pay Off Target', 'Months To Pay Off All Cards'],
  ['Balanced', 'Visa', 'Credit Card', 19.99, 500, 100, 25, 5, 9],
  [''],
  ['Other Obligations'],
  ['Account', 'Type', 'Minimum Payment', 'Balance', 'APR'],
  ['Loan', 'Other', 50, 400, 4.5],
  ['']
].map(padDashboardRow);
const formatPlan = formatPlanContext.buildRecommendationsFormatPlan_(formatRows);
assert.ok(formatPlan.sectionHeaderRanges.includes('A3:K3'));
assert.ok(formatPlan.sectionHeaderRanges.includes('A25:K25'));
assert.ok(formatPlan.tableHeaderRanges.includes('A18:K18'));
assert.ok(formatPlan.currencyRanges.includes('C15:C15'),
  'Asset Breakdown values must retain currency formatting');
assert.ok(formatPlan.currencyRanges.includes('E19:E19'));
assert.ok(formatPlan.currencyRanges.includes('F19:F19'));
assert.ok(formatPlan.percentRanges.includes('G19:G19'));
assert.ok(formatPlan.integerRanges.includes('D19:D19'));
assert.ok(formatPlan.decimalRanges.includes('B11'));
assert.equal(formatPlan.stabilityRow, 8);
assert.equal(formatPlan.stabilityValue, 'Stable');
assert.equal(formatPlanContext.plannerColumnA1_(27), 'AA');
for (const stage of ['touch_source', 'build_snapshot', 'save_baseline']) {
  assert.ok(dashboardSource.includes(`'${stage}'`), `Dashboard trace must retain stage ${stage}`);
}
assert.match(dashboardSource, /planner\.manual_refresh/);
assert.match(dashboardSource, /planner\.save_refresh/);
assert.match(dashboardClient, /\[CashCompass performance\]/);

console.log('Performance timing regression checks passed.');
