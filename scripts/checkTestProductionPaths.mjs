import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (name) => readFile(new URL(name, root), 'utf8');

const requiredProductionPaths = {
  'test_harness_scenarios.js': [
    'runMinimalBootstrap_', 'addDonation('
  ],
  'test_harness_scenarios_bills.js': [
    'buildInputBillDueCandidates_', 'buildCashFlowYearSheet_',
    'ensureBillsSheetSchema_', 'applyBillsSheetStyling_', 'appendActivityLog_'
  ],
  'test_harness_scenarios_recovery.js': [
    'decideRecoveryCandidateAction_'
  ],
  'test_harness_scenarios_quick_add.js': [
    'buildCashFlowYearSheet_', 'insertCashFlowRow_',
    'inspectQuickAddWriteInSpreadsheet_', 'restoreQuickAddPaymentWriteInSpreadsheet_'
  ],
  'test_harness_scenarios_performance.js': [
    'runDebtPlanner({ spreadsheet: ctx.ss'
  ],
  'test_harness_scenarios_bills_pay.js': [
    'quickAddPayment({', 'markDashboardBillOccurrencePaid(marker, ctx.ss)'
  ],
  'test_harness_data.js': [
    'ensureInputSettingsSheet_', 'insertNewBankAccountHistoryRow_',
    'insertNewInvestmentHistoryRow_', 'insertNewHouseHistoryRow_',
    'applyDebtsSheetStyling_', 'buildCashFlowYearSheet_',
    'insertCashFlowRow_', 'getOrCreateUpcomingExpensesSheet_',
    'getOrCreateRetirementSheet_'
  ],
  'first_run_e2e.js': [
    'provisionWorkbookForUser_', 'frE2ECleanupVerified_'
  ],
  'populated_dashboard_e2e.js': [
    'frE2EPrepare(confirmed)', 'runMinimalBootstrap_',
    'harnessSeedRepresentativeWorkbook_', 'frE2ECleanupVerified_'
  ],
  'recovery_live.js': [
    'findCandidateWorkbooks_', 'resolveExistingWorkbookForRecovery_',
    'recoveryReconnectSelf()', 'getUserSpreadsheet_()'
  ],
  'Dashboard_Script_PopulatedDashboardE2E.html': [
    "showPage('overview')", "showTab('bank')", 'loadBankSectionThenSelect_',
    'loadDebtSectionThenSelect_', 'loadInvestmentSectionThenSelect_',
    'refresh.click()'
  ]
};

for (const [name, symbols] of Object.entries(requiredProductionPaths)) {
  const source = await read(name);
  for (const symbol of symbols) {
    assert.ok(source.includes(symbol), `${name} must exercise production path ${symbol}`);
  }
}

const donations = await read('donations.js');
assert.match(donations, /function ensureInputDonationSheet_\(optionalSs\)/,
  'Donation provisioning must expose an explicit disposable-workbook seam');
assert.match(donations, /function addDonation\(payload, optionalSs\)/,
  'Donation saves must expose an explicit disposable-workbook seam');
assert.match(await read('test_harness_scenarios.js'), /addDonation\([\s\S]*?\}, ss\)/,
  'Donation smoke must use the real production writer on its disposable workbook');

// Scenario code may write directly only when it is constructing a fixture or
// deliberately simulating a late edit/corrupt input. Any new direct-write file
// must be consciously reviewed and added here with its rationale documented in
// TEST_PRODUCTION_PATH_AUDIT.md; otherwise the suite fails closed.
const directWriteAllowlist = new Set([
  'test_harness_core.js',                 // harness identity markers only
  'test_harness_data.js',                 // deterministic fixture setup only
  'test_harness_scenarios_bills.js',      // explicit Bills fixtures for engine/schema cases
  'test_harness_scenarios_quick_add.js'   // deliberate late-edit state simulation
]);
const entries = await readdir(root, { withFileTypes: true });
const candidateNames = entries
  .filter((entry) => entry.isFile() && (/^test_.*\.js$/.test(entry.name) ||
    ['first_run_e2e.js', 'populated_dashboard_e2e.js', 'recovery_live.js',
      'recovery_test_fixtures.js'].includes(entry.name)))
  .map((entry) => entry.name);
const directWritePattern = /\.(?:setValue|setValues|appendRow|insertRowBefore|insertRowAfter|insertSheet|deleteSheet|setFormula|setFormulas)\s*\(/;
for (const name of candidateNames) {
  const source = await read(name);
  if (directWritePattern.test(source)) {
    assert.ok(directWriteAllowlist.has(name),
      `${name} adds a direct workbook write outside the reviewed fixture/mutation allowlist`);
  }
}

console.log('Test production-path audit checks passed.');
