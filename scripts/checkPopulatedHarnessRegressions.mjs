import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const files = Object.fromEntries(await Promise.all([
  'test_harness_core.js',
  'test_harness_data.js',
  'test_harness_report.js',
  'test_harness_scenarios.js',
  'test_harness_scenarios_populated.js',
  'test_harness_scenarios_house_financial_accuracy.js',
  'test_harness_scenarios_financial_integrity.js',
  'test_harness_suites.js',
  'financial_integrity_canonical.js',
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
const canonicalScenario = files['test_harness_scenarios_financial_integrity.js'];
assert.match(canonicalScenario, /requiresTrashCleanup:\s*true/,
  'Financial Integrity regression must always verify Trash cleanup');
assert.match(canonicalScenario, /readCanonicalFinancialSnapshot_\(ctx\.ss\)/,
  'Financial Integrity regression must pass only the explicit disposable workbook');
assert.doesNotMatch(canonicalScenario, /getUserSpreadsheet_\s*\(|getActiveSpreadsheet\s*\(/,
  'Financial Integrity regression must never resolve an existing workbook');
assert.match(canonicalScenario,
  /ensureOnboardingBankAccountsSheetFromDashboard\('normal', ctx\.ss\);[\s\S]*?ensureSysAccountsSheet_\(ctx\.ss\);/,
  'Financial Integrity fixture must create both the bank input ledger and SYS account mirror');
assert.ok((canonicalScenario.match(/ctx\.assertWritable\(\);/g) || []).length >= 18,
  'Financial Integrity scenario must continuously re-verify its disposable target before writes');
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
