import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const files = Object.fromEntries(await Promise.all([
  'test_harness_core.js',
  'test_harness_data.js',
  'test_harness_report.js',
  'test_harness_scenarios.js',
  'test_harness_scenarios_populated.js',
  'test_harness_suites.js',
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
