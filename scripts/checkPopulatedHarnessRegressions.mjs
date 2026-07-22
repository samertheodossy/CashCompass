import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const files = Object.fromEntries(await Promise.all([
  'test_harness_core.js',
  'test_harness_assert.js',
  'test_harness_data.js',
  'test_harness_report.js',
  'test_harness_scenarios.js',
  'test_harness_scenarios_populated.js',
  'test_harness_scenarios_house_financial_accuracy.js',
  'test_harness_scenarios_financial_integrity.js',
  'test_harness_suites.js',
  'validation_testing_server.js',
  'ValidationTestingUI.html',
  'financial_integrity_canonical.js',
  'financial_integrity_audit.js',
  'planner_output.js',
  'code.js',
  'rolling_debt_payoff.js',
  'dashboard_data.js',
  'bank_accounts.js',
  'investments.js',
  'house_values.js',
  'upcoming_expenses.js',
  'retirement.js',
  'onboarding.js'
].map(async (name) => [name, await readFile(new URL(`../${name}`, import.meta.url), 'utf8')])));

const core = files['test_harness_core.js'];
assert.match(core, /Drive\.Permissions\.list\(/, 'Harness must inspect Drive permissions');
assert.match(core, /type === 'anyone' \|\| type === 'domain'/,
  'Restricted gate must reject anyone/domain sharing');
assert.doesNotMatch(
  core.slice(core.indexOf('function harnessInspectRestrictedSharing_'), core.indexOf('function harnessStampIdentityMarkers_')),
  /emailAddress|permissionDetails|displayName/,
  'Sharing report must not read or log identities'
);
assert.match(core, /Drive\.Files\.get\(ss\.getId\(\), \{ fields: 'id,trashed' \}\)/,
  'Trash cleanup must be verified by Drive read-back');

const assertionCtx = vm.createContext({ Date, String });
vm.runInContext(files['test_harness_assert.js'], assertionCtx);
const assertionUpdates = [];
const progressCollector = assertionCtx.makeAssertionCollector_((_result, counts) => {
  assertionUpdates.push({ completed: counts.completed, pass: counts.pass, fail: counts.fail });
});
progressCollector.equals('progress pass', 1, 1);
progressCollector.equals('progress fail', 1, 2);
assert.deepEqual(assertionUpdates, [
  { completed: 1, pass: 1, fail: 0 },
  { completed: 2, pass: 1, fail: 1 }
], 'Assertion progress callback must report cumulative pass/fail counts');

const data = files['test_harness_data.js'];
const dataCode = data.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
assert.doesNotMatch(dataCode, /getUserSpreadsheet_\s*\(/,
  'Representative seeding must never resolve a user/bounded workbook');
for (const required of [
  'harnessSeedBank_',
  'harnessSeedInvestment_',
  'harnessSeedHouse_',
  'harnessSeedDebt_',
  'harnessSeedBill_',
  'harnessSeedIncome_',
  'harnessSeedUpcoming_',
  'harnessSeedRetirement_'
]) {
  assert.match(data, new RegExp(`function ${required}\\(`), `Missing representative seed: ${required}`);
}
assert.ok((data.match(/ctx\.assertWritable\(\);/g) || []).length >= 10,
  'Representative seed must re-assert the disposable target before module writes');
assert.match(data, /existingTotalRow === -1[\s\S]*?harnessInsertBeforeByHeader_\(sheet, existingTotalRow, debtValues\)/,
  'Representative debt must be inserted above an existing TOTAL DEBT summary row');
assert.match(data, /refreshDebtsTotalRow_\(sheet, hm, totalRow\);[\s\S]*?applyDebtsSheetStyling_\(sheet\);/,
  'Representative debt seeding must restore a white data row and green TOTAL DEBT band');
assert.match(data, /'Linked Property': ''/,
  'Representative debt seeding must exercise the current trailing schema');

const scenario = files['test_harness_scenarios_populated.js'];
assert.match(scenario, /id: 'SMOKE-POPULATED-FIXTURE'/);
assert.match(scenario, /requiresTrashCleanup: true/,
  'Populated fixture must always exercise verified cleanup');
for (const moduleName of ['Bank', 'Investments', 'Properties', 'Debts', 'Bills', 'Income', 'Upcoming', 'Retirement']) {
  assert.ok(scenario.includes(`'${moduleName}'`), `Missing functional assertion module: ${moduleName}`);
}

assert.match(files['test_harness_scenarios.js'], /getHarnessPopulatedFixtureScenario_/,
  'Scenario must be registered');
assert.match(files['test_harness_suites.js'], /SUITE-POPULATED-FIXTURE/,
  'Populated fixture suite must be registered');
assert.match(files['test_harness_suites.js'], /SUITE-CENTRAL-SAFETY/,
  'Recent-session Central safety suite must be registered');
assert.match(files['test_harness_suites.js'], /SUITE-HOUSE-FINANCIAL-ACCURACY/,
  'House Financial Accuracy schema suite must be registered');
assert.match(files['test_harness_scenarios.js'], /getHarnessFinancialIntegrityCanonicalScenario_/,
  'Financial Integrity canonical scenario must be registered');
assert.match(files['test_harness_suites.js'], /SUITE-FINANCIAL-INTEGRITY-CANONICAL/,
  'Financial Integrity canonical suite must be registered on the single test console');
const canonicalSource = files['financial_integrity_canonical.js'];
const canonicalCode = canonicalSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
assert.match(canonicalSource, /function readCanonicalFinancialSnapshot_\(ss\)/,
  'Canonical snapshot must require an explicit spreadsheet');
assert.doesNotMatch(canonicalCode, /getUserSpreadsheet_\s*\(|getActiveSpreadsheet\s*\(/,
  'Canonical snapshot must never resolve a user or bounded workbook');
assert.doesNotMatch(canonicalCode,
  /\.setValue\s*\(|\.setValues\s*\(|\.clearContent\s*\(|\.insertSheet\s*\(|\.deleteSheet\s*\(|\.appendRow\s*\(/,
  'Canonical snapshot implementation must remain read-only');
const canonicalCtx = vm.createContext({
  Math, Number, String, Object, Date,
  round2_: (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100,
  toNumber_: (n) => Number(n || 0),
  getCurrentYear_: () => 2026,
  FINANCIAL_AUDIT_TOLERANCE_USD_: 0.01
});
vm.runInContext(canonicalSource, canonicalCtx);
const auditSource = files['financial_integrity_audit.js'];
const auditCode = auditSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
vm.runInContext(auditSource, canonicalCtx);
assert.match(auditSource, /function runFinancialIntegrityAudit\(explicitSpreadsheet, options\)/,
  'Financial Integrity audit must preserve no-argument production use and expose an explicit disposable seam');
for (const fn of ['runAssetAudit', 'runPlannerAudit', 'runDashboardAudit', 'runHistoryAudit']) {
  assert.match(auditSource, new RegExp(`function ${fn}\\(explicitSpreadsheet`),
    `Financial Integrity registry module missing: ${fn}`);
}
assert.doesNotMatch(auditCode,
  /\.setValue\s*\(|\.setValues\s*\(|\.clearContent\s*\(|\.insertSheet\s*\(|\.deleteSheet\s*\(|\.appendRow\s*\(/,
  'Financial Integrity audit modules must remain read-only');
assert.equal(canonicalCtx.canonicalCurrentRowIncluded_(true, 'No'), false,
  'Explicit inactive must be excluded from the current position');
assert.equal(canonicalCtx.canonicalCurrentRowIncluded_(true, ''), true,
  'Blank Active must remain active for compatibility');
assert.equal(canonicalCtx.canonicalCurrentRowIncluded_(false, 'No'), true,
  'A missing Active column must use the approved active compatibility fallback');
assert.equal(canonicalCtx.canonicalSummaryRow_('debts', 'TOTAL DEBT'), true,
  'Debt summary rows must never enter canonical totals');
const propertyFinancing = canonicalCtx.canonicalBuildPropertyFinancing_([
  { name: 'Home', key: 'home', included: true, currentValue: 300000, legacyLoanBalance: 175000 },
  { name: 'Cabin', key: 'cabin', included: true, currentValue: 100000, legacyLoanBalance: 50000 }
], [
  { name: 'Mortgage', included: true, type: 'Loan', balance: 175000, linkedProperty: 'Home' },
  { name: 'Old Mortgage', included: false, type: 'Loan', balance: 10000, linkedProperty: 'Home' }
], 0.01);
assert.equal(propertyFinancing.byProperty.find((row) => row.property === 'Home').linkedDebtCount, 1,
  'Inactive linked debt must not enter authoritative property financing');
assert.equal(propertyFinancing.byProperty.find((row) => row.property === 'Home').estimatedEquity, 125000,
  'Linked property equity must subtract authoritative financing once');
assert.ok(propertyFinancing.blockingIssues.some((issue) => issue.code === 'UNLINKED_PROPERTY_FINANCING'),
  'An unlinked non-zero legacy property loan must block reconciliation');
const fakeSheet = (name, values) => ({
  getName: () => name,
  getDataRange: () => ({
    getValues: () => values,
    getDisplayValues: () => values.map((row) => row.map((value) => value == null ? '' : String(value)))
  })
});
const fakeSheets = {
  BANK: fakeSheet('INPUT - Bank Accounts', [
    ['Account Name', 'Jan-26', 'Active'],
    ['Checking', 1000, 'Yes'], ['Blank Cash', 500, ''], ['Closed Cash', 900, 'No']
  ]),
  ACCOUNTS: fakeSheet('SYS - Accounts', [
    ['Account Name', 'Current Balance', 'Active'],
    ['Checking', 1000, 'Yes'], ['Blank Cash', 500, ''], ['Closed Cash', 900, 'No']
  ]),
  INVESTMENTS: fakeSheet('INPUT - Investments', [
    ['Account Name', 'Type', 'Jan-26', 'Active'],
    ['Brokerage', 'Brokerage', 2000, 'Yes'], ['Closed Investment', 'Brokerage', 700, 'No']
  ]),
  ASSETS: fakeSheet('SYS - Assets', [
    ['Account Name', 'Current Balance', 'Active'],
    ['Brokerage', 2000, 'Yes'], ['Closed Investment', 700, 'No']
  ]),
  HOUSE_VALUES: fakeSheet('INPUT - House Values', [
    ['House', 'Loan Amount Left', 'Jan-26', 'Active'],
    ['Home', 175000, 300000, 'Yes'], ['Cabin', 50000, 100000, 'Yes'],
    ['Sold House', 0, 400000, 'No']
  ]),
  HOUSE_ASSETS: fakeSheet('SYS - House Assets', [
    ['House', 'Current Value', 'Active'],
    ['Home', 300000, 'Yes'], ['Cabin', 100000, 'Yes'], ['Sold House', 400000, 'No']
  ]),
  DEBTS: fakeSheet('INPUT - Debts', [
    ['Account Name', 'Type', 'Account Balance', 'Active', 'Linked Property'],
    ['Mortgage', 'Loan', 175000, 'Yes', 'Home'],
    ['Blank Card', 'Credit Card', 5000, '', ''],
    ['Old Mortgage', 'Loan', 10000, 'No', 'Home'],
    ['TOTAL DEBT', '', 190000, '', '']
  ])
};
canonicalCtx.getSheetNames_ = () => ({
  BANK_ACCOUNTS: 'BANK', ACCOUNTS: 'ACCOUNTS',
  INVESTMENTS: 'INVESTMENTS', ASSETS: 'ASSETS',
  HOUSE_VALUES: 'HOUSE_VALUES', HOUSE_ASSETS: 'HOUSE_ASSETS', DEBTS: 'DEBTS'
});
canonicalCtx.getBankAccountsYearBlock_ = () => ({
  headerRow: 1, dataStartRow: 2, dataEndRow: 4, firstMonthCol: 2
});
canonicalCtx.getInvestmentsYearBlock_ = () => ({
  headerRow: 1, dataStartRow: 2, dataEndRow: 3, firstMonthCol: 3
});
canonicalCtx.getHouseValuesYearBlock_ = () => ({
  headerRow: 1, dataStartRow: 2, dataEndRow: 4, firstMonthCol: 3
});
canonicalCtx.isBankAccountDataRowName_ = (name) => !!name;
canonicalCtx.isInvestmentDataRowName_ = (name) => !!name;
canonicalCtx.isHouseDataRowName_ = (name) => !!name;
canonicalCtx.parseMonthHeader_ = (header) => header === 'Jan-26' ? new Date(2026, 0, 1) : null;
const fakeWorkbook = { getSheetByName: (name) => fakeSheets[name] || null };
const fakeSnapshot = canonicalCtx.readCanonicalFinancialSnapshot_(fakeWorkbook);
assert.equal(fakeSnapshot.totals.cash, 1500,
  'Full canonical snapshot must exclude inactive cash and include blank Active');
assert.equal(fakeSnapshot.totals.totalLiabilities, 180000,
  'Full canonical snapshot must exclude inactive debt and summary rows');
assert.equal(fakeSnapshot.totals.netWorth, 223500,
  'Full canonical snapshot must reconcile the approved current-position identity');
assert.equal(fakeSnapshot.mirrors.cash.matches, true,
  'Full canonical snapshot must accept a matching source/mirror pair');
assert.ok(fakeSnapshot.blockingIssues.some((issue) => issue.code === 'UNLINKED_PROPERTY_FINANCING'),
  'Full canonical snapshot must fail closed on unlinked non-zero property financing');
const assetAudit = canonicalCtx.auditCanonicalAssetSnapshot_(fakeSnapshot);
const plannerAudit = canonicalCtx.auditCanonicalPlannerSnapshot_(fakeSnapshot);
const dashboardAudit = canonicalCtx.auditCanonicalDashboardSnapshot_(fakeSnapshot);
assert.equal(assetAudit.status, 'PASS_WITH_OBSERVATIONS',
  'Asset audit must surface unlinked legacy financing as a neutral blocking observation');
assert.equal(assetAudit.metrics.reconciliationBlocked, true,
  'Asset audit must explicitly expose blocked property reconciliation');
assert.equal(plannerAudit.status, 'PASS',
  'Planner audit must reconcile the canonical current-position identity');
assert.equal(plannerAudit.metrics.reconciles, true,
  'Planner audit must expose an exact reconciliation result');
assert.equal(dashboardAudit.status, 'PASS',
  'Dashboard audit must reconcile the canonical Dashboard adapter');
assert.equal(dashboardAudit.metrics.reconciles, true,
  'Dashboard audit must expose an exact reconciliation result');
const normalizedConsumerDebts = [
  { name: 'Active Loan', originalName: 'Active Loan', type: 'Loan', balance: 100, active: true },
  { name: 'Blank Active Card', originalName: 'Blank Active Card', type: 'Credit Card', balance: 50, active: true },
  { name: 'Inactive Loan', originalName: 'Inactive Loan', type: 'Loan', balance: 900, active: false },
  { name: 'TOTAL DEBT', originalName: 'TOTAL DEBT', type: '', balance: 1050, active: true }
];
const consumerLiabilities = canonicalCtx.canonicalLiabilitySummaryFromNormalizedDebts_(
  normalizedConsumerDebts);
assert.equal(consumerLiabilities.totalLiabilities, 150,
  'Planner consumer basis must exclude inactive and summary debts');
assert.equal(consumerLiabilities.loans, 100,
  'Planner consumer breakdown must include only the active loan');
const rollingBasis = canonicalCtx.canonicalRollingDebtBasis_(
  normalizedConsumerDebts,
  [{ code: 'PLANNED_CARD_FUNDED_MAPPED', amount: 25 }],
  [
    { name: 'Active Loan', originalName: 'Active Loan', type: 'Loan', balance: 100, active: true },
    { name: 'Blank Active Card', originalName: 'Blank Active Card', type: 'Credit Card', balance: 75, active: true }
  ]
);
assert.equal(rollingBasis.canonicalLiveDebt, 150,
  'Rolling canonical live anchor must equal active-only liabilities');
assert.equal(rollingBasis.scenarioAdjustmentTotal, 25,
  'Rolling scenario adjustment must remain separately itemized');
assert.equal(rollingBasis.modeledStartingDebt, 175,
  'Rolling modeled start must include the separate scenario adjustment');
assert.equal(rollingBasis.reconciles, true,
  'Rolling modeled start must reconcile to live debt plus scenario adjustments');
const dashboardBasis = canonicalCtx.canonicalDashboardTotals_(fakeSnapshot, {
  cash: 999999,
  investments: 999999,
  houseValues: 999999,
  houseLoans: 999999,
  debt: 999999
});
assert.equal(dashboardBasis.cash, 1500,
  'Dashboard must prefer canonical active cash over a stale legacy total');
assert.equal(dashboardBasis.investments, 2000,
  'Dashboard must prefer canonical active investments over a stale legacy total');
assert.equal(dashboardBasis.houseValues, 400000,
  'Dashboard must prefer canonical active property value over a stale legacy total');
assert.equal(dashboardBasis.debt, 180000,
  'Dashboard liabilities must equal canonical liabilities');
assert.equal(dashboardBasis.netWorth, 223500,
  'Dashboard net worth must equal the canonical current position');
const dashboardFallback = canonicalCtx.canonicalDashboardTotals_(
  { sources: {}, totals: {}, propertyFinancing: {} },
  { cash: 11, investments: 22, houseValues: 33, houseLoans: 4, debt: 5 }
);
assert.equal(dashboardFallback.netWorth, 61,
  'Dashboard must preserve existing totals when canonical sources are unavailable');
for (const domain of ['cash', 'investments', 'properties', 'debts']) {
  assert.equal(dashboardFallback.sourceMode[domain], 'LEGACY_FALLBACK',
    `Dashboard ${domain} fallback must be explicit and domain-scoped`);
}
const historyBasis = canonicalCtx.canonicalHistorySnapshotValues_(fakeSnapshot, {
  investments: 999999,
  grossRealEstate: 999999,
  totalAssets: 999999,
  totalLiabilities: 999999,
  netWorth: 999999
});
assert.equal(historyBasis.investments, 2000,
  'History must store canonical active investments');
assert.equal(historyBasis.grossRealEstate, 400000,
  'History must store canonical active property value');
assert.equal(historyBasis.totalAssets, 403500,
  'History must store canonical total assets including cash');
assert.equal(historyBasis.totalLiabilities, 180000,
  'History must store canonical active liabilities');
assert.equal(historyBasis.netWorth, 223500,
  'History must store canonical net worth');
const legacyHistoryBasis = canonicalCtx.canonicalHistorySnapshotValues_(null, {
  investments: 11,
  grossRealEstate: 22,
  totalAssets: 33,
  totalLiabilities: 4,
  netWorth: 29
});
assert.equal(legacyHistoryBasis.netWorth, 29,
  'History must retain the existing Planner values when canonical sources are unavailable');
assert.equal(legacyHistoryBasis.sourceMode.netWorth, 'LEGACY_FALLBACK',
  'History legacy fallback must remain explicit');
const partialHistoryBasis = canonicalCtx.canonicalHistorySnapshotValues_({
  sources: {
    cash: { available: true },
    investments: { available: true },
    properties: { available: true },
    debts: { available: false }
  },
  totals: fakeSnapshot.totals
}, {
  investments: 11,
  grossRealEstate: 22,
  totalAssets: 33,
  totalLiabilities: 4,
  netWorth: 29
});
assert.deepEqual({
  investments: partialHistoryBasis.investments,
  grossRealEstate: partialHistoryBasis.grossRealEstate,
  totalAssets: partialHistoryBasis.totalAssets,
  totalLiabilities: partialHistoryBasis.totalLiabilities,
  netWorth: partialHistoryBasis.netWorth
}, {
  investments: 11,
  grossRealEstate: 22,
  totalAssets: 33,
  totalLiabilities: 4,
  netWorth: 29
}, 'History must retain one internally consistent legacy row when any canonical source is unavailable');
const historyAudit = canonicalCtx.auditCanonicalHistorySnapshot_(fakeSnapshot, {
  available: true,
  capturedAt: '2026-07-22 14:00:00',
  investments: 2000,
  grossRealEstate: 400000,
  totalAssets: 403500,
  totalLiabilities: 180000,
  netWorth: 223500
});
assert.equal(historyAudit.status, 'PASS',
  'A current canonical History snapshot must pass');
assert.equal(historyAudit.metrics.materiallyStale, false,
  'Exact History values must not be marked stale');
const staleHistoryAudit = canonicalCtx.auditCanonicalHistorySnapshot_(fakeSnapshot, {
  available: true,
  capturedAt: '2026-07-21 14:00:00',
  investments: 1999,
  grossRealEstate: 400000,
  totalAssets: 403499,
  totalLiabilities: 180000,
  netWorth: 223499
});
assert.equal(staleHistoryAudit.status, 'PASS_WITH_OBSERVATIONS',
  'A materially different History snapshot must be an observation');
assert.equal(staleHistoryAudit.metrics.materiallyStale, true,
  'History differences over $0.01 must be marked stale');
const canonicalScenario = files['test_harness_scenarios_financial_integrity.js'];
assert.match(canonicalScenario, /requiresTrashCleanup:\s*true/,
  'Financial Integrity regression must always verify Trash cleanup');
assert.match(canonicalScenario, /readCanonicalFinancialSnapshot_\(ctx\.ss\)/,
  'Financial Integrity regression must pass only the explicit disposable workbook');
assert.match(canonicalScenario,
  /runFinancialIntegrityAudit\(ctx\.historyAuditSs, \{[\s\S]*?historySnapshot: ctx\.historyBaseline/,
  'Financial Integrity audit regression must pass only the fresh disposable workbook and its direct History snapshot');
assert.match(canonicalScenario,
  /historySheet = appendHistory_\([\s\S]*?ctx\.historyAuditSs, harnessFiHistorySummary_\(\), null,[\s\S]*?ctx\.canonicalBaseline\)/,
  'Financial Integrity regression must write History only through its fresh explicit disposable workbook');
assert.match(canonicalScenario,
  /appendHistory_\([\s\S]*?ctx\.historyAuditSs,[\s\S]*?SpreadsheetApp\.flush\(\);[\s\S]*?historyBaseline =[\s\S]*?readLatestFinancialHistorySnapshotFromSheet_\(ctx\.historySheet\)/,
  'Disposable History fixture must flush its append before exact-Sheet read-back');
assert.match(canonicalScenario, /expectedAssertionCount:\s*53/,
  'Financial Integrity progress must declare its 53-assertion denominator');
assert.doesNotMatch(canonicalScenario, /getUserSpreadsheet_\s*\(|getActiveSpreadsheet\s*\(/,
  'Financial Integrity regression must never resolve an existing workbook');
assert.match(canonicalScenario,
  /ensureOnboardingBankAccountsSheetFromDashboard\('normal', ctx\.ss\);[\s\S]*?ensureSysAccountsSheet_\(ctx\.ss\);/,
  'Financial Integrity fixture must create both the bank input ledger and SYS account mirror');
assert.ok((canonicalScenario.match(/ctx\.assertWritable\(\);/g) || []).length >= 18,
  'Financial Integrity scenario must continuously re-verify its disposable target before writes');
assert.match(files['code.js'],
  /const normalizedDebts = normalizeDebts_\(debtRows, aliasMap\);[\s\S]*?const debts = canonicalLiveNormalizedDebts_\(normalizedDebts\);[\s\S]*?canonicalLiabilitySummaryFromNormalizedDebts_\(debts\)/,
  'Planner must consume the shared canonical active-only liability basis');
assert.match(files['rolling_debt_payoff.js'],
  /const normalizedDebts = normalizeDebts_\(debtRows, aliasMap\);[\s\S]*?const debts = canonicalLiveNormalizedDebts_\(normalizedDebts\);/,
  'Rolling must start from the shared canonical active-only debt collection');
assert.match(files['rolling_debt_payoff.js'],
  /canonical_live_debt:[\s\S]*?scenario_debt_adjustments:[\s\S]*?modeled_starting_debt:/,
  'Rolling must publish live debt separately from scenario-adjusted modeled debt');
assert.doesNotMatch(files['rolling_debt_payoff.js'],
  /readCanonicalFinancialSnapshot_\s*\(/,
  'Rolling live debt must remain on its lightweight canonical helper path');
assert.match(files['code.js'],
  /canonicalHistorySnapshot = readCanonicalFinancialSnapshot_\(ss\);[\s\S]*?appendHistory_\(ss, summary, performanceTrace, canonicalHistorySnapshot\)/,
  'Planner must pass one authoritative snapshot into the History writer');
assert.match(files['planner_output.js'],
  /function appendHistory_\([\s\S]*?return sheet;[\s\S]*?function isDuplicateHistoryRow_/,
  'History writer must return its exact Sheet as an additive same-execution test seam');
assert.match(auditSource,
  /function runFinancialIntegrityAudit\(explicitSpreadsheet, options\)[\s\S]*?historySnapshot[\s\S]*?m\.fn\(ssForInit, canonicalSnapshot, canonicalReadError,[\s\S]*?suppliedHistorySnapshot\)/,
  'Aggregate audit must accept an explicit read-only History snapshot without changing its default workbook path');
assert.match(auditSource,
  /function readLatestFinancialHistorySnapshot_\(ss\)[\s\S]*?readLatestFinancialHistorySnapshotFromSheet_\(sheet\)/,
  'Production History reader must delegate to the exact-Sheet read-only parser');
assert.match(canonicalScenario,
  /fresh = SpreadsheetApp\.openById\(ctx\.ss\.getId\(\)\);[\s\S]*?assertDisposableTarget_\(fresh, ctx\.runId\)/,
  'History fixture must re-open and re-verify only its own disposable workbook');
assert.match(canonicalScenario,
  /ensureHistorySheet_\(ctx\.ss\);[\s\S]*?SpreadsheetApp\.flush\(\);[\s\S]*?historyAuditSs = harnessFiFreshDisposableSpreadsheet_\(ctx\);[\s\S]*?appendHistory_\([\s\S]*?ctx\.historyAuditSs/,
  'History fixture must create and flush History before reopening the disposable workbook for append');
assert.match(canonicalScenario,
  /historyBaseline =[\s\S]*?readLatestFinancialHistorySnapshotFromSheet_\(ctx\.historySheet\)[\s\S]*?auditBaseline = runFinancialIntegrityAudit\(ctx\.historyAuditSs, \{[\s\S]*?historySnapshot: ctx\.historyBaseline/,
  'History fixture must use the exact written Sheet and supplied read-only snapshot for its immediate audit');
assert.match(files['dashboard_data.js'],
  /canonicalSnapshot = readCanonicalFinancialSnapshot_\(ss\);[\s\S]*?canonicalDashboardTotals_\(canonicalSnapshot,/,
  'Dashboard must consume the shared explicit-spreadsheet canonical snapshot');
assert.doesNotMatch(files['dashboard_data.js'],
  /IS_CENTRAL[\s\S]{0,240}canonicalDashboardTotals_|canonicalDashboardTotals_[\s\S]{0,240}IS_CENTRAL/,
  'Dashboard canonical totals must not fork between Central and bounded');
const houseAccuracyScenario = files['test_harness_scenarios_house_financial_accuracy.js'];
assert.match(houseAccuracyScenario,
  /insertCashFlowRow_\([\s\S]*?'Harness Ambiguous Loan'[\s\S]*?insertRowAfter\(ambiguousPaymentRowA\)/,
  'House accuracy fixture must use production insertion before simulating one malformed duplicate');
assert.match(houseAccuracyScenario,
  /Duplicate linked debt names were excluded to prevent double counting\./,
  'House accuracy suite must assert duplicate linked debts fail closed');
assert.match(houseAccuracyScenario,
  /Ambiguous loan-payment rows were excluded to prevent double counting\./,
  'House accuracy suite must assert duplicate Cash Flow payments fail closed');
const centralSafetySuite = files['test_harness_suites.js'].match(
  /id: 'SUITE-CENTRAL-SAFETY'[\s\S]*?scenarioIds:\s*\[([\s\S]*?)\]\s*\}/
);
assert.ok(centralSafetySuite, 'Central safety suite descriptor must expose scenarioIds');
for (const scenarioId of [
  'REGRESSION-RECOVERY-DUPLICATE-GUARD',
  'REGRESSION-QUICK-ADD-WRITE-GUARD',
  'SMOKE-POPULATED-FIXTURE'
]) {
  assert.ok(centralSafetySuite[1].includes(`'${scenarioId}'`),
    `Central safety suite must include ${scenarioId}`);
}
assert.match(files['test_harness_report.js'], /Restricted sharing/,
  'Harness report gate must surface Restricted sharing');
assert.match(files['test_harness_report.js'], /verified Trash/,
  'Harness report gate must surface verified Trash cleanup');
assert.match(files['test_harness_core.js'], /CacheService\.getUserCache\(\)/,
  'Harness progress must remain scoped to the running user');
assert.doesNotMatch(files['test_harness_core.js'],
  /HARNESS_RUN_PROGRESS[\s\S]{0,800}workbook(Id|Name)|workbook(Id|Name)[\s\S]{0,800}HARNESS_RUN_PROGRESS/,
  'Harness progress snapshots must not expose workbook identity');
assert.match(files['test_harness_assert.js'], /onRecord\(result, \{[\s\S]*?completed:[\s\S]*?pass:[\s\S]*?fail:/,
  'Assertion collector must publish live pass/fail progress without changing results');
assert.match(files['validation_testing_server.js'], /function vtGetHarnessRunProgress\(progressToken\)/,
  'Validation server must expose the guarded progress poll seam');
assert.match(files['ValidationTestingUI.html'], /vtGetHarnessRunProgress\(run\.token\)/,
  'Validation console must poll live Harness progress');
assert.match(files['ValidationTestingUI.html'], /passed<\/span>[\s\S]*?failed<\/span>/,
  'Validation console must render passed/failed denominators');
assert.match(files['ValidationTestingUI.html'], /Long Google Sheets operations can remain in one phase/,
  'Validation console must explain long-running server phases');

for (const [file, fn] of [
  ['bank_accounts.js', 'ensureSysAccountsSheet_'],
  ['investments.js', 'ensureInputInvestmentsSheet_'],
  ['investments.js', 'ensureSysAssetsSheet_'],
  ['house_values.js', 'ensureInputHouseValuesSheet_'],
  ['house_values.js', 'ensureSysHouseAssetsSheet_'],
  ['upcoming_expenses.js', 'getOrCreateUpcomingExpensesSheet_'],
  ['retirement.js', 'getOrCreateRetirementSheet_']
]) {
  assert.match(files[file], new RegExp(`function ${fn}\\(optionalSs\\)`),
    `${fn} must expose the explicit disposable-workbook seam`);
}
for (const fn of [
  'ensureOnboardingBankAccountsSheetFromDashboard',
  'ensureOnboardingDebtsSheetFromDashboard',
  'ensureOnboardingBillsSheetFromDashboard',
  'ensureOnboardingUpcomingSheetFromDashboard'
]) {
  assert.match(files['onboarding.js'], new RegExp(`function ${fn}\\(mode, optionalSs\\)`),
    `${fn} must expose the explicit disposable-workbook seam`);
}

console.log('Populated harness safety regression checks passed.');
