import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import vm from 'node:vm';

const read = (name) => readFile(new URL(`../${name}`, import.meta.url), 'utf8');
const [registry, formulas, cf, named, health, release, contract, suites,
  planner, bank, investments, houses, plannerOutput, quickAdd, dashboard, performanceScenario, billsPayScenario,
  harnessCore, p1Runner, webapp, centralDiagnostics] = await Promise.all([
  read('validator_schema_registry.js'), read('validator_formulas.js'),
  read('validator_conditional_formatting.js'), read('validator_named_ranges.js'),
  read('validator_health.js'), read('release_readiness_runner.js'),
  read('P1_RELEASE_EVIDENCE_CONTRACT.md'), read('test_harness_suites.js'),
  read('code.js'), read('bank_accounts.js'), read('investments.js'), read('house_values.js'),
  read('planner_output.js'), read('quick_add_payment.js'), read('dashboard_data.js'),
  read('test_harness_scenarios_performance.js'), read('test_harness_scenarios_bills_pay.js'),
  read('test_harness_core.js'), read('test_p1_isolated_runner.js'), read('webapp.js'), read('central_diagnostics.js')
]);

const rootEntries = await readdir(new URL('../', import.meta.url), { withFileTypes: true });
const rootJsNames = rootEntries.filter((entry) => entry.isFile() && entry.name.endsWith('.js')).map((entry) => entry.name);
const rootJsSources = await Promise.all(rootJsNames.map((name) => read(name)));
const allRootJs = rootJsSources.join('\n');

assert.doesNotMatch(allRootJs,
  /(?:setProperty|deleteProperty)\s*\(\s*(?:ADMIN_EMAILS_KEY_|['"]ADMIN_EMAILS['"])/,
  'Runtime and test code must never modify the immutable ADMIN_EMAILS property');
assert.match(centralDiagnostics, /getProperty\(ADMIN_EMAILS_KEY_\)/,
  'Admin identity must remain a read-only configuration lookup');
assert.doesNotMatch(p1Runner, /getUserSpreadsheet_\s*\(|getActiveSpreadsheet\s*\(/,
  'P1 writers must never resolve an existing user or bounded workbook');
assert.match(p1Runner, /isAdminUser_\(\)/, 'P1 runners must remain admin-gated');
assert.match(p1Runner, /isCentralModeEnabled_\(\)/, 'P1 runners must remain Central-only');
assert.match(p1Runner, /RELEASE_TEST_SOURCE_VERSION/);
assert.match(p1Runner, /RELEASE_TEST_DEPLOYMENT/);
assert.doesNotMatch(p1Runner, /sourceVersion:\s*['"]\d+['"]|deployment:\s*['"][^'"]*@\d+['"]/,
  'Permanent P1 runners must not hardcode a stale deployment/version');
assert.doesNotMatch(webapp, /testRunP1WorkbookHealthAndRelease|testRunP1PerformancePlanner|testRunP1BillsPayE2E/,
  'P1 editor runners must never be wired into normal web-app routing');
assert.match(harnessCore, /target is the active\/bound workbook/,
  'Disposable gate must explicitly refuse the active/bounded workbook');
assert.match(harnessCore, /target ID matches a protected production workbook/,
  'Disposable gate must refuse Golden, configured-default, and mapped workbook IDs');

assert.match(registry, /getValidatorCanonicalModel_\(\)/, 'Schema registry must reference the live canonical model');
assert.doesNotMatch([registry, formulas, cf, named, health].join('\n'), /setValue|setValues|setFormula|setConditionalFormatRules|setNamedRange|insertSheet|deleteSheet/,
  'Validator modules must remain read-only');
for (const fn of ['validateFormulas_', 'validateConditionalFormatting_', 'validateNamedRanges_', 'validateWorkbookHealth_']) {
  assert.match([formulas, cf, named, health].join('\n'), new RegExp(`function ${fn}\\(`), `Missing ${fn}`);
}
assert.match(release, /one scenario per invocation/i);
assert.match(release, /LockService\.getScriptLock\(\)/, 'Bounded runner must prevent concurrent chunks');
assert.match(release, /runScenario_\(scenario,[\s\S]*\{ trash: true \}\)/,
  'Release chunks must use disposable scenario runners and request Trash');
assert.doesNotMatch(release, /runScenario_\([^\n]*candidateSpreadsheetId/,
  'Candidate workbook ID must never enter a writer');
for (const suite of ['SUITE-FIRST-RUN-UX-E2E', 'SUITE-POPULATED-DASHBOARD-E2E', 'SUITE-RECOVERY-LIVE']) {
  assert.ok(release.includes(`'${suite}'`), `Required release inventory missing ${suite}`);
  const descriptor = suites.match(new RegExp(`id: '${suite}'[\\s\\S]*?scenarioIds: \\[\\]`));
  assert.ok(descriptor && /implemented: false/.test(descriptor[0]), `${suite} must fail closed until its real execution seam exists`);
}
assert.match(suites, /id: 'SUITE-PERFORMANCE-PLANNER'[\s\S]*?implemented: true[\s\S]*?'PERFORMANCE-PLANNER-FIRST-REPEAT'/,
  'Performance suite must use the explicit-workbook planner scenario');
assert.match(suites, /id: 'SUITE-BILLS-PAY-E2E'[\s\S]*?implemented: true[\s\S]*?'E2E-BILLS-DUE-PAY'/,
  'Bills Pay suite must use the explicit-workbook payment scenario');
assert.match(release, /PERFORMANCE_BUDGETS_RATIFIED/, 'Release verdict must fail closed until performance budgets are ratified');
assert.match(planner, /options\.spreadsheet \|\| getUserSpreadsheet_\(\)/, 'Planner must preserve normal resolution and allow an internal explicit target');
assert.match(planner, /buildInputBillPlannerPaymentWindows_\([\s\S]*?paySoonWindowDays,\s*ss\s*\)/,
  'Planner must propagate its explicit workbook into nested Bills payment-window reads');
assert.match(planner, /getBillsDueFromCashFlowForDashboard\(cashFlowRaw, ss\)/,
  'Planner must propagate its explicit workbook into nested Bills Due reads');
assert.match(dashboard, /function getBillsDueFromCashFlowForDashboard\(preloadedCurrentCashFlow, optionalSs\)/);
assert.match(dashboard, /function buildInputBillPlannerPaymentWindows_\(today, tz, payNowWindowDays, paySoonWindowDays, optionalSs\)/);
assert.match(dashboard, /buildCashFlowYearSheet_\(ss, today\.getFullYear\(\)\)/,
  'Bills Due first-run provisioning must remain on the already-resolved explicit workbook');
assert.match(bank, /function syncAllAccountsFromLatestCurrentYear_\(optionalSs\)/);
assert.match(investments, /function syncAllAssetsFromLatestCurrentYear_\(optionalSs\)/);
assert.match(houses, /function syncAllHouseAssetsFromLatestCurrentYear_\(optionalSs\)/);
assert.match(plannerOutput, /if \(emailMode === 'suppress'\) return;/, 'Planner harness runs must never send or queue email');
assert.match(quickAdd, /function quickAddPayment\(payload, optionalSs\)/);
assert.match(dashboard, /function markDashboardBillOccurrencePaid\(payload, optionalSs\)/);
assert.doesNotMatch(performanceScenario + billsPayScenario, /getUserSpreadsheet_\s*\(/,
  'New server suites must never resolve an owner/bounded workbook');

const inventoryCtx = vm.createContext({ assertHarnessAllowed_: () => {}, console });
vm.runInContext(suites, inventoryCtx);
vm.runInContext(release, inventoryCtx);
const inventory = inventoryCtx.releaseBuildInventory_();
assert.deepEqual(Array.from(inventory.missingSuites), [
  'SUITE-FIRST-RUN-UX-E2E', 'SUITE-POPULATED-DASHBOARD-E2E', 'SUITE-RECOVERY-LIVE'
], 'Release inventory must explicitly refuse the three execution-dependent packs');
assert.throws(() => inventoryCtx.testRunSuiteById_('SUITE-FIRST-RUN-UX-E2E', {}), /NOT IMPLEMENTED/,
  'Unimplemented deeper suites must fail before any workbook is created');

const propertyBag = new Map();
const props = {
  getProperty: (k) => propertyBag.has(k) ? propertyBag.get(k) : null,
  setProperty: (k, v) => { propertyBag.set(k, String(v)); return props; },
  deleteProperty: (k) => { propertyBag.delete(k); return props; }
};
const verdictCtx = vm.createContext({
  assertValidatorAllowed_: () => {}, assertHarnessAllowed_: () => {},
  PropertiesService: { getScriptProperties: () => props }, console
});
vm.runInContext(release, verdictCtx);
const baseState = {
  version: 1, runId: 'RR-test', startedAt: new Date().toISOString(),
  candidate: { workbookId: 'fixture', sourceVersion: 'abc123', deployment: '@test' },
  openIssues: { severity1: 0, severity2: 0, declared: true },
  health: { overall: 'PASS' }, inventory: { missingSuites: ['SUITE-RECOVERY-LIVE'], scenarioIds: [] },
  cursor: 0, results: [], status: 'IN_PROGRESS'
};
props.setProperty('RELEASE_READINESS_ACTIVE_RUN_V1', JSON.stringify(baseState));
assert.equal(verdictCtx.releaseReadinessFinalize().status, 'NOT_READY',
  'Missing execution-dependent evidence must force NOT READY');
const readyState = { ...baseState, runId: 'RR-ready', inventory: { missingSuites: [], scenarioIds: [] }, status: 'IN_PROGRESS' };
props.setProperty('RELEASE_READINESS_ACTIVE_RUN_V1', JSON.stringify(readyState));
props.setProperty('PERFORMANCE_BUDGETS_RATIFIED', 'true');
assert.equal(verdictCtx.releaseReadinessFinalize().status, 'READY',
  'Complete passing evidence with ratified budgets must produce READY');
assert.match(contract, /must never substitute static checks or the pure Recovery decision matrix for live E2E evidence/i);

const base = {
  VALIDATOR_SEV_ERROR_: 'ERROR', VALIDATOR_SEV_WARN_: 'WARN', VALIDATOR_SEV_INFO_: 'INFO', VALIDATOR_SEV_OK_: 'OK',
  validatorFinding_: (severity, sheetName, kind, message) => ({ severity, sheetName, kind, message }),
  validatorWorstSeverity_: (fs) => fs.some((f) => f.severity === 'ERROR') ? 'ERROR' : fs.some((f) => f.severity === 'WARN') ? 'WARN' : 'OK',
  pushAll_: (a, b) => a.push(...b),
  schemaCountFindings_: (fs) => fs.reduce((c, f) => { c[f.severity.toLowerCase()]++; return c; }, { error: 0, warn: 0, info: 0, ok: 0 }),
  safeName_: () => 'Fixture', safeId_: () => 'fixture-id', console
};

const formulaCtx = vm.createContext({ ...base, columnToLetter_: (n) => String.fromCharCode(64 + n) });
vm.runInContext(formulas, formulaCtx);
const healthyFormulaSheet = {
  getName: () => 'INPUT - Debts',
  getLastRow: () => 3, getLastColumn: () => 2,
  getRange: (row, col, rows, cols) => row === 1 && rows === 3
    ? { getDisplayValues: () => [['Account Name', 'Balance'], ['Test Visa', '100'], ['TOTAL DEBT', '100']] }
    : { getDisplayValues: () => [['TOTAL DEBT', '100']], getFormulas: () => [['', '=SUM(B2:B2)']] }
};
assert.equal(formulaCtx.validatorCheckSummaryFormulas_(healthyFormulaSheet).length, 0,
  'Canonical SUM summary must pass formula validation');
const hardcodedFormulaSheet = {
  ...healthyFormulaSheet,
  getLastRow: () => 2,
  getRange: (row, col, rows, cols) => row === 1 && rows === 2
    ? { getDisplayValues: () => [['Account Name', 'Balance'], ['TOTAL DEBT', '$100.00']] }
    : { getDisplayValues: () => [['TOTAL DEBT', '$100.00']], getFormulas: () => [['', '']] }
};
assert.ok(formulaCtx.validatorCheckSummaryFormulas_(hardcodedFormulaSheet).some((f) => /hardcoded|no formulas/i.test(f.message)),
  'Hardcoded summary values must be surfaced');

const namedCtx = vm.createContext({ ...base });
vm.runInContext(named, namedCtx);
assert.equal(namedCtx.validateNamedRanges_({ getNamedRanges: () => [], getName: () => 'Fixture', getId: () => 'id' }).overall, 'PASS');
assert.equal(namedCtx.validateNamedRanges_({ getNamedRanges: () => [{ getName: () => 'Unexpected' }], getName: () => 'Fixture', getId: () => 'id' }).overall, 'DRIFT');

console.log('P1 evidence safety regression checks passed.');
